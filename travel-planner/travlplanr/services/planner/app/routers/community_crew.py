"""Crew matching: destination/date-matched travel groups.

A "crew" is a CommunitySpace tagged with crew_destination_key/crew_start_date/
crew_end_date (see app/models/community.py). Matching finds-or-creates that
tagged space; membership, member listing and chat all reuse the existing
CommunitySpace machinery (community_spaces.py / community_space_messages.py)
rather than duplicating it — only invitations are new here.
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select

from shared.auth_dependencies import require_customer
from shared.rate_limit import rate_limiter
from app.models.community import CommunityProfile, CommunitySpace, CrewInvitation, SpaceMember
from app.models.trips import Trip, TripStatus

router = APIRouter()

_INACTIVE_TRIP_STATUSES = (TripStatus.CANCELLED, TripStatus.FAILED)
_MAX_TRIPS_MATCHED = 5
_MAX_SAMPLE_MEMBERS = 4


class InviteRequest(BaseModel):
    receiver_customer_id: str


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


async def _member_count(session, space_id: UUID) -> int:
    return (await session.execute(
        select(func.count(SpaceMember.id)).where(SpaceMember.space_id == space_id)
    )).scalar() or 0


async def _my_role(session, space_id: UUID, customer_id: UUID) -> str | None:
    return (await session.execute(
        select(SpaceMember.role).where(SpaceMember.space_id == space_id, SpaceMember.customer_id == customer_id)
    )).scalar_one_or_none()


async def _sample_members(session, space_id: UUID, limit: int = _MAX_SAMPLE_MEMBERS) -> list[dict]:
    rows = (await session.execute(
        select(SpaceMember.customer_id).where(SpaceMember.space_id == space_id)
        .order_by(SpaceMember.joined_at.asc()).limit(limit)
    )).scalars().all()
    if not rows:
        return []
    profiles = {
        p.customer_id: p
        for p in (await session.execute(
            select(CommunityProfile).where(CommunityProfile.customer_id.in_(rows))
        )).scalars().all()
    }
    return [
        {"name": (profiles.get(cid).name if profiles.get(cid) and profiles.get(cid).name else "Traveler"),
         "avatar": profiles.get(cid).avatar_url if profiles.get(cid) else None}
        for cid in rows
    ]


def _serialize_match(space: CommunitySpace, member_count: int, role: str | None, sample_members: list[dict]) -> dict:
    return {
        "id": str(space.id),
        "name": space.name,
        "destination_name": space.name,
        "start_date": space.crew_start_date.isoformat() if space.crew_start_date else None,
        "end_date": space.crew_end_date.isoformat() if space.crew_end_date else None,
        "cover_image": space.cover_image,
        "accent": space.accent,
        "accent2": space.accent2,
        "member_count": member_count,
        "is_joined": role is not None,
        "role": role,
        "sample_members": sample_members,
    }


async def _popular_crews(session, customer_id: UUID, today: date, limit: int = 5) -> list[dict]:
    """Fallback for users with no active trips: existing crews ranked by member
    count, so the widget always has something joinable to show instead of an
    empty state."""
    spaces = (await session.execute(
        select(CommunitySpace)
        .where(CommunitySpace.crew_destination_key.isnot(None), CommunitySpace.crew_end_date >= today)
    )).scalars().all()
    scored = [(space, await _member_count(session, space.id)) for space in spaces]
    scored.sort(key=lambda pair: pair[1], reverse=True)

    matches = []
    for space, member_count in scored[:limit]:
        role = await _my_role(session, space.id, customer_id)
        sample_members = await _sample_members(session, space.id)
        matches.append(_serialize_match(space, member_count, role, sample_members))
    return matches


async def _require_crew_space(session, space_id: UUID) -> CommunitySpace:
    space = await session.get(CommunitySpace, space_id)
    if not space or not space.crew_destination_key:
        raise HTTPException(status_code=404, detail="Crew not found")
    return space


async def _find_or_create_crew_space(session, customer_id: UUID, trip: Trip) -> CommunitySpace | None:
    destination_key = (trip.destination or "").strip().lower()
    trip_start = _parse_date(trip.start_date)
    trip_end = _parse_date(trip.end_date)
    if not destination_key or not trip_start or not trip_end or trip_end < trip_start:
        return None

    candidates = (await session.execute(
        select(CommunitySpace)
        .where(
            CommunitySpace.crew_destination_key == destination_key,
            CommunitySpace.crew_start_date <= trip_end,
            CommunitySpace.crew_end_date >= trip_start,
        )
    )).scalars().all()
    if candidates:
        counts = [(c, await _member_count(session, c.id)) for c in candidates]
        counts.sort(key=lambda pair: pair[1], reverse=True)
        return counts[0][0]

    space = CommunitySpace(
        created_by=customer_id,
        name=f"{trip.destination.strip().title()} Crew",
        description=f"Travelers heading to {trip.destination.strip()} around the same dates.",
        visibility="invite_only",
        crew_destination_key=destination_key,
        crew_start_date=trip_start,
        crew_end_date=trip_end,
    )
    session.add(space)
    await session.flush()
    return space


@router.get("/match")
async def match_crews(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    today = date.today()
    async with request.app.state.session_factory() as session:
        trips = (await session.execute(
            select(Trip)
            .where(
                Trip.customer_id == customer_id,
                Trip.end_date >= today.isoformat(),
                Trip.status.not_in(_INACTIVE_TRIP_STATUSES),
            )
            .order_by(Trip.start_date.asc())
            .limit(_MAX_TRIPS_MATCHED)
        )).scalars().all()

        personalized = bool(trips)
        if personalized:
            spaces: dict[UUID, CommunitySpace] = {}
            for trip in trips:
                space = await _find_or_create_crew_space(session, customer_id, trip)
                if space:
                    spaces[space.id] = space
            await session.commit()

            matches = []
            for space in spaces.values():
                member_count = await _member_count(session, space.id)
                role = await _my_role(session, space.id, customer_id)
                sample_members = await _sample_members(session, space.id)
                matches.append(_serialize_match(space, member_count, role, sample_members))
            matches.sort(key=lambda m: m["start_date"] or "")
        else:
            # No active trips to match against — surface popular public crews
            # instead of leaving the widget empty.
            matches = await _popular_crews(session, customer_id, today)

        invite_row = (await session.execute(
            select(CrewInvitation).where(
                CrewInvitation.receiver_customer_id == customer_id,
                CrewInvitation.status == "pending",
            ).order_by(CrewInvitation.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        invite = None
        if invite_row:
            invite_space = await session.get(CommunitySpace, invite_row.space_id)
            sender = (await session.execute(
                select(CommunityProfile).where(CommunityProfile.customer_id == invite_row.sender_customer_id)
            )).scalar_one_or_none()
            if invite_space:
                date_range = None
                if invite_space.crew_start_date and invite_space.crew_end_date:
                    date_range = f"{invite_space.crew_start_date.isoformat()} - {invite_space.crew_end_date.isoformat()}"
                invite = {
                    "id": str(invite_row.id),
                    "space_id": str(invite_space.id),
                    "space_name": invite_space.name,
                    "date_range": date_range,
                    "sender": {
                        "id": str(invite_row.sender_customer_id),
                        "name": sender.name if sender and sender.name else "Traveler",
                        "avatar": sender.avatar_url if sender else None,
                    },
                }

        return {"matches": matches, "invite": invite, "personalized": personalized}


@router.post("/{space_id}/request-join", dependencies=[Depends(rate_limiter("crew-request-join", 30, 60))])
async def request_join_crew(space_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        await _require_crew_space(session, space_id)
        existing = (await session.execute(
            select(SpaceMember).where(SpaceMember.space_id == space_id, SpaceMember.customer_id == customer_id)
        )).scalar_one_or_none()
        if not existing:
            session.add(SpaceMember(space_id=space_id, customer_id=customer_id, role="member"))
            await session.commit()
        member_count = await _member_count(session, space_id)
        return {"status": "success", "action": "joined", "member_count": member_count}


@router.post("/{space_id}/leave", dependencies=[Depends(rate_limiter("crew-leave", 30, 60))])
async def leave_crew(space_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        await _require_crew_space(session, space_id)
        existing = (await session.execute(
            select(SpaceMember).where(SpaceMember.space_id == space_id, SpaceMember.customer_id == customer_id)
        )).scalar_one_or_none()
        if existing:
            await session.delete(existing)
            await session.commit()
        member_count = await _member_count(session, space_id)
        return {"status": "success", "action": "left", "member_count": member_count}


@router.post("/{space_id}/invite", dependencies=[Depends(rate_limiter("crew-invite", 20, 3600))])
async def invite_to_crew(space_id: UUID, data: InviteRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    try:
        receiver_id = UUID(data.receiver_customer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid receiver_customer_id")

    async with request.app.state.session_factory() as session:
        await _require_crew_space(session, space_id)
        sender_membership = (await session.execute(
            select(SpaceMember).where(SpaceMember.space_id == space_id, SpaceMember.customer_id == customer_id)
        )).scalar_one_or_none()
        if not sender_membership:
            raise HTTPException(status_code=403, detail="Only crew members can invite others")

        existing = (await session.execute(
            select(CrewInvitation).where(
                CrewInvitation.space_id == space_id,
                CrewInvitation.receiver_customer_id == receiver_id,
                CrewInvitation.status == "pending",
            )
        )).scalar_one_or_none()
        if existing:
            return {"id": str(existing.id), "status": existing.status}

        invitation = CrewInvitation(
            space_id=space_id, sender_customer_id=customer_id,
            receiver_customer_id=receiver_id, status="pending",
        )
        session.add(invitation)
        await session.commit()
        await session.refresh(invitation)
        return {"id": str(invitation.id), "status": invitation.status}


@router.post("/invitations/{invitation_id}/accept", dependencies=[Depends(rate_limiter("crew-invite-respond", 30, 60))])
async def accept_crew_invitation(invitation_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        invitation = await session.get(CrewInvitation, invitation_id)
        if not invitation or invitation.receiver_customer_id != customer_id:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status != "pending":
            raise HTTPException(status_code=400, detail="Invitation already resolved")

        invitation.status = "accepted"
        existing = (await session.execute(
            select(SpaceMember).where(SpaceMember.space_id == invitation.space_id, SpaceMember.customer_id == customer_id)
        )).scalar_one_or_none()
        if not existing:
            session.add(SpaceMember(space_id=invitation.space_id, customer_id=customer_id, role="member"))
        await session.commit()
        member_count = await _member_count(session, invitation.space_id)
        return {"status": "success", "space_id": str(invitation.space_id), "member_count": member_count}


@router.post("/invitations/{invitation_id}/decline", dependencies=[Depends(rate_limiter("crew-invite-respond", 30, 60))])
async def decline_crew_invitation(invitation_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        invitation = await session.get(CrewInvitation, invitation_id)
        if not invitation or invitation.receiver_customer_id != customer_id:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status != "pending":
            raise HTTPException(status_code=400, detail="Invitation already resolved")

        invitation.status = "declined"
        await session.commit()
        return {"status": "success"}
