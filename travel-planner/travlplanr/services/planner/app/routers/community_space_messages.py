import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select

from shared.auth_dependencies import require_customer
from shared.rate_limit import rate_limiter
from app.models.community import (
    CommunityProfile,
    CommunitySpace,
    SpaceMember,
    SpaceMessage,
    SpaceMessageExpenseSettlement,
    SpaceMessageMeetupRsvp,
    SpaceMessagePlaceAdd,
    SpaceMessagePollVote,
)
from .community_shared import iso_utc, ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()

MESSAGE_KINDS = {"text", "poll", "meetup", "expense", "place"}


class CreateMessageRequest(BaseModel):
    kind: str
    text: str | None = Field(default=None, max_length=2000)
    question: str | None = Field(default=None, max_length=500)
    options: list[str] | None = None
    title: str | None = Field(default=None, max_length=255)
    meta: str | None = Field(default=None, max_length=255)
    total_amount: float | None = None
    participant_count: int | None = None
    notes: str | None = Field(default=None, max_length=500)
    image: str | None = None
    cta_label: str | None = Field(default=None, max_length=100)


class VoteRequest(BaseModel):
    option: str


class RsvpRequest(BaseModel):
    status: str


def _build_content(data: CreateMessageRequest) -> dict:
    kind = data.kind
    if kind == "text":
        if not data.text or not data.text.strip():
            raise HTTPException(status_code=400, detail="Message text cannot be empty")
        return {"text": data.text.strip()}
    if kind == "poll":
        options = [o.strip() for o in (data.options or []) if o.strip()]
        if not data.question or not data.question.strip() or len(options) < 2:
            raise HTTPException(status_code=400, detail="Poll needs a question and at least 2 options")
        return {"question": data.question.strip(), "options": options}
    if kind == "meetup":
        if not data.title or not data.title.strip():
            raise HTTPException(status_code=400, detail="Meetup needs a title")
        return {"title": data.title.strip(), "meta": (data.meta or "").strip()}
    if kind == "expense":
        if not data.title or not data.title.strip() or data.total_amount is None or not data.participant_count:
            raise HTTPException(status_code=400, detail="Expense needs a title, total amount and participant count")
        if data.total_amount < 0 or data.participant_count < 1:
            raise HTTPException(status_code=400, detail="Expense amount and participant count must be positive")
        return {
            "title": data.title.strip(),
            "meta": (data.meta or "").strip(),
            "total_amount": data.total_amount,
            "participant_count": data.participant_count,
            "notes": (data.notes or "").strip() or None,
        }
    if kind == "place":
        if not data.title or not data.title.strip() or not data.image:
            raise HTTPException(status_code=400, detail="Place needs a title and an image")
        return {
            "image": data.image,
            "title": data.title.strip(),
            "meta": (data.meta or "").strip(),
            "cta_label": (data.cta_label or "Add to my trip").strip(),
        }
    raise HTTPException(status_code=400, detail=f"Invalid message kind, must be one of {sorted(MESSAGE_KINDS)}")


