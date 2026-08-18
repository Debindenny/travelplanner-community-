import logging
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from shared.auth_dependencies import require_customer
from shared.events import DomainEvent, EventType, STREAM_AFFILIATE
from shared.fx import FALLBACK_RATES_VS_USD, convert, get_rates_vs_usd, normalize_currency
from shared.redis_client import emit_event
from app.models.packages import Package
from app.models.trips import Trip
import os
import stripe
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

stripe.api_key = os.environ.get("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

class CheckoutRequest(BaseModel):
    package_id: str | None = None
    trip_id: str | None = None
    # Kept for backward compatibility with existing clients but no longer trusted:
    # the charge is always recomputed server-side from the package/trip record in
    # `_authoritative_base_amount` below, so a tampered value here has no effect.
    amount: float | None = Field(default=None, gt=0, le=1_000_000)

class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


# Self-serve subscription tiers. `travel_partner` is intentionally excluded —
# the pricing page routes that one to /contact (sales-assisted), and "free"
# has nothing to check out. Prices mirror apps/web/src/app/shared/data/pricing.data.ts.
SUBSCRIPTION_PLANS = {
    "individual": {"name": "Individual", "amount_cents": 999},
}


class SubscriptionCheckoutRequest(BaseModel):
    plan_code: str


# Stripe is always charged in this currency, so every source amount must be
# converted into it before `unit_amount` is computed.
SETTLEMENT_CURRENCY = "USD"

# Packages store their canonical price in INR (see app/models/packages.py); trip
# day-items are USD unless the item carries its own `currency` tag. Getting this
# wrong silently overcharges by the FX rate, so it is resolved explicitly rather
# than inferred from magnitude.
PACKAGE_SOURCE_CURRENCY = "INR"
TRIP_ITEM_DEFAULT_CURRENCY = "USD"


async def _to_settlement_currency(amount: float, from_currency: str, redis) -> float:
    """Convert a source amount into the Stripe settlement currency using live FX rates."""
    src = normalize_currency(from_currency) or SETTLEMENT_CURRENCY
    if src == SETTLEMENT_CURRENCY:
        return float(amount)
    try:
        payload = await get_rates_vs_usd(redis)
        rates = payload.get("rates") or FALLBACK_RATES_VS_USD
    except Exception as exc:
        logger.warning("FX lookup failed during checkout, using fallback rates: %s", exc)
        rates = FALLBACK_RATES_VS_USD
    return convert(float(amount), src, SETTLEMENT_CURRENCY, rates)


async def _authoritative_base_amount(body: CheckoutRequest, auth: dict, session, redis) -> float:
    """Resolve the pre-markup charge, in SETTLEMENT_CURRENCY, from server-side data.

    Never uses the client-supplied amount, and never assumes the stored amount is
    already denominated in the settlement currency.
    """
    if body.package_id:
        try:
            package_id = uuid.UUID(body.package_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid package_id")
        package = (
            await session.execute(select(Package).where(Package.id == package_id))
        ).scalar_one_or_none()
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        return await _to_settlement_currency(
            float(package.price), PACKAGE_SOURCE_CURRENCY, redis
        )

    try:
        trip_id = uuid.UUID(body.trip_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid trip_id")
    trip = (await session.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if str(trip.customer_id) != auth.get("customer_id"):
        raise HTTPException(status_code=403, detail="Not authorized to check out this trip")

    # Sum per-currency first, then convert each bucket once, so a trip mixing
    # currencies is charged correctly instead of adding unlike units together.
    totals_by_currency: dict[str, float] = {}
    for day in trip.days or []:
        for item in (day.get("items") or []):
            try:
                price = float(item.get("price") or 0)
            except (TypeError, ValueError):
                continue
            if price <= 0:
                continue
            currency = (
                normalize_currency(item.get("currency")) or TRIP_ITEM_DEFAULT_CURRENCY
            )
            totals_by_currency[currency] = totals_by_currency.get(currency, 0.0) + price

    total = 0.0
    for currency, amount in totals_by_currency.items():
        total += await _to_settlement_currency(amount, currency, redis)
    return total


# A markup is a multiplier (1.10 == +10%). Anything outside this range is a
# configuration mistake — most often a percentage entered as `110` instead of
# `1.10` — and must never reach Stripe as a live charge multiplier.
MIN_MARKUP = 0.5
MAX_MARKUP = 5.0


def _coerce_markup(raw: Any) -> float:
    """Parse a stored markup multiplier, falling back to 1.0 if it is unusable."""
    try:
        value = float(raw)
    except (TypeError, ValueError):
        logger.error("Invalid markup value %r in Redis; charging without markup", raw)
        return 1.0
    if not MIN_MARKUP <= value <= MAX_MARKUP:
        logger.error(
            "Markup %s outside allowed range [%s, %s]; charging without markup",
            value, MIN_MARKUP, MAX_MARKUP,
        )
        return 1.0
    return value


def _safe_redirect_base(request: Request) -> str:
    """Resolve the post-checkout redirect base from the CORS allowlist.

    The `Origin` header is attacker-controlled, so it is only honored when it is
    an origin we already trust; otherwise the first configured origin is used.
    """
    allowed = request.app.state.settings.cors_origins_list
    origin = request.headers.get("origin")
    if origin and origin in allowed:
        return origin.rstrip("/")
    if allowed:
        return allowed[0].rstrip("/")
    return str(request.base_url).rstrip("/")


async def _is_travel_partner(auth: dict, request: Request) -> bool:
    """Whether this customer is on the B2B `travel_partner` plan. The JWT's
    `tenant_id` claim can't tell us this — every user is currently provisioned
    under the same default tenant — so we ask identity for the real plan_code."""
    user_id = auth.get("sub")
    if not user_id:
        return False
    identity_url = os.environ.get("IDENTITY_URL", "http://identity:8000")
    settings = request.app.state.settings
    headers = {"X-Internal-Secret": settings.internal_api_secret}
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(
                f"{identity_url}/api/v1/internal/users/{user_id}/plan",
                headers=headers
            )
            if res.status_code == 200:
                return res.json().get("plan_code") == "travel_partner"
    except Exception as exc:
        logger.warning(f"Failed to resolve travel_partner plan for markup, defaulting to B2C: {exc}")
    return False


@router.post("", response_model=CheckoutResponse)
async def create_checkout_session(body: CheckoutRequest, request: Request, auth: dict = Depends(require_customer)):
    """
    Create a Stripe Checkout Session for a trip or package.
    """
    if not body.package_id and not body.trip_id:
        raise HTTPException(status_code=400, detail="Must provide package_id or trip_id")

    redis = request.app.state.redis
    async with request.app.state.session_factory() as session:
        base_amount = await _authoritative_base_amount(body, auth, session, redis)

    if base_amount <= 0:
        raise HTTPException(status_code=400, detail="Nothing to charge for this trip or package")

    try:
        # Read markup from Redis
        b2b_markup_str = await redis.get("config:markup:b2b") or "1.10"
        b2c_markup_str = await redis.get("config:markup:b2c") or "1.00"

        # Dynamic Markup Engine — B2B (travel_partner plan) vs B2C pricing.
        raw_markup = b2b_markup_str if await _is_travel_partner(auth, request) else b2c_markup_str
        markup_percent = _coerce_markup(raw_markup)
        final_amount = base_amount * markup_percent

        redirect_base = _safe_redirect_base(request)
        checkout_session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': SETTLEMENT_CURRENCY.lower(),
                    'product_data': {
                        'name': 'Travlplanr Trip/Package Booking',
                    },
                    # Stripe expects cents; round rather than truncate so we
                    # don't silently shave a cent off every charge.
                    'unit_amount': round(final_amount * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            client_reference_id=auth.get("sub"),
            # Session-level metadata so the webhook can identify the trip after payment
            metadata={
                'package_id': body.package_id or '',
                'trip_id': body.trip_id or '',
                'customer_id': auth.get("customer_id") or '',
                'tenant_id': auth.get("tenant_id") or '',
                'markup_applied': str(markup_percent)
            },
            success_url=f"{redirect_base}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{redirect_base}/checkout/cancel",
        )
        
        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except Exception as e:
        logger.error(f"Stripe Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.post("/subscription", response_model=CheckoutResponse)
async def create_subscription_checkout_session(
    body: SubscriptionCheckoutRequest, request: Request, auth: dict = Depends(require_customer)
):
    """
    Create a Stripe Checkout Session for a self-serve plan upgrade (pricing
    page). The webhook below applies the upgrade via identity's internal
    `PATCH /users/{id}/plan` once payment completes — never trust the client's
    redirect back to /checkout/success as proof of payment.
    """
    plan = SUBSCRIPTION_PLANS.get(body.plan_code)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Plan '{body.plan_code}' is not self-serve")

    redirect_base = _safe_redirect_base(request)
    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {'name': f"Travlplanr {plan['name']} Plan"},
                    'unit_amount': plan['amount_cents'],
                    'recurring': {'interval': 'month'},
                },
                'quantity': 1,
            }],
            mode='subscription',
            client_reference_id=auth.get("sub"),
            metadata={
                'plan_code': body.plan_code,
                'user_id': auth.get("sub") or '',
            },
            # Also stamp the metadata onto the Subscription object itself (not just this
            # Checkout Session) so later `customer.subscription.updated`/`.deleted` webhook
            # events — sent for renewals, cancellations, and dashboard-driven changes —
            # can still identify which user/plan they belong to.
            subscription_data={
                'metadata': {
                    'plan_code': body.plan_code,
                    'user_id': auth.get("sub") or '',
                },
            },
            success_url=f"{redirect_base}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{redirect_base}/pricing",
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Stripe subscription checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


from shared.auth_dependencies import require_customer, require_staff, require_permission

class MarkupConfig(BaseModel):
    # Multipliers, not percentages: 1.10 == +10%. Bounded here so a mistyped
    # `110` is rejected at the edge instead of becoming a 110x live charge.
    b2b_markup: float = Field(ge=MIN_MARKUP, le=MAX_MARKUP)
    b2c_markup: float = Field(ge=MIN_MARKUP, le=MAX_MARKUP)

@router.get("/markup")
async def get_markup(request: Request, auth: dict = Depends(require_staff)):
    """Get the current global markup configuration."""
    b2b = await request.app.state.redis.get("config:markup:b2b") or "1.10"
    b2c = await request.app.state.redis.get("config:markup:b2c") or "1.00"
    return {"b2b_markup": _coerce_markup(b2b), "b2c_markup": _coerce_markup(b2c)}

@router.post("/markup")
async def set_markup(
    body: MarkupConfig,
    request: Request,
    auth: dict = Depends(require_permission("system:admin")),
):
    """Set the global markup configuration. Admin-only — this moves live pricing."""
    await request.app.state.redis.set("config:markup:b2b", body.b2b_markup)
    await request.app.state.redis.set("config:markup:b2c", body.b2c_markup)
    return {"status": "success", "b2b_markup": body.b2b_markup, "b2c_markup": body.b2c_markup}

class RefundRequest(BaseModel):
    payment_intent_id: str
    amount: float | None = Field(default=None, gt=0)  # Full refund if None

@router.post("/refund")
async def process_refund(
    body: RefundRequest,
    request: Request,
    auth: dict = Depends(require_permission("system:admin")),
):
    """Process a manual Stripe refund (Admin God-Mode)."""
    try:
        kwargs: dict[str, Any] = {"payment_intent": body.payment_intent_id}
        if body.amount:
            kwargs["amount"] = int(body.amount * 100)

        refund = await asyncio.to_thread(stripe.Refund.create, **kwargs)

        # Let reporting reverse the GBV it recorded for this booking.
        try:
            refund_event = DomainEvent(
                event_type=EventType.BOOKING_REFUNDED,
                actor_user_id=auth.get("sub"),
                subject_id=body.payment_intent_id,
                tenant_id=auth.get("tenant_id") or "default_tenant",
                payload={
                    "payment_intent_id": body.payment_intent_id,
                    "refund_id": refund.id,
                    "amount": (refund.amount or 0) / 100.0,
                    "currency": (refund.currency or "usd").upper(),
                },
            )
            await emit_event(request.app.state.redis, STREAM_AFFILIATE, refund_event)
        except Exception as exc:
            logger.error(f"Failed to emit BOOKING_REFUNDED event: {exc}")

        return {"status": "refund_issued", "refund_id": refund.id}
    except Exception as e:
        logger.error(f"Stripe Refund Error: {e}")
        raise HTTPException(status_code=502, detail="Refund could not be processed")

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe payment webhook — the authoritative signal that a payment completed.
    On `checkout.session.completed` we emit TRIP_BOOKED so the planner marks the
    trip booked (and reporting counts it). This closes the pay→book loop without
    trusting the client to self-report a successful payment.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET is not configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook signature: {e}")

    event_id = event.get("id") if isinstance(event, dict) else event.id
    idempotency_key = f"stripe_webhook:{event_id}"

    # Idempotency check
    is_new = await request.app.state.redis.set(idempotency_key, "processed", nx=True, ex=86400)
    if not is_new:
        logger.info(f"Stripe webhook: event {event_id} already processed")
        return {"received": True}

    try:
        event_type = event.get("type") if isinstance(event, dict) else event["type"]
        if event_type == "checkout.session.completed":
            session = (event["data"]["object"] if isinstance(event, dict) else event.data.object)
            metadata = session.get("metadata") or {}
            trip_id = metadata.get("trip_id")
            if trip_id:
                booked_event = DomainEvent(
                    event_type=EventType.TRIP_BOOKED,
                    actor_user_id=session.get("client_reference_id"),
                    subject_id=trip_id,
                    tenant_id=metadata.get("tenant_id") or "00000000-0000-0000-0000-000000000001",
                    payload={
                        "trip_id": trip_id,
                        "package_id": metadata.get("package_id"),
                        "customer_id": metadata.get("customer_id"),
                        "stripe_session_id": session.get("id"),
                        # Authoritative amount from the Stripe session (amount_total is in cents)
                        "amount": (session.get("amount_total") or 0) / 100.0,
                        "currency": (session.get("currency") or "usd").upper(),
                        "markup_applied": metadata.get("markup_applied"),
                    },
                )
                await emit_event(request.app.state.redis, STREAM_AFFILIATE, booked_event)
                logger.info(f"Stripe webhook: TRIP_BOOKED emitted for trip {trip_id}")

            plan_code = metadata.get("plan_code")
            user_id = metadata.get("user_id")
            if plan_code and user_id:
                await _apply_plan_upgrade(request, user_id, plan_code)

        elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
            # Renewals, cancellations, and plan changes made directly in Stripe's dashboard
            # or customer portal don't go through /subscription above, so this is the only
            # signal that keeps identity's plan tier in sync with the actual Stripe state.
            subscription = event["data"]["object"] if isinstance(event, dict) else event.data.object
            metadata = subscription.get("metadata") or {}
            user_id = metadata.get("user_id")
            plan_code = metadata.get("plan_code")
            status = subscription.get("status")

            if not user_id:
                logger.warning(f"Stripe webhook: {event_type} with no user_id in subscription metadata, skipping")
            elif event_type == "customer.subscription.deleted" or status in (
                "canceled", "unpaid", "incomplete_expired",
            ):
                await _apply_plan_upgrade(request, user_id, "free")
                logger.info(f"Stripe webhook: subscription {status or 'deleted'} for user {user_id}, downgraded to free")
            elif status in ("active", "trialing") and plan_code:
                await _apply_plan_upgrade(request, user_id, plan_code)
    except Exception:
        # Release the idempotency claim so Stripe's automatic retry can
        # actually complete the booking instead of being silently
        # short-circuited by the "already processed" check above.
        await request.app.state.redis.delete(idempotency_key)
        raise

    return {"received": True}


async def _apply_plan_upgrade(request: Request, user_id: str, plan_code: str) -> None:
    """Tell identity to upgrade the user's plan tier after a subscription checkout completes."""
    identity_url = os.environ.get("IDENTITY_URL", "http://identity:8000")
    settings = request.app.state.settings
    headers = {"X-Internal-Secret": settings.internal_api_secret}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.patch(
                f"{identity_url}/api/v1/internal/users/{user_id}/plan",
                json={"plan_code": plan_code},
                headers=headers,
            )
            res.raise_for_status()
            logger.info(f"Stripe webhook: upgraded user {user_id} to plan {plan_code}")
    except Exception as exc:
        logger.error(f"Failed to apply plan upgrade for user {user_id} -> {plan_code}: {exc}")
