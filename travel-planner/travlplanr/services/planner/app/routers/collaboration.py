"""
Collaborative Itineraries — all invite, collaborator, activity, expense,
and balance endpoints for the planner service.

Authorization model:
  Every trip endpoint is gated by require_trip_role(), which verifies the
  caller is an active TripCollaborator with the minimum required role.

Role hierarchy (least → most privileged):
  viewer < editor < owner
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from shared.auth_dependencies import require_customer
from shared.events import DomainEvent, EventType, STREAM_PLANNER
from shared.redis_client import emit_event
from shared.rate_limit import rate_limiter

from app.models.trips import Trip, TripStatus
from app.models.collaboration import (
    TripCollaborator,
    TripInvite,
    TripActivity,
    TripExpense,
    ExpenseShare,
    TripComment,
)
from app.models.community import Notification
from app.routers.websocket import broadcast_to_user

router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
INVITE_EXPIRY_DAYS = 14
MAX_COLLABORATORS = 20
ROLE_ORDER = {"owner": 3, "editor": 2, "viewer": 1}


# ---------------------------------------------------------------------------
# Helper: email normalisation
# ---------------------------------------------------------------------------
def _norm_email(email: str) -> str:
    return email.strip().lower()


# ---------------------------------------------------------------------------
# require_trip_role dependency
# ---------------------------------------------------------------------------
from app.utils.auth import require_trip_role_model as require_trip_role


# ---------------------------------------------------------------------------
# Internal identity resolve helper
# ---------------------------------------------------------------------------
async def _resolve_email(email: str, auth_header: str | None, request: Request) -> dict | None:
    """Call identity's internal /users/resolve endpoint. Returns None on any error."""
    try:
        headers: dict = {}
        if auth_header:
            headers["Authorization"] = auth_header
        
        settings = getattr(request.app.state, "settings", None)
        if settings and hasattr(settings, "internal_api_secret"):
            headers["X-Internal-Secret"] = settings.internal_api_secret

        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                "http://identity:8000/api/v1/internal/users/resolve",
                params={"email": email},
                headers=headers,
            )
            if resp.status_code == 200:
                return resp.json()
    except httpx.RequestError:
        pass
    return None


# ---------------------------------------------------------------------------
# In-app notification helper
# ---------------------------------------------------------------------------
async def _notify(session, customer_id: uuid.UUID, notif_type: str, message: str, link_url: str):
    n = Notification(
        customer_id=customer_id,
        type=notif_type,
        message=message,
        link_url=link_url,
        is_read=False,
    )
    session.add(n)


# ---------------------------------------------------------------------------
# Activity log helper
# ---------------------------------------------------------------------------
async def _log_activity(
    session,
    trip_id: uuid.UUID,
    actor_id: uuid.UUID,
    actor_name: str,
    action: str,
    summary: str,
    meta: dict | None = None,
):
    act = TripActivity(
        trip_id=trip_id,
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        summary=summary,
        meta=meta or {},
    )
    session.add(act)


async def _broadcast_to_trip(
    session, trip_id: uuid.UUID, event_type: str, payload: dict, exclude_user_id: uuid.UUID | None = None
) -> None:
    """Push a WS event to every active collaborator on a trip (used for live
    comments and presence — see broadcast_to_user for the underlying per-user send)."""
    collaborators = (await session.execute(
        select(TripCollaborator.user_id).where(
            TripCollaborator.trip_id == trip_id,
            TripCollaborator.status == "active",
            TripCollaborator.user_id.is_not(None),
        )
    )).scalars().all()
    for user_id in collaborators:
        if exclude_user_id is not None and user_id == exclude_user_id:
            continue
        try:
            await broadcast_to_user(str(user_id), event_type, payload)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Split-math helpers  (pure, testable)
