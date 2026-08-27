from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func, or_

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import CommunityMeetup, MeetupRsvp, CommunityProfile

router = APIRouter()

# Small grace window so a client whose clock is a few seconds behind the
# server (or who submits the form right as the minute ticks over) isn't
# rejected for a "past" starts_at that is, practically speaking, "now".
PAST_GRACE_WINDOW = timedelta(minutes=5)
VALID_RSVP_STATUSES = ("going", "interested", "declined")
VALID_CATEGORIES = ("meetup", "food", "online")

# Meetups/RSVPs don't require an account: a signed-in customer is identified by
# their JWT, everyone else by a UUID the frontend generates once per browser and
# sends on this header. `customer_id` on CommunityMeetup/MeetupRsvp has no FK
# constraint, so a guest UUID is a legitimate identity as far as this table cares.
GUEST_ID_HEADER = "x-guest-id"


async def customer_or_guest(
    request: Request,
    auth: dict | None = Depends(optional_customer),
) -> UUID:
    """Resolve the acting identity for a write (host/RSVP), signed-in or not."""
    if auth and "customer_id" in auth:
        return UUID(auth["customer_id"])
    guest_id = request.headers.get(GUEST_ID_HEADER)
    if not guest_id:
        raise HTTPException(status_code=400, detail=f"Missing {GUEST_ID_HEADER} header for an anonymous request")
    try:
        return UUID(guest_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {GUEST_ID_HEADER} header")


async def customer_or_guest_optional(
    request: Request,
    auth: dict | None = Depends(optional_customer),
) -> UUID | None:
    """Same as `customer_or_guest`, but for reads — no identity is fine too."""
    if auth and "customer_id" in auth:
        return UUID(auth["customer_id"])
    guest_id = request.headers.get(GUEST_ID_HEADER)
    if not guest_id:
        return None
    try:
        return UUID(guest_id)
    except ValueError:
        return None


class ScheduleStep(BaseModel):
    time: str = ""
    text: str

    @field_validator("text")
    @classmethod
    def _text_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Schedule step text cannot be empty")
        return v.strip()


class CreateMeetupRequest(BaseModel):
    title: str
    description: str | None = None
    location: str | None = None
    cost: str | None = None
    capacity: int | None = None
    schedule: list[ScheduleStep] | None = None
    what_to_bring: str | None = None
    category: str | None = None
    meeting_link: str | None = None
    image_url: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def _title_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()

    @field_validator("category")
    @classmethod
    def _category_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in VALID_CATEGORIES:
            raise ValueError(f"category must be one of {VALID_CATEGORIES}")
        return v


class RsvpRequest(BaseModel):
    status: str


def _naive_utc(dt: datetime) -> datetime:
    """Normalize a possibly-aware datetime to naive UTC for comparison with
    naive DB values / naive utcnow()."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def _get_attendee_counts(session, meetup_ids: list[UUID]) -> dict[UUID, int]:
    """attendee_count = number of RSVPs with status == 'going'."""
    if not meetup_ids:
        return {}
    rows = (await session.execute(
        select(MeetupRsvp.meetup_id, func.count(MeetupRsvp.id))
        .where(MeetupRsvp.meetup_id.in_(meetup_ids), MeetupRsvp.status == "going")
        .group_by(MeetupRsvp.meetup_id)
    )).all()
    return {m_id: count for m_id, count in rows}


async def _get_viewer_rsvp_statuses(session, meetup_ids: list[UUID], customer_id: UUID | None) -> dict[UUID, str]:
    if not customer_id or not meetup_ids:
        return {}
    rows = (await session.execute(
        select(MeetupRsvp.meetup_id, MeetupRsvp.status)
        .where(MeetupRsvp.meetup_id.in_(meetup_ids), MeetupRsvp.customer_id == customer_id)
    )).all()
    return {m_id: status for m_id, status in rows}


async def _get_organizer_profiles(session, customer_ids: list[UUID]) -> dict[UUID, CommunityProfile]:
    if not customer_ids:
        return {}
    profiles = (await session.execute(
        select(CommunityProfile).where(CommunityProfile.customer_id.in_(customer_ids))
    )).scalars().all()
    return {p.customer_id: p for p in profiles}


def _serialize_meetup(
    meetup: CommunityMeetup,
    attendee_count: int,
    rsvp_status: str | None,
    organizer_profile: CommunityProfile | None,
) -> dict:
    return {
        "id": str(meetup.id),
        "title": meetup.title,
        "description": meetup.description,
        "location": meetup.location,
        "cost": meetup.cost,
        "capacity": meetup.capacity,
        "schedule": meetup.schedule,
        "what_to_bring": meetup.what_to_bring,
        "category": meetup.category,
        "meeting_link": meetup.meeting_link,
        "image_url": meetup.image_url,
        "starts_at": meetup.starts_at.isoformat(),
        "ends_at": meetup.ends_at.isoformat() if meetup.ends_at else None,
        "created_at": meetup.created_at.isoformat(),
        "organizer": {
            "id": str(meetup.customer_id),
            "name": (organizer_profile.name if organizer_profile and organizer_profile.name else "Traveler"),
            "avatar": organizer_profile.avatar_url if organizer_profile else None,
        },
        "attendee_count": attendee_count,
        "rsvp_status": rsvp_status,
    }


async def _serialize_meetups(session, meetups: list[CommunityMeetup], customer_id: UUID | None) -> list[dict]:
    if not meetups:
        return []
    meetup_ids = [m.id for m in meetups]
    organizer_ids = list({m.customer_id for m in meetups})
    attendee_counts = await _get_attendee_counts(session, meetup_ids)
    rsvp_statuses = await _get_viewer_rsvp_statuses(session, meetup_ids, customer_id)
    organizer_profiles = await _get_organizer_profiles(session, organizer_ids)
    return [
        _serialize_meetup(
            m,
            attendee_counts.get(m.id, 0),
            rsvp_statuses.get(m.id),
            organizer_profiles.get(m.customer_id),
        )
        for m in meetups
    ]


@router.post("", dependencies=[Depends(rate_limiter("meetup-create", 10, 3600))])
async def create_meetup(data: CreateMeetupRequest, request: Request, customer_id: UUID = Depends(customer_or_guest)):
    if len(data.title) > 255:
        raise HTTPException(status_code=400, detail="Title exceeds maximum length of 255 characters")
    if data.description is not None and len(data.description) > 2000:
        raise HTTPException(status_code=400, detail="Description exceeds maximum length of 2000 characters")
    if data.image_url is not None and not data.image_url.strip():
        raise HTTPException(status_code=400, detail="image_url cannot be empty")
    if data.what_to_bring is not None and len(data.what_to_bring) > 500:
        raise HTTPException(status_code=400, detail="what_to_bring exceeds maximum length of 500 characters")
    if data.capacity is not None and data.capacity < 1:
        raise HTTPException(status_code=400, detail="capacity must be a positive number")
    if data.meeting_link is not None and not data.meeting_link.strip():
        raise HTTPException(status_code=400, detail="meeting_link cannot be empty")

    starts_at = _naive_utc(data.starts_at)
    ends_at = _naive_utc(data.ends_at) if data.ends_at else None

    if starts_at < datetime.utcnow() - PAST_GRACE_WINDOW:
        raise HTTPException(status_code=400, detail="starts_at cannot be in the past")
    if ends_at and ends_at <= starts_at:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

    async with request.app.state.session_factory() as session:
        meetup = CommunityMeetup(
            customer_id=customer_id,
            title=data.title,
            description=data.description.strip() if data.description else None,
            location=data.location.strip() if data.location else None,
            cost=data.cost,
            capacity=data.capacity,
            schedule=[step.model_dump() for step in data.schedule] if data.schedule else None,
            what_to_bring=data.what_to_bring.strip() if data.what_to_bring else None,
            category=data.category,
            meeting_link=data.meeting_link.strip() if data.meeting_link else None,
            image_url=data.image_url,
            starts_at=starts_at,
            ends_at=ends_at,
        )
        session.add(meetup)
        await session.commit()
        await session.refresh(meetup)
        serialized = await _serialize_meetups(session, [meetup], customer_id)
        return serialized[0]


@router.get("")
async def list_meetups(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    customer_id: UUID | None = Depends(customer_or_guest_optional),
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    async with request.app.state.session_factory() as session:
        now = datetime.utcnow()
        query = (
            select(CommunityMeetup)
            .where(CommunityMeetup.starts_at >= now)
            .order_by(CommunityMeetup.starts_at.asc())
            .limit(limit + 1)
            .offset(offset)
        )
        meetups = (await session.execute(query)).scalars().all()
        has_more = len(meetups) > limit
        meetups = meetups[:limit]
        serialized = await _serialize_meetups(session, meetups, customer_id)
        return {"meetups": serialized, "has_more": has_more}


@router.get("/mine")
async def get_my_meetups(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        rsvpd_meetup_ids = select(MeetupRsvp.meetup_id).where(MeetupRsvp.customer_id == customer_id)
        query = (
            select(CommunityMeetup)
            .where(or_(CommunityMeetup.customer_id == customer_id, CommunityMeetup.id.in_(rsvpd_meetup_ids)))
            .order_by(CommunityMeetup.starts_at.asc())
        )
        meetups = (await session.execute(query)).scalars().all()
        return await _serialize_meetups(session, meetups, customer_id)


@router.get("/{meetup_id}")
async def get_meetup(
    meetup_id: UUID,
    request: Request,
    customer_id: UUID | None = Depends(customer_or_guest_optional),
):
    async with request.app.state.session_factory() as session:
        meetup = (await session.execute(select(CommunityMeetup).where(CommunityMeetup.id == meetup_id))).scalar_one_or_none()
        if not meetup:
            raise HTTPException(status_code=404, detail="Meetup not found")
        serialized = await _serialize_meetups(session, [meetup], customer_id)
        return serialized[0]


@router.post("/{meetup_id}/rsvp", dependencies=[Depends(rate_limiter("meetup-rsvp", 30, 60))])
async def rsvp_to_meetup(
    meetup_id: UUID,
    data: RsvpRequest,
    request: Request,
    customer_id: UUID = Depends(customer_or_guest),
):
    status = data.status.strip().lower()
    if status not in VALID_RSVP_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_RSVP_STATUSES}")

    async with request.app.state.session_factory() as session:
        meetup = (await session.execute(select(CommunityMeetup).where(CommunityMeetup.id == meetup_id))).scalar_one_or_none()
        if not meetup:
            raise HTTPException(status_code=404, detail="Meetup not found")

        existing = (await session.execute(
            select(MeetupRsvp).where(MeetupRsvp.meetup_id == meetup_id, MeetupRsvp.customer_id == customer_id)
        )).scalar_one_or_none()

        # Semantics: posting the same status you already have toggles the
        # RSVP off (un-RSVP). Posting a different status upserts to it.
        if existing:
            if existing.status == status:
                await session.delete(existing)
                current_status = None
            else:
                existing.status = status
                current_status = status
        else:
            session.add(MeetupRsvp(meetup_id=meetup_id, customer_id=customer_id, status=status))
            current_status = status

        await session.commit()
        return {"status": "success", "rsvp_status": current_status}


@router.delete("/{meetup_id}")
async def delete_meetup(meetup_id: UUID, request: Request, customer_id: UUID = Depends(customer_or_guest)):
    async with request.app.state.session_factory() as session:
        meetup = (await session.execute(select(CommunityMeetup).where(CommunityMeetup.id == meetup_id))).scalar_one_or_none()
        if not meetup:
            raise HTTPException(status_code=404, detail="Meetup not found")
        if meetup.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="You can only delete your own meetups")
        await session.delete(meetup)
        await session.commit()
        return {"status": "success", "message": "Meetup deleted"}