async def _require_membership(session, space_id: UUID, customer_id: UUID) -> CommunitySpace:
    space = await session.get(CommunitySpace, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Circle not found")
    member = (await session.execute(
        select(SpaceMember).where(SpaceMember.space_id == space_id, SpaceMember.customer_id == customer_id)
    )).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this circle")
    return space


async def _broadcast_to_space(session, space_id: UUID, event_type: str, payload: dict) -> None:
    member_ids = (await session.execute(
        select(SpaceMember.customer_id).where(SpaceMember.space_id == space_id)
    )).scalars().all()
    for customer_id in member_ids:
        try:
            await ws_manager.broadcast_to_user(str(customer_id), {"type": event_type, "data": payload})
        except Exception:
            logger.warning("Failed to broadcast %s to user %s", event_type, customer_id, exc_info=True)


async def _profiles_by_id(session, customer_ids: set[UUID]) -> dict:
    if not customer_ids:
        return {}
    profiles = (await session.execute(
        select(CommunityProfile).where(CommunityProfile.customer_id.in_(customer_ids))
    )).scalars().all()
    return {p.customer_id: p for p in profiles}


def _serialize_message(
    msg: SpaceMessage,
    profile_map: dict,
    poll_tallies: dict, my_votes: dict,
    rsvp_counts: dict, my_rsvp: dict,
    settled_counts: dict, my_settled: set,
    added_counts: dict, my_added: set,
) -> dict:
    sender = profile_map.get(msg.sender_id)
    content = msg.content or {}
    base = {
        "id": str(msg.id),
        "space_id": str(msg.space_id),
        "sender_id": str(msg.sender_id),
        "sender_name": sender.name if sender and sender.name else "Traveler",
        "sender_avatar": sender.avatar_url if sender else None,
        "kind": msg.kind,
        "created_at": iso_utc(msg.created_at),
    }
    if msg.kind == "text":
        base["text"] = content.get("text")
    elif msg.kind == "poll":
        base["question"] = content.get("question")
        base["options"] = content.get("options", [])
        base["votes"] = poll_tallies.get(msg.id, {})
        base["my_vote"] = my_votes.get(msg.id)
    elif msg.kind == "meetup":
        base["title"] = content.get("title")
        base["meta"] = content.get("meta")
        base["rsvp_counts"] = rsvp_counts.get(msg.id, {"in": 0, "out": 0})
        base["my_rsvp"] = my_rsvp.get(msg.id)
    elif msg.kind == "expense":
        base["title"] = content.get("title")
        base["meta"] = content.get("meta")
        base["total_amount"] = content.get("total_amount")
        base["participant_count"] = content.get("participant_count")
        base["notes"] = content.get("notes")
        base["settled_count"] = settled_counts.get(msg.id, 0)
        base["is_settled_by_me"] = msg.id in my_settled
    elif msg.kind == "place":
        base["image"] = content.get("image")
        base["title"] = content.get("title")
        base["meta"] = content.get("meta")
        base["cta_label"] = content.get("cta_label")
        base["added_count"] = added_counts.get(msg.id, 0)
        base["is_added_by_me"] = msg.id in my_added
    return base


@router.get("/{space_id}/messages")
async def list_messages(
    space_id: UUID, request: Request, limit: int = 50, offset: int = 0,
    auth: dict = Depends(require_customer),
):
    customer_id = UUID(auth["customer_id"])
    limit = max(1, min(limit, 100))
    async with request.app.state.session_factory() as session:
        await _require_membership(session, space_id, customer_id)

        messages = list((await session.execute(
            select(SpaceMessage).where(SpaceMessage.space_id == space_id)
            .order_by(desc(SpaceMessage.created_at)).limit(limit).offset(offset)
        )).scalars().all())
        messages.reverse()
        if not messages:
            return []

        message_ids = [m.id for m in messages]

        poll_tallies: dict[UUID, dict[str, int]] = {}
        for mid, option, count in (await session.execute(
            select(SpaceMessagePollVote.message_id, SpaceMessagePollVote.option, func.count(SpaceMessagePollVote.id))
            .where(SpaceMessagePollVote.message_id.in_(message_ids))
            .group_by(SpaceMessagePollVote.message_id, SpaceMessagePollVote.option)
        )).all():
            poll_tallies.setdefault(mid, {})[option] = count
        my_votes = dict((await session.execute(
            select(SpaceMessagePollVote.message_id, SpaceMessagePollVote.option)
            .where(SpaceMessagePollVote.message_id.in_(message_ids), SpaceMessagePollVote.customer_id == customer_id)
        )).all())

        rsvp_counts: dict[UUID, dict[str, int]] = {}
        for mid, status, count in (await session.execute(
            select(SpaceMessageMeetupRsvp.message_id, SpaceMessageMeetupRsvp.status, func.count(SpaceMessageMeetupRsvp.id))
            .where(SpaceMessageMeetupRsvp.message_id.in_(message_ids))
            .group_by(SpaceMessageMeetupRsvp.message_id, SpaceMessageMeetupRsvp.status)
        )).all():
            rsvp_counts.setdefault(mid, {"in": 0, "out": 0})[status] = count
        my_rsvp = dict((await session.execute(
            select(SpaceMessageMeetupRsvp.message_id, SpaceMessageMeetupRsvp.status)
            .where(SpaceMessageMeetupRsvp.message_id.in_(message_ids), SpaceMessageMeetupRsvp.customer_id == customer_id)
        )).all())

        settled_counts = dict((await session.execute(
            select(SpaceMessageExpenseSettlement.message_id, func.count(SpaceMessageExpenseSettlement.id))
            .where(SpaceMessageExpenseSettlement.message_id.in_(message_ids))
            .group_by(SpaceMessageExpenseSettlement.message_id)
        )).all())
        my_settled = set((await session.execute(
            select(SpaceMessageExpenseSettlement.message_id)
            .where(SpaceMessageExpenseSettlement.message_id.in_(message_ids), SpaceMessageExpenseSettlement.customer_id == customer_id)
        )).scalars().all())

        added_counts = dict((await session.execute(
            select(SpaceMessagePlaceAdd.message_id, func.count(SpaceMessagePlaceAdd.id))
            .where(SpaceMessagePlaceAdd.message_id.in_(message_ids))
            .group_by(SpaceMessagePlaceAdd.message_id)
        )).all())
        my_added = set((await session.execute(
            select(SpaceMessagePlaceAdd.message_id)
            .where(SpaceMessagePlaceAdd.message_id.in_(message_ids), SpaceMessagePlaceAdd.customer_id == customer_id)
        )).scalars().all())

        profile_map = await _profiles_by_id(session, {m.sender_id for m in messages})

        return [
            _serialize_message(
                m, profile_map,
                poll_tallies, my_votes,
                rsvp_counts, my_rsvp,
                settled_counts, my_settled,
                added_counts, my_added,
            )
            for m in messages
        ]


@router.post("/{space_id}/messages", dependencies=[Depends(rate_limiter("space-message-send", 60, 60))])
async def create_message(space_id: UUID, data: CreateMessageRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    content = _build_content(data)

    async with request.app.state.session_factory() as session:
        space = await _require_membership(session, space_id, customer_id)

        msg = SpaceMessage(space_id=space_id, sender_id=customer_id, kind=data.kind, content=content)
        session.add(msg)
        space.last_activity_at = datetime.utcnow()
        await session.commit()
        await session.refresh(msg)

        profile_map = await _profiles_by_id(session, {customer_id})
        serialized = _serialize_message(msg, profile_map, {}, {}, {}, {}, {}, set(), {}, set())

        await _broadcast_to_space(session, space_id, "space_message", serialized)
        return serialized


@router.post("/{space_id}/messages/{message_id}/vote", dependencies=[Depends(rate_limiter("space-message-vote", 60, 60))])
async def vote_poll(space_id: UUID, message_id: UUID, data: VoteRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        await _require_membership(session, space_id, customer_id)

        msg = await session.get(SpaceMessage, message_id)
        if not msg or msg.space_id != space_id or msg.kind != "poll":
            raise HTTPException(status_code=404, detail="Poll not found")
        options = (msg.content or {}).get("options", [])
        if data.option not in options:
            raise HTTPException(status_code=400, detail="Invalid poll option")

        existing = (await session.execute(
            select(SpaceMessagePollVote).where(SpaceMessagePollVote.message_id == message_id, SpaceMessagePollVote.customer_id == customer_id)
        )).scalar_one_or_none()
        if existing:
            existing.option = data.option
        else:
            session.add(SpaceMessagePollVote(message_id=message_id, customer_id=customer_id, option=data.option))
        await session.commit()

        votes = dict((await session.execute(
            select(SpaceMessagePollVote.option, func.count(SpaceMessagePollVote.id))
            .where(SpaceMessagePollVote.message_id == message_id)
            .group_by(SpaceMessagePollVote.option)
        )).all())
        payload = {"message_id": str(message_id), "votes": votes, "customer_id": str(customer_id)}
        await _broadcast_to_space(session, space_id, "space_poll_vote", payload)
        return payload


@router.post("/{space_id}/messages/{message_id}/rsvp", dependencies=[Depends(rate_limiter("space-message-rsvp", 60, 60))])
async def rsvp_meetup(space_id: UUID, message_id: UUID, data: RsvpRequest, request: Request, auth: dict = Depends(require_customer)):
    if data.status not in ("in", "out"):
        raise HTTPException(status_code=400, detail="status must be 'in' or 'out'")
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        await _require_membership(session, space_id, customer_id)

        msg = await session.get(SpaceMessage, message_id)
        if not msg or msg.space_id != space_id or msg.kind != "meetup":
            raise HTTPException(status_code=404, detail="Meetup not found")

        existing = (await session.execute(
            select(SpaceMessageMeetupRsvp).where(SpaceMessageMeetupRsvp.message_id == message_id, SpaceMessageMeetupRsvp.customer_id == customer_id)
        )).scalar_one_or_none()
        if existing:
            existing.status = data.status
        else:
            session.add(SpaceMessageMeetupRsvp(message_id=message_id, customer_id=customer_id, status=data.status))
        await session.commit()

        rsvp_counts = {"in": 0, "out": 0}
        for status, count in (await session.execute(
            select(SpaceMessageMeetupRsvp.status, func.count(SpaceMessageMeetupRsvp.id))
            .where(SpaceMessageMeetupRsvp.message_id == message_id)
            .group_by(SpaceMessageMeetupRsvp.status)
        )).all():
            rsvp_counts[status] = count
        payload = {"message_id": str(message_id), "rsvp_counts": rsvp_counts, "customer_id": str(customer_id), "status": data.status}
        await _broadcast_to_space(session, space_id, "space_meetup_rsvp", payload)
        return payload


@router.post("/{space_id}/messages/{message_id}/settle", dependencies=[Depends(rate_limiter("space-message-settle", 60, 60))])
async def settle_expense(space_id: UUID, message_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        await _require_membership(session, space_id, customer_id)

        msg = await session.get(SpaceMessage, message_id)
        if not msg or msg.space_id != space_id or msg.kind != "expense":
            raise HTTPException(status_code=404, detail="Expense not found")

        existing = (await session.execute(
            select(SpaceMessageExpenseSettlement).where(SpaceMessageExpenseSettlement.message_id == message_id, SpaceMessageExpenseSettlement.customer_id == customer_id)
        )).scalar_one_or_none()
        if not existing:
            session.add(SpaceMessageExpenseSettlement(message_id=message_id, customer_id=customer_id))
            await session.commit()

        count = (await session.execute(
            select(func.count(SpaceMessageExpenseSettlement.id)).where(SpaceMessageExpenseSettlement.message_id == message_id)
        )).scalar() or 0
        payload = {"message_id": str(message_id), "settled_count": count, "customer_id": str(customer_id)}
        await _broadcast_to_space(session, space_id, "space_expense_settle", payload)
        return payload


@router.post("/{space_id}/messages/{message_id}/add-place", dependencies=[Depends(rate_limiter("space-message-add-place", 60, 60))])
async def add_place_to_trip(space_id: UUID, message_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        await _require_membership(session, space_id, customer_id)

        msg = await session.get(SpaceMessage, message_id)
        if not msg or msg.space_id != space_id or msg.kind != "place":
            raise HTTPException(status_code=404, detail="Place message not found")

        existing = (await session.execute(
            select(SpaceMessagePlaceAdd).where(SpaceMessagePlaceAdd.message_id == message_id, SpaceMessagePlaceAdd.customer_id == customer_id)
        )).scalar_one_or_none()
        if not existing:
            session.add(SpaceMessagePlaceAdd(message_id=message_id, customer_id=customer_id))
            await session.commit()

        count = (await session.execute(
            select(func.count(SpaceMessagePlaceAdd.id)).where(SpaceMessagePlaceAdd.message_id == message_id)
        )).scalar() or 0
        payload = {"message_id": str(message_id), "added_count": count, "customer_id": str(customer_id)}
        await _broadcast_to_space(session, space_id, "space_place_add", payload)
        return payload