# ---------------------------------------------------------------------------
def compute_equal_shares(amount_cents: int, member_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Divide amount_cents equally; last-cent remainder goes to last member."""
    n = len(member_ids)
    if n == 0:
        return {}
    base = amount_cents // n
    remainder = amount_cents - base * n
    shares: dict[uuid.UUID, int] = {uid: base for uid in member_ids}
    if remainder and member_ids:
        shares[member_ids[-1]] += remainder
    return shares


def compute_custom_shares(amount_cents: int, custom: dict[str, int]) -> dict[uuid.UUID, int]:
    """Validate and return custom share mapping (values are cents)."""
    total = sum(custom.values())
    if total != amount_cents:
        raise ValueError(f"Custom shares sum {total} != total {amount_cents}")
    return {uuid.UUID(k): v for k, v in custom.items()}


def compute_percentage_shares(amount_cents: int, pcts: dict[str, float]) -> dict[uuid.UUID, int]:
    """Convert percentages to cents; assign rounding remainder to last member."""
    total_pct = sum(pcts.values())
    if abs(total_pct - 100.0) > 0.01:
        raise ValueError(f"Percentages sum {total_pct} != 100")
    items = list(pcts.items())
    shares: dict[uuid.UUID, int] = {}
    running = 0
    for i, (uid, pct) in enumerate(items):
        if i < len(items) - 1:
            s = int(amount_cents * pct / 100)
        else:
            s = amount_cents - running
        shares[uuid.UUID(uid)] = s
        running += s
    return shares


def assert_shares_are_members(
    shares: dict[uuid.UUID, int], member_ids: list[uuid.UUID]
) -> None:
    """Reject shares assigned to anyone who isn't an active collaborator.

    Only the "equal" split derives its recipients server-side from member_ids; the
    "custom" and "percentage" splits take their user ids straight from the request
    body. Without this check a collaborator could assign trip debt to arbitrary
    accounts, and those rows would then feed into compute_balances().
    """
    members = set(member_ids)
    strangers = [uid for uid in shares if uid not in members]
    if strangers:
        raise ValueError(
            "Shares reference users who are not active collaborators: "
            + ", ".join(str(uid) for uid in sorted(strangers, key=str))
        )
    if any(cents < 0 for cents in shares.values()):
        raise ValueError("Share amounts cannot be negative")


def compute_balances(
    expenses: list[dict],  # {paid_by, shares: [{user_id, share_cents}]}
) -> list[dict]:
    """Return net "who owes whom" list from a list of expense dicts."""
    net: dict[uuid.UUID, int] = {}  # positive = owed money, negative = owes money
    for exp in expenses:
        payer = uuid.UUID(str(exp["paid_by"]))
        total = exp["amount_cents"]
        net[payer] = net.get(payer, 0) + total
        for sh in exp.get("shares", []):
            uid = uuid.UUID(str(sh["user_id"]))
            net[uid] = net.get(uid, 0) - sh["share_cents"]

    # Simplify: match payers against debtors
    credits = sorted([(v, k) for k, v in net.items() if v > 0], reverse=True)
    debits = sorted([(-v, k) for k, v in net.items() if v < 0], reverse=True)

    settlements: list[dict] = []
    i, j = 0, 0
    while i < len(credits) and j < len(debits):
        credit_amt, creditor = credits[i]
        debit_amt, debtor = debits[j]
        settle = min(credit_amt, debit_amt)
        if settle > 0:
            settlements.append({"from": str(debtor), "to": str(creditor), "amount_cents": settle})
        credits[i] = (credit_amt - settle, creditor)
        debits[j] = (debit_amt - settle, debtor)
        if credits[i][0] == 0:
            i += 1
        if debits[j][0] == 0:
            j += 1

    return settlements


# ===========================================================================
# PHASE 2 — Invite & Accept endpoints
# ===========================================================================

class InviteBody(BaseModel):
    email: str
    role: str = "viewer"
    nickname: str | None = None


@router.post("/{trip_id}/invites", status_code=201, dependencies=[Depends(rate_limiter("invite", limit=10, window_seconds=3600))])
async def invite_collaborator(
    trip_id: str,
    body: InviteBody,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("editor")),
    auth: dict = Depends(require_customer),
):
    """Invite a user by email to collaborate. Owner or editor can invite."""

    invitee_email = _norm_email(body.email)
    actor_id = uuid.UUID(auth["customer_id"])
    actor_name = auth.get("customer_name", "Someone")

    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    # Validate role
    if body.role not in ("editor", "viewer"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Role must be 'editor' or 'viewer'")

    async with request.app.state.session_factory() as session:
        # Fetch trip
        trip = (await session.execute(select(Trip).where(Trip.id == trip_uuid))).scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        # Guard: can't invite to cancelled trip
        if trip.status in (TripStatus.CANCELLED,):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot invite to a cancelled trip")

        # Self-invite guard (generic message to avoid enumeration)
        actor_email = auth.get("email", "")
        if _norm_email(actor_email) == invitee_email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot invite yourself")

        # Max collaborators
        count = (await session.execute(
            select(func.count()).select_from(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.status.in_(("pending", "active")),
            )
        )).scalar() or 0
        if count >= MAX_COLLABORATORS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum collaborators reached")

        # Check existing collaborator
        existing = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.email == invitee_email,
            )
        )).scalar_one_or_none()

        if existing:
            if existing.status in ("active",):
                raise HTTPException(status.HTTP_409_CONFLICT, "Already a collaborator")
            if existing.status == "pending":
                # Re-invite: invalidate old invite tokens, create a fresh one
                from sqlalchemy import update
                await session.execute(
                    update(TripInvite).where(
                        TripInvite.trip_id == trip_uuid,
                        TripInvite.invitee_email == invitee_email,
                        TripInvite.status == "pending",
                    ).values(status="superseded")
                )
                # fall through to create a new invite
            if existing.status == "declined":
                existing.status = "pending"
                existing.role = body.role
                existing.invited_by = actor_id

        # Resolve identity (fail-open — unknown email still creates pending invite)
        auth_header = request.headers.get("Authorization")
        identity_info = await _resolve_email(invitee_email, auth_header, request)
        invitee_user_id = None
        invitee_display_name = None
        if identity_info and identity_info.get("exists"):
            invitee_user_id = uuid.UUID(identity_info["user_id"])
            invitee_display_name = identity_info.get("display_name")

        # Upsert collaborator row
        if not existing:
            collab_row = TripCollaborator(
                trip_id=trip_uuid,
                user_id=invitee_user_id,
                email=invitee_email,
                display_name=invitee_display_name,
                nickname=body.nickname,
                role=body.role,
                status="pending",
                invited_by=actor_id,
            )
            session.add(collab_row)
        else:
            existing.user_id = invitee_user_id or existing.user_id
            existing.display_name = invitee_display_name or existing.display_name
            existing.nickname = body.nickname or existing.nickname

        # Create invite token
        token = secrets.token_urlsafe(48)
        invite = TripInvite(
            trip_id=trip_uuid,
            invitee_email=invitee_email,
            role=body.role,
            token=token,
            status="pending",
            expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
            invited_by=actor_id,
        )
        session.add(invite)

        # Activity log
        await _log_activity(
            session, trip_uuid, actor_id, actor_name,
            "invited", f"Invited {invitee_email} as {body.role}"
        )

        # In-app notification to invitee (if registered)
        if invitee_user_id:
            await _notify(
                session, invitee_user_id,
                "trip_invite",
                f"{actor_name} invited you to collaborate on '{trip.title}'",
                f"/invite/{token}",
            )

        await session.commit()
        
        # Emit Domain Event
        event = DomainEvent(
            event_type=EventType.COLLABORATOR_INVITED,
            subject_id=str(trip_uuid),
            tenant_id=auth.get("tenant_id", "00000000-0000-0000-0000-000000000001"),
            actor_user_id=str(actor_id),
            payload={
                "invitee_email": invitee_email,
                "role": body.role,
                "trip_title": trip.title
            }
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)

        from app.services.notification_service import get_notification_provider
        provider = get_notification_provider()
        await provider.send_trip_invite(
            email=invitee_email,
            token=token,
            trip_title=trip.title,
            inviter_name=actor_name
        )

        return {"status": "invited", "token": token, "email": invitee_email}


@router.get("/{trip_id}/collaborators")
async def list_collaborators(
    trip_id: str,
    request: Request,
    _: TripCollaborator = Depends(require_trip_role("viewer")),
):
    """List all collaborators on a trip (paginated by offset/limit)."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    async with request.app.state.session_factory() as session:
        rows = (await session.execute(
            select(TripCollaborator)
            .where(TripCollaborator.trip_id == trip_uuid)
            .order_by(TripCollaborator.invited_at)
        )).scalars().all()

    return [
        {
            "id": str(r.id),
            "user_id": str(r.user_id) if r.user_id else None,
            "email": r.email,
            "display_name": r.nickname or r.display_name or r.email.split("@")[0],
            "role": r.role,
            "status": r.status,
            "invited_at": r.invited_at.isoformat() if r.invited_at else None,
            "accepted_at": r.accepted_at.isoformat() if r.accepted_at else None,
        }
        for r in rows
    ]


@router.get("/invites/{token}")
async def preview_invite(token: str, request: Request):
    """Public — shows trip title and inviter name for the invite accept page."""
    async with request.app.state.session_factory() as session:
        invite = (await session.execute(
            select(TripInvite).where(TripInvite.token == token)
        )).scalar_one_or_none()

        if not invite:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
        if invite.status != "pending":
            raise HTTPException(status.HTTP_410_GONE, f"Invite already {invite.status}")
        if invite.expires_at < datetime.now(timezone.utc):
            invite.status = "expired"
            await session.commit()
            raise HTTPException(status.HTTP_410_GONE, "Invite expired")

        trip = (await session.execute(
            select(Trip).where(Trip.id == invite.trip_id)
        )).scalar_one_or_none()

    return {
        "trip_id": str(invite.trip_id),
        "trip_title": trip.title if trip else "Unknown Trip",
        "trip_destination": trip.destination if trip else "",
        "role": invite.role,
        "invitee_email": invite.invitee_email,
        "expires_at": invite.expires_at.isoformat(),
    }


class AcceptBody(BaseModel):
    nickname: str | None = None


@router.post("/invites/{token}/accept", dependencies=[Depends(rate_limiter("accept_invite", limit=20, window_seconds=3600))])
async def accept_invite(
    token: str,
    body: AcceptBody,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Accept an invite. Caller must be authenticated and match the invite email."""

    customer_id = uuid.UUID(auth["customer_id"])
    customer_email = _norm_email(auth.get("email", ""))

    async with request.app.state.session_factory() as session:
        invite = (await session.execute(
            select(TripInvite).where(TripInvite.token == token)
        )).scalar_one_or_none()
        if not invite:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
        if invite.status != "pending":
            raise HTTPException(status.HTTP_410_GONE, f"Invite already {invite.status}")
        if invite.expires_at < datetime.now(timezone.utc):
            invite.status = "expired"
            await session.commit()
            raise HTTPException(status.HTTP_410_GONE, "Invite expired")

        # Email match guard
        if customer_email and invite.invitee_email != customer_email:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Invite is for a different email address")

        # Activate collaborator row
        collab = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == invite.trip_id,
                TripCollaborator.email == invite.invitee_email,
            )
        )).scalar_one_or_none()
        if not collab:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Collaborator record not found")

        collab.user_id = customer_id
        collab.status = "active"
        collab.accepted_at = datetime.now(timezone.utc)
        if body.nickname:
            collab.nickname = body.nickname

        invite.status = "accepted"

        trip = (await session.execute(select(Trip).where(Trip.id == invite.trip_id))).scalar_one_or_none()
        actor_name = collab.nickname or collab.display_name or customer_email.split("@")[0]

        await _log_activity(
            session, invite.trip_id, customer_id, actor_name,
            "joined", f"{actor_name} joined as {collab.role}"
        )

        # Notify trip owner
        owner = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == invite.trip_id,
                TripCollaborator.role == "owner",
                TripCollaborator.status == "active",
            )
        )).scalar_one_or_none()
        if owner and owner.user_id:
            await _notify(
                session, owner.user_id,
                "trip_joined",
                f"{actor_name} accepted your invite to '{trip.title if trip else 'your trip'}'",
                f"/itinerary/{invite.trip_id}",
            )

        await session.commit()
        return {"status": "accepted", "trip_id": str(invite.trip_id), "role": collab.role}


@router.post("/invites/{token}/decline")
async def decline_invite(
    token: str,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Decline an invite."""
    async with request.app.state.session_factory() as session:
        invite = (await session.execute(
            select(TripInvite).where(TripInvite.token == token)
        )).scalar_one_or_none()
        if not invite or invite.status != "pending":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found or already used")

        invite.status = "declined"
        collab = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == invite.trip_id,
                TripCollaborator.email == invite.invitee_email,
            )
        )).scalar_one_or_none()
        if collab:
            collab.status = "declined"

        await session.commit()
    return {"status": "declined"}


