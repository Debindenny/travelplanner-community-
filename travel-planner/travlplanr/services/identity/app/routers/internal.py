"""
Internal-only endpoints for service-to-service calls.
Not exposed through the public nginx gateway — callable only from within the Docker network.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, Request, Depends, Header, HTTPException, status
import secrets
from pydantic import BaseModel
from sqlalchemy import select

from app.models.users import User
from app.models.customer_profiles import CustomerProfile
from app.models.plans import Subscription

# Plan tier -> monthly generation quota. Kept alongside pricing copy in
# apps/web/src/app/shared/data/pricing.data.ts — update both together.
PLAN_LIMITS = {"free": 2, "individual": 10, "travel_partner": 50}

router = APIRouter()


class ResolveUserResponse(BaseModel):
    exists: bool
    user_id: str | None = None
    email: str | None = None
    display_name: str | None = None


class GetUserPlanResponse(BaseModel):
    plan_code: str


async def verify_internal_secret(request: Request, x_internal_secret: str = Header(default="", alias="X-Internal-Secret")):
    expected = request.app.state.settings.internal_api_secret
    if not secrets.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/users/resolve", response_model=ResolveUserResponse, dependencies=[Depends(verify_internal_secret)])
async def resolve_user_by_email(
    email: str = Query(..., description="Email to resolve"),
    request: Request = None,  # type: ignore[assignment]
):
    """
    Resolve an email address to identity data.

    Returns:
      - {"exists": true, "user_id": "...", "display_name": "..."}  when found
      - {"exists": false}  when not found (not a 404 — the caller decides what to do)

    This endpoint is intentionally unauthenticated because it is only reachable from
    within the Docker compose network (no nginx route). Adding auth here would require
    service-to-service tokens which are out of scope for this iteration.
    """
    normalized = email.strip().lower()
    async with request.app.state.session_factory() as session:
        user = (
            await session.execute(
                select(User).where(User.email == normalized, User.user_kind == "customer")
            )
        ).scalar_one_or_none()

        if not user:
            return ResolveUserResponse(exists=False)

        profile = (
            await session.execute(
                select(CustomerProfile).where(CustomerProfile.user_id == user.id)
            )
        ).scalar_one_or_none()

        display_name = (
            profile.name if profile and profile.name else user.email.split("@")[0]
        )

        return ResolveUserResponse(
            exists=True,
            user_id=str(user.id),
            email=user.email,
            display_name=display_name,
        )


@router.get("/users/{user_id}/plan", response_model=GetUserPlanResponse, dependencies=[Depends(verify_internal_secret)])
async def get_user_plan(user_id: str, request: Request):
    """
    Resolve a user's current subscription plan_code.

    Other services (e.g. planner's checkout markup engine) use this to tell
    B2B (`travel_partner`) customers apart from B2C ones — the JWT's `tenant_id`
    claim can't do this: every user is currently provisioned under the same
    default tenant, regardless of plan, so it carries no B2B/B2C signal.
    """
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return GetUserPlanResponse(plan_code="free")

    async with request.app.state.session_factory() as session:
        sub = (
            await session.execute(select(Subscription).where(Subscription.user_id == uid))
        ).scalar_one_or_none()
        return GetUserPlanResponse(plan_code=sub.plan_code if sub else "free")


class SetUserPlanRequest(BaseModel):
    plan_code: str


@router.patch("/users/{user_id}/plan", response_model=GetUserPlanResponse, dependencies=[Depends(verify_internal_secret)])
async def set_user_plan(user_id: str, body: SetUserPlanRequest, request: Request):
    """
    Upgrade/downgrade a user's plan tier — called by planner's Stripe webhook
    after a subscription checkout completes (see services/planner checkout.py).
    Resets usage counters and starts a fresh 30-day billing period.
    """
    if body.plan_code not in PLAN_LIMITS:
        raise HTTPException(status_code=400, detail=f"Unknown plan_code: {body.plan_code}")

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    now = datetime.now(timezone.utc)
    async with request.app.state.session_factory() as session:
        sub = (
            await session.execute(select(Subscription).where(Subscription.user_id == uid))
        ).scalar_one_or_none()

        if sub:
            sub.plan_code = body.plan_code
            sub.plans_limit = PLAN_LIMITS[body.plan_code]
            sub.plans_used = 0
            sub.period_start = now
            sub.period_end = now + timedelta(days=30)
        else:
            sub = Subscription(
                id=uuid.uuid4(),
                user_id=uid,
                plan_code=body.plan_code,
                plans_used=0,
                plans_limit=PLAN_LIMITS[body.plan_code],
                period_start=now,
                period_end=now + timedelta(days=30),
            )
            session.add(sub)

        await session.commit()
        return GetUserPlanResponse(plan_code=sub.plan_code)