class UpdateCollaboratorBody(BaseModel):
    role: str | None = None
    nickname: str | None = None


@router.patch("/{trip_id}/collaborators/{uid}")
async def update_collaborator(
    trip_id: str,
    uid: str,
    body: UpdateCollaboratorBody,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("owner")),
    auth: dict = Depends(require_customer),
):
    """Owner can change role or nickname of a collaborator."""
    async with request.app.state.session_factory() as session:
        try:
            trip_uuid = uuid.UUID(trip_id)
            target_uid = uuid.UUID(uid)
        except ValueError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

        target = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.user_id == target_uid,
            )
        )).scalar_one_or_none()
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Collaborator not found")

        if body.role:
            if body.role not in ("editor", "viewer"):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
            # Can't demote the only owner
            if target.role == "owner":
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use transfer-ownership to change the owner")
            target.role = body.role
        if body.nickname is not None:
            target.nickname = body.nickname

        await session.commit()
    return {"status": "updated"}


@router.delete("/{trip_id}/collaborators/{uid}")
async def remove_collaborator(
    trip_id: str,
    uid: str,
    request: Request,
    auth: dict = Depends(require_customer),
    collab: TripCollaborator = Depends(require_trip_role("viewer")),
):
    """Remove a member or leave the trip. Owner can remove anyone; others can only leave."""
    caller_id = uuid.UUID(auth["customer_id"])
    try:
        trip_uuid = uuid.UUID(trip_id)
        target_uid = uuid.UUID(uid)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

    if caller_id != target_uid and collab.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can remove other members")

    async with request.app.state.session_factory() as session:
        target = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.user_id == target_uid,
            )
        )).scalar_one_or_none()
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Collaborator not found")
        if target.role == "owner" and caller_id == target_uid:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Owner must transfer ownership before leaving the trip",
            )

        target.status = "removed"
        await session.commit()
    return {"status": "removed"}


class TransferOwnershipBody(BaseModel):
    new_owner_user_id: str


@router.post("/{trip_id}/transfer-ownership")
async def transfer_ownership(
    trip_id: str,
    body: TransferOwnershipBody,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("owner")),
    auth: dict = Depends(require_customer),
):
    """Transfer the owner role to another active collaborator."""
    caller_id = uuid.UUID(auth["customer_id"])
    try:
        trip_uuid = uuid.UUID(trip_id)
        new_owner_id = uuid.UUID(body.new_owner_user_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid IDs")

    async with request.app.state.session_factory() as session:
        new_owner = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.user_id == new_owner_id,
                TripCollaborator.status == "active",
            )
        )).scalar_one_or_none()
        if not new_owner:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Target collaborator not found or inactive")

        current_owner = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.user_id == caller_id,
                TripCollaborator.role == "owner",
            )
        )).scalar_one_or_none()
        if not current_owner:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not the owner")

        current_owner.role = "editor"
        new_owner.role = "owner"
        await session.commit()

    return {"status": "transferred", "new_owner": str(new_owner_id)}


# ===========================================================================
# PHASE 3 — Activity Feed
# ===========================================================================

@router.get("/{trip_id}/activity")
async def get_activity(
    trip_id: str,
    request: Request,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: TripCollaborator = Depends(require_trip_role("viewer")),
):
    """Activity feed for a trip (reverse-chronological)."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    async with request.app.state.session_factory() as session:
        rows = (await session.execute(
            select(TripActivity)
            .where(TripActivity.trip_id == trip_uuid)
            .order_by(TripActivity.created_at.desc())
            .offset(offset)
            .limit(limit)
        )).scalars().all()

    return [
        {
            "id": str(r.id),
            "actor_id": str(r.actor_id),
            "actor_name": r.actor_name,
            "action": r.action,
            "summary": r.summary,
            "meta": r.meta,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


# ===========================================================================
# PHASE 4 — Confirm & Split
# ===========================================================================

@router.post("/{trip_id}/confirm")
async def confirm_trip(
    trip_id: str,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("owner")),
    auth: dict = Depends(require_customer),
):
    """Lock the plan and unlock expense splitting (owner only)."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    actor_id = uuid.UUID(auth["customer_id"])
    actor_name = auth.get("customer_name", "Owner")

    async with request.app.state.session_factory() as session:
        trip = (await session.execute(select(Trip).where(Trip.id == trip_uuid))).scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
        trip.is_confirmed = True
        await _log_activity(session, trip_uuid, actor_id, actor_name, "confirmed", "Plan confirmed — expenses unlocked")
        await session.commit()

    return {"status": "confirmed"}


class ExpenseCreateBody(BaseModel):
    description: str
    category: str | None = None
    amount_cents: int
    currency: str = "USD"
    paid_by: str  # user_id UUID string
    split_method: str = "equal"
    # For custom: {"user_id_str": cents_int, ...}
    custom_shares: dict[str, int] | None = None
    # For percentage: {"user_id_str": float_pct, ...}
    percentage_shares: dict[str, float] | None = None


@router.post("/{trip_id}/expenses", status_code=201)
async def add_expense(
    trip_id: str,
    body: ExpenseCreateBody,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("editor")),
    auth: dict = Depends(require_customer),
):
    """Add an expense. Trip must be confirmed first."""
    try:
        trip_uuid = uuid.UUID(trip_id)
        paid_by_id = uuid.UUID(body.paid_by)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid IDs")

    if body.amount_cents <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "amount_cents must be positive")
    if body.split_method not in ("equal", "custom", "percentage"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid split_method")

    actor_id = uuid.UUID(auth["customer_id"])
    actor_name = auth.get("customer_name", "Someone")

    async with request.app.state.session_factory() as session:
        trip = (await session.execute(select(Trip).where(Trip.id == trip_uuid))).scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
        if not trip.is_confirmed:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Confirm the trip plan before adding expenses")

        # Fetch active collaborator user_ids
        active_collabs = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.status == "active",
                TripCollaborator.user_id.isnot(None),
            )
        )).scalars().all()
        member_ids = [c.user_id for c in active_collabs]

        # Verify paid_by is an active member
        if paid_by_id not in member_ids:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "paid_by must be an active collaborator")

        # Compute shares
        try:
            if body.split_method == "equal":
                shares = compute_equal_shares(body.amount_cents, member_ids)
            elif body.split_method == "custom":
                if not body.custom_shares:
                    raise ValueError("custom_shares required")
                shares = compute_custom_shares(body.amount_cents, body.custom_shares)
            else:
                if not body.percentage_shares:
                    raise ValueError("percentage_shares required")
                shares = compute_percentage_shares(body.amount_cents, body.percentage_shares)
            assert_shares_are_members(shares, member_ids)
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

        expense = TripExpense(
            trip_id=trip_uuid,
            description=body.description,
            category=body.category,
            amount_cents=body.amount_cents,
            currency=body.currency.upper(),
            paid_by=paid_by_id,
            split_method=body.split_method,
            settled=False,
            created_by=actor_id,
        )
        session.add(expense)
        await session.flush()

        for uid, cents in shares.items():
            session.add(ExpenseShare(expense_id=expense.id, user_id=uid, share_cents=cents))

        await _log_activity(
            session, trip_uuid, actor_id, actor_name, "added_expense",
            f"Added expense: {body.description} ({body.amount_cents} {body.currency})",
            {"expense_id": str(expense.id)},
        )
        await session.commit()
        
        event = DomainEvent(
            event_type=EventType.EXPENSE_ADDED,
            subject_id=str(trip_uuid),
            tenant_id=auth.get("tenant_id", "00000000-0000-0000-0000-000000000001"),
            actor_user_id=str(actor_id),
            payload={
                "expense_id": str(expense.id),
                "amount_cents": body.amount_cents,
                "currency": body.currency.upper(),
                "paid_by": str(paid_by_id)
            }
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)

    return {"status": "created", "expense_id": str(expense.id)}


@router.patch("/{trip_id}/expenses/{eid}")
async def update_expense(
    trip_id: str,
    eid: str,
    body: ExpenseCreateBody,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("editor")),
    auth: dict = Depends(require_customer),
):
    """Edit an expense and recompute shares."""
    try:
        trip_uuid = uuid.UUID(trip_id)
        expense_id = uuid.UUID(eid)
        paid_by_id = uuid.UUID(body.paid_by)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid IDs")

    actor_id = uuid.UUID(auth["customer_id"])
    actor_name = auth.get("customer_name", "Someone")

    async with request.app.state.session_factory() as session:
        expense = (await session.execute(
            select(TripExpense).where(
                TripExpense.id == expense_id, TripExpense.trip_id == trip_uuid
            )
        )).scalar_one_or_none()
        if not expense:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")

        active_collabs = (await session.execute(
            select(TripCollaborator).where(
                TripCollaborator.trip_id == trip_uuid,
                TripCollaborator.status == "active",
                TripCollaborator.user_id.isnot(None),
            )
        )).scalars().all()
        member_ids = [c.user_id for c in active_collabs]

        if paid_by_id not in member_ids:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "paid_by must be an active collaborator")

        try:
            if body.split_method == "equal":
                shares = compute_equal_shares(body.amount_cents, member_ids)
            elif body.split_method == "custom":
                shares = compute_custom_shares(body.amount_cents, body.custom_shares or {})
            else:
                shares = compute_percentage_shares(body.amount_cents, body.percentage_shares or {})
            assert_shares_are_members(shares, member_ids)
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

        # Update header
        expense.description = body.description
        expense.category = body.category
        expense.amount_cents = body.amount_cents
        expense.currency = body.currency.upper()
        expense.paid_by = paid_by_id
        expense.split_method = body.split_method

        # Recompute shares — delete old, insert new
        await session.execute(delete(ExpenseShare).where(ExpenseShare.expense_id == expense_id))
        for uid, cents in shares.items():
            session.add(ExpenseShare(expense_id=expense_id, user_id=uid, share_cents=cents))

        await _log_activity(
            session, trip_uuid, actor_id, actor_name, "edited_expense",
            f"Edited expense: {body.description}",
        )
        await session.commit()

    return {"status": "updated"}


@router.delete("/{trip_id}/expenses/{eid}")
async def delete_expense(
    trip_id: str,
    eid: str,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("editor")),
    auth: dict = Depends(require_customer),
):
    """Delete an expense."""
    try:
        trip_uuid = uuid.UUID(trip_id)
        expense_id = uuid.UUID(eid)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid IDs")

    actor_id = uuid.UUID(auth["customer_id"])
    actor_name = auth.get("customer_name", "Someone")

    async with request.app.state.session_factory() as session:
        expense = (await session.execute(
            select(TripExpense).where(
                TripExpense.id == expense_id, TripExpense.trip_id == trip_uuid
            )
        )).scalar_one_or_none()
        if not expense:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")

        await session.delete(expense)
        await _log_activity(
            session, trip_uuid, actor_id, actor_name, "deleted_expense",
            f"Deleted expense: {expense.description}",
        )
        await session.commit()

    return {"status": "deleted"}


@router.post("/{trip_id}/expenses/{eid}/settle")
async def settle_expense(
    trip_id: str,
    eid: str,
    request: Request,
    _: TripCollaborator = Depends(require_trip_role("editor")),
):
    """Mark an expense as settled."""
    try:
        trip_uuid = uuid.UUID(trip_id)
        expense_id = uuid.UUID(eid)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid IDs")

    async with request.app.state.session_factory() as session:
        expense = (await session.execute(
            select(TripExpense).where(
                TripExpense.id == expense_id, TripExpense.trip_id == trip_uuid
            )
        )).scalar_one_or_none()
        if not expense:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")
        expense.settled = True
        await session.commit()

    return {"status": "settled"}


@router.get("/{trip_id}/expenses")
async def list_expenses(
    trip_id: str,
    request: Request,
    _: TripCollaborator = Depends(require_trip_role("viewer")),
):
    """List all expenses with their shares."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    async with request.app.state.session_factory() as session:
        expenses = (await session.execute(
            select(TripExpense).where(TripExpense.trip_id == trip_uuid)
            .order_by(TripExpense.created_at)
        )).scalars().all()

        result = []
        for exp in expenses:
            shares = (await session.execute(
                select(ExpenseShare).where(ExpenseShare.expense_id == exp.id)
            )).scalars().all()
            result.append({
                "id": str(exp.id),
                "description": exp.description,
                "category": exp.category,
                "amount_cents": exp.amount_cents,
                "currency": exp.currency,
                "paid_by": str(exp.paid_by),
                "split_method": exp.split_method,
                "settled": exp.settled,
                "created_at": exp.created_at.isoformat(),
                "shares": [
                    {"user_id": str(s.user_id), "share_cents": s.share_cents}
                    for s in shares
                ],
            })

    return result


@router.get("/{trip_id}/expenses/balances")
async def get_balances(
    trip_id: str,
    request: Request,
    _: TripCollaborator = Depends(require_trip_role("viewer")),
):
    """Net 'who owes whom' balances, excluding settled expenses."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    async with request.app.state.session_factory() as session:
        expenses = (await session.execute(
            select(TripExpense).where(
                TripExpense.trip_id == trip_uuid,
                TripExpense.settled == False,  # noqa: E712
            )
        )).scalars().all()

        # Batch the shares in one query instead of one per expense.
        expense_ids = [exp.id for exp in expenses]
        shares_by_expense: dict[uuid.UUID, list[ExpenseShare]] = {}
        if expense_ids:
            for share in (await session.execute(
                select(ExpenseShare).where(ExpenseShare.expense_id.in_(expense_ids))
            )).scalars().all():
                shares_by_expense.setdefault(share.expense_id, []).append(share)

        # Expenses carry their own currency, so netting them into a single pot
        # would add unlike units together. Balance each currency separately and
        # return one settlement group per currency.
        by_currency: dict[str, list[dict]] = {}
        for exp in expenses:
            currency = (exp.currency or "USD").upper()
            by_currency.setdefault(currency, []).append({
                "paid_by": exp.paid_by,
                "amount_cents": exp.amount_cents,
                "shares": [
                    {"user_id": s.user_id, "share_cents": s.share_cents}
                    for s in shares_by_expense.get(exp.id, [])
                ],
            })

    settlements_by_currency = {
        currency: compute_balances(exp_dicts)
        for currency, exp_dicts in by_currency.items()
    }
    # `settlements` stays flat for existing clients, with each row tagged by
    # currency so mixed-currency trips are no longer silently summed.
    flat = [
        {**row, "currency": currency}
        for currency, rows in settlements_by_currency.items()
        for row in rows
    ]
    return {"settlements": flat, "by_currency": settlements_by_currency}


# ===========================================================================
# Per-segment comments — threaded discussion tied to a day/segment id,
# distinct from the activity feed above (which logs changes, not discussion).
# ===========================================================================

class CommentBody(BaseModel):
    segment_id: str
    body: str


@router.get("/{trip_id}/comments")
async def list_comments(
    trip_id: str,
    request: Request,
    segment_id: str | None = Query(None),
    _: TripCollaborator = Depends(require_trip_role("viewer")),
):
    """List comments for a trip, optionally scoped to one segment/day."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    async with request.app.state.session_factory() as session:
        query = select(TripComment).where(TripComment.trip_id == trip_uuid)
        if segment_id:
            query = query.where(TripComment.segment_id == segment_id)
        rows = (await session.execute(query.order_by(TripComment.created_at.asc()))).scalars().all()

    return [
        {
            "id": str(c.id),
            "segment_id": c.segment_id,
            "author_id": str(c.author_id),
            "author_name": c.author_name,
            "body": c.body,
            "created_at": c.created_at.isoformat(),
        }
        for c in rows
    ]


@router.post("/{trip_id}/comments", status_code=201)
async def create_comment(
    trip_id: str,
    body: CommentBody,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("viewer")),
    auth: dict = Depends(require_customer),
):
    """Post a comment on a segment/day. Any collaborator (viewer+) may comment."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

    text = body.body.strip()
    if not text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Comment cannot be empty")
    if len(text) > 2000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Comment is too long")

    actor_id = uuid.UUID(auth["customer_id"])
    actor_name = collab.nickname or collab.display_name or auth.get("customer_name", "Someone")

    comment = TripComment(
        trip_id=trip_uuid,
        segment_id=body.segment_id,
        author_id=actor_id,
        author_name=actor_name,
        body=text,
    )

    async with request.app.state.session_factory() as session:
        session.add(comment)
        await session.commit()
        await session.refresh(comment)
        await _broadcast_to_trip(
            session, trip_uuid, "trip_comment_added",
            {"trip_id": trip_id, "segment_id": comment.segment_id},
            exclude_user_id=actor_id,
        )

    return {
        "id": str(comment.id),
        "segment_id": comment.segment_id,
        "author_id": str(comment.author_id),
        "author_name": comment.author_name,
        "body": comment.body,
        "created_at": comment.created_at.isoformat(),
    }


@router.delete("/{trip_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    trip_id: str,
    comment_id: str,
    request: Request,
    collab: TripCollaborator = Depends(require_trip_role("viewer")),
    auth: dict = Depends(require_customer),
):
    """Delete a comment — the author or the trip owner may remove it."""
    try:
        trip_uuid = uuid.UUID(trip_id)
        comment_uuid = uuid.UUID(comment_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

    async with request.app.state.session_factory() as session:
        comment = (await session.execute(
            select(TripComment).where(TripComment.id == comment_uuid, TripComment.trip_id == trip_uuid)
        )).scalar_one_or_none()
        if not comment:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")

        is_author = str(comment.author_id) == auth.get("customer_id")
        if not is_author and collab.role != "owner":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to delete this comment")

        await session.execute(delete(TripComment).where(TripComment.id == comment_uuid))
        await session.commit()
