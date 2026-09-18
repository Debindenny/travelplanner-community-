"""
Hosted-journey itinerary, activity booking, transport and payment
participation endpoints. Mounted at the same prefix as community_meetups
(/api/v1/community/meetups) — see event_bookings.py for why event_id is an
opaque string rather than a FK into community_meetups.id.
"""
import secrets
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func

from shared.auth_dependencies import optional_customer, require_customer
from app.models.event_bookings import (
    EventItineraryDay, EventItineraryActivity, EventActivitySelection,
    EventActivityBooking, EventTransportSegment, EventJourneyParticipation,
)
from app.utils.lock_rules import is_locked_activity

router = APIRouter()


class SelectionRequest(BaseModel):
    included: bool


class ChangeActivityRequest(BaseModel):
    newActivityId: UUID


class TransportRequest(BaseModel):
    afterDay: int
    mode: str
    title: str
    time: str | None = None
    notes: str | None = None
    price: int | None = None


class ParticipationRequest(BaseModel):
    mode: str
    rangeStart: int | None = None
    rangeEnd: int | None = None


class PayRequest(BaseModel):
    amount: int


class LinkTripRequest(BaseModel):
    tripId: UUID


class ActivityInput(BaseModel):
    title: str
    time: str
    category: str
    duration: str
    rating: float
    image: str
    price: int | None = None
    capacity: int | None = None
    included: bool = True
    # Card-type discriminator + its kind-specific fields — see
    # EventItineraryActivity.kind/.extra and journeyActivityToTripSegment()
    # on the frontend for what `extra` holds per kind.
    kind: str | None = None
    extra: dict | None = None


class DayInput(BaseModel):
    day: int
    city: str
    dateLabel: str
    price: int
    activities: list[ActivityInput]


class CreateItineraryRequest(BaseModel):
    days: list[DayInput]


def _serialize_activity(
    activity: EventItineraryActivity,
    selection: EventActivitySelection | None,
    booking: EventActivityBooking | None,
) -> dict:
    result = {
        "id": str(activity.id),
        "title": activity.title,
        "time": activity.time,
        "category": activity.category,
        "duration": activity.duration,
        "rating": activity.rating,
        "image": activity.image,
        "price": activity.price,
        "capacity": activity.capacity,
        "bookedCount": activity.booked_count,
        "included": selection.included if selection else activity.default_included,
        "booked": bool(booking and booking.status == "booked"),
    }
    # Flight/hotel/bus/train card fields — flattened onto the response (not
    # nested) to match the frontend's flat JourneyActivity shape. Absent
    # (None) for a plain activity, so old rows with no `kind`/`extra` still
    # serialize exactly as before.
    if activity.kind:
        result["kind"] = activity.kind
    if activity.extra:
        result.update(activity.extra)
    return result


def _serialize_transport(t: EventTransportSegment) -> dict:
    return {
        "id": str(t.id),
        "afterDay": t.after_day,
        "mode": t.mode,
        "title": t.title,
        "time": t.time,
        "notes": t.notes,
        "price": t.price,
    }


def _serialize_participation(p: EventJourneyParticipation) -> dict:
    return {
        "eventId": p.event_id,
        "mode": p.mode,
        "rangeStart": p.range_start,
        "rangeEnd": p.range_end,
        "paymentStatus": p.payment_status,
        "amountPaid": p.amount_paid,
        "bookingReference": p.booking_reference,
        "tripId": str(p.trip_id) if p.trip_id else None,
    }


@router.post("/{event_id}/itinerary")
async def create_itinerary(
    event_id: str,
    body: CreateItineraryRequest,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Host publishes (or republishes) the day-by-day itinerary for a hosted
    event — see EventHostAssistantService.createEvent() on the frontend.
    Replaces any existing days/activities for this event_id outright (a host
    resubmitting the same event should overwrite, not duplicate); the CASCADE
    on event_itinerary_activities.day_id takes any selections/bookings against
    the old activity rows with it. That's fine today since nothing calls this
    a second time for an event travelers have already interacted with — if
    that changes, this should diff instead of replace.
    """
    async with request.app.state.session_factory() as session:
        existing_days = (
            await session.execute(
                select(EventItineraryDay).where(EventItineraryDay.event_id == event_id)
            )
        ).scalars().all()
        for d in existing_days:
            await session.delete(d)
        await session.flush()

        for day_in in body.days:
            day = EventItineraryDay(
                event_id=event_id,
                day_number=day_in.day,
                city=day_in.city,
                date_label=day_in.dateLabel,
                price=day_in.price,
            )
            session.add(day)
            await session.flush()
            for a in day_in.activities:
                session.add(EventItineraryActivity(
                    day_id=day.id,
                    title=a.title,
                    time=a.time,
                    category=a.category,
                    duration=a.duration,
                    rating=a.rating,
                    image=a.image,
                    price=a.price,
                    capacity=a.capacity,
                    default_included=a.included,
                    kind=a.kind,
                    extra=a.extra,
                ))

        await session.commit()

    return {"eventId": event_id, "days": len(body.days)}


@router.get("/{event_id}/itinerary")
async def get_itinerary(event_id: str, request: Request, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None

    async with request.app.state.session_factory() as session:
        days = (
            await session.execute(
                select(EventItineraryDay)
                .where(EventItineraryDay.event_id == event_id)
                .order_by(EventItineraryDay.day_number.asc())
            )
        ).scalars().all()
        if not days:
            return {"days": [], "transport": []}

        day_ids = [d.id for d in days]
        activities = (
            await session.execute(
                select(EventItineraryActivity)
                .where(EventItineraryActivity.day_id.in_(day_ids))
                .order_by(EventItineraryActivity.time.asc())
            )
        ).scalars().all()
        activity_ids = [a.id for a in activities]

        selections_by_activity: dict[UUID, EventActivitySelection] = {}
        bookings_by_activity: dict[UUID, EventActivityBooking] = {}
        transport: list[EventTransportSegment] = []

        if customer_id and activity_ids:
            selections = (
                await session.execute(
                    select(EventActivitySelection).where(
                        EventActivitySelection.customer_id == customer_id,
                        EventActivitySelection.activity_id.in_(activity_ids),
                    )
                )
            ).scalars().all()
            selections_by_activity = {s.activity_id: s for s in selections}

            bookings = (
                await session.execute(
                    select(EventActivityBooking).where(
                        EventActivityBooking.customer_id == customer_id,
                        EventActivityBooking.activity_id.in_(activity_ids),
                    )
                )
            ).scalars().all()
            bookings_by_activity = {b.activity_id: b for b in bookings}

        if customer_id:
            transport = (
                await session.execute(
                    select(EventTransportSegment)
                    .where(
                        EventTransportSegment.event_id == event_id,
                        EventTransportSegment.customer_id == customer_id,
                    )
                    .order_by(EventTransportSegment.after_day.asc())
                )
            ).scalars().all()

        activities_by_day: dict[UUID, list[EventItineraryActivity]] = {}
        for a in activities:
            activities_by_day.setdefault(a.day_id, []).append(a)

        return {
            "days": [
                {
                    "id": str(d.id),
                    "day": d.day_number,
                    "city": d.city,
                    "dateLabel": d.date_label,
                    "price": d.price,
                    "activities": [
                        _serialize_activity(
                            a, selections_by_activity.get(a.id), bookings_by_activity.get(a.id)
                        )
                        for a in activities_by_day.get(d.id, [])
                    ],
                }
                for d in days
            ],
            "transport": [_serialize_transport(t) for t in transport],
        }


@router.put("/{event_id}/activities/{activity_id}/selection")
async def set_activity_selection(
    event_id: str, activity_id: UUID, data: SelectionRequest, request: Request,
    auth: dict = Depends(require_customer),
):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        activity = (
            await session.execute(select(EventItineraryActivity).where(EventItineraryActivity.id == activity_id))
        ).scalar_one_or_none()
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        selection = (
            await session.execute(
                select(EventActivitySelection).where(
                    EventActivitySelection.customer_id == customer_id,
                    EventActivitySelection.activity_id == activity_id,
                )
            )
        ).scalar_one_or_none()

        if selection:
            selection.included = data.included
        else:
            session.add(
                EventActivitySelection(
                    customer_id=customer_id, event_id=event_id, activity_id=activity_id, included=data.included
                )
            )
        await session.commit()
        return {"activityId": str(activity_id), "included": data.included}


@router.post("/{event_id}/activities/{activity_id}/book")
async def toggle_activity_booking(
    event_id: str, activity_id: UUID, request: Request, auth: dict = Depends(require_customer),
):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        activity = (
            await session.execute(select(EventItineraryActivity).where(EventItineraryActivity.id == activity_id))
        ).scalar_one_or_none()
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        existing = (
            await session.execute(
                select(EventActivityBooking).where(
                    EventActivityBooking.customer_id == customer_id,
                    EventActivityBooking.activity_id == activity_id,
                )
            )
        ).scalar_one_or_none()

        if existing and existing.status == "booked":
            existing.status = "cancelled"
            activity.booked_count = max(0, activity.booked_count - 1)
            booked = False
        else:
            if activity.capacity is not None and activity.booked_count >= activity.capacity:
                raise HTTPException(status_code=409, detail="This activity is fully booked")
            if existing:
                existing.status = "booked"
                existing.booked_at = datetime.utcnow()
            else:
                # Find the day number for denormalized display on the booking row.
                day = (
                    await session.execute(select(EventItineraryDay).where(EventItineraryDay.id == activity.day_id))
                ).scalar_one_or_none()
                session.add(
                    EventActivityBooking(
                        customer_id=customer_id,
                        event_id=event_id,
                        activity_id=activity_id,
                        day_number=day.day_number if day else 0,
                        status="booked",
                        price_paid=activity.price,
                    )
                )
            activity.booked_count += 1
            booked = True

        await session.commit()
        await session.refresh(activity)
        return {"activityId": str(activity_id), "booked": booked, "bookedCount": activity.booked_count, "capacity": activity.capacity}


@router.post("/{event_id}/activities/{activity_id}/change")
async def change_activity(
    event_id: str, activity_id: UUID, data: ChangeActivityRequest, request: Request,
    auth: dict = Depends(require_customer),
):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        old_activity = (
            await session.execute(select(EventItineraryActivity).where(EventItineraryActivity.id == activity_id))
        ).scalar_one_or_none()
        new_activity = (
            await session.execute(select(EventItineraryActivity).where(EventItineraryActivity.id == data.newActivityId))
        ).scalar_one_or_none()
        if not old_activity or not new_activity:
            raise HTTPException(status_code=404, detail="Activity not found")
        if old_activity.day_id != new_activity.day_id:
            raise HTTPException(status_code=400, detail="Replacement activity must be on the same day")
        if is_locked_activity(old_activity.kind, old_activity.title) or is_locked_activity(new_activity.kind, new_activity.title):
            raise HTTPException(status_code=403, detail="This booking is fixed and cannot be modified individually.")

        for target_id, included in ((activity_id, False), (data.newActivityId, True)):
            selection = (
                await session.execute(
                    select(EventActivitySelection).where(
                        EventActivitySelection.customer_id == customer_id,
                        EventActivitySelection.activity_id == target_id,
                    )
                )
            ).scalar_one_or_none()
            if selection:
                selection.included = included
            else:
                session.add(
                    EventActivitySelection(
                        customer_id=customer_id, event_id=event_id, activity_id=target_id, included=included
                    )
                )

        await session.commit()
        return {
            "old": {"activityId": str(activity_id), "included": False},
            "new": {"activityId": str(data.newActivityId), "included": True},
        }


@router.post("/{event_id}/transport")
async def add_transport(event_id: str, data: TransportRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        segment = EventTransportSegment(
            customer_id=customer_id,
            event_id=event_id,
            after_day=data.afterDay,
            mode=data.mode,
            title=data.title,
            time=data.time,
            notes=data.notes,
            price=data.price,
        )
        session.add(segment)
        await session.commit()
        await session.refresh(segment)
        return _serialize_transport(segment)


@router.delete("/{event_id}/transport/{transport_id}")
async def remove_transport(event_id: str, transport_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        segment = (
            await session.execute(select(EventTransportSegment).where(EventTransportSegment.id == transport_id))
        ).scalar_one_or_none()
        if not segment:
            raise HTTPException(status_code=404, detail="Transport segment not found")
        if segment.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="You can only remove your own transport segments")
        await session.delete(segment)
        await session.commit()
        return {"status": "success"}


@router.post("/{event_id}/participation")
async def start_participation(event_id: str, data: ParticipationRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        participation = (
            await session.execute(
                select(EventJourneyParticipation).where(
                    EventJourneyParticipation.customer_id == customer_id,
                    EventJourneyParticipation.event_id == event_id,
                )
            )
        ).scalar_one_or_none()

        if participation:
            if participation.payment_status != "paid":
                participation.mode = data.mode
                participation.range_start = data.rangeStart
                participation.range_end = data.rangeEnd
        else:
            participation = EventJourneyParticipation(
                customer_id=customer_id,
                event_id=event_id,
                mode=data.mode,
                range_start=data.rangeStart,
                range_end=data.rangeEnd,
            )
            session.add(participation)

        await session.commit()
        await session.refresh(participation)
        return _serialize_participation(participation)


@router.get("/{event_id}/participation")
async def get_participation(event_id: str, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        participation = (
            await session.execute(
                select(EventJourneyParticipation).where(
                    EventJourneyParticipation.customer_id == customer_id,
                    EventJourneyParticipation.event_id == event_id,
                )
            )
        ).scalar_one_or_none()
        if not participation:
            raise HTTPException(status_code=404, detail="No participation found for this event")
        return _serialize_participation(participation)


@router.post("/{event_id}/participation/pay")
async def pay_participation(event_id: str, data: PayRequest, request: Request, auth: dict = Depends(require_customer)):
    """Simulated payment confirmation — no external gateway. Marks the participation paid."""
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        participation = (
            await session.execute(
                select(EventJourneyParticipation).where(
                    EventJourneyParticipation.customer_id == customer_id,
                    EventJourneyParticipation.event_id == event_id,
                )
            )
        ).scalar_one_or_none()
        if not participation:
            raise HTTPException(status_code=404, detail="No participation found for this event")

        participation.payment_status = "paid"
        participation.amount_paid = data.amount
        participation.booking_reference = participation.booking_reference or f"TP-{secrets.token_hex(4).upper()}"
        await session.commit()
        await session.refresh(participation)
        return _serialize_participation(participation)


@router.patch("/{event_id}/participation/trip")
async def link_participation_trip(event_id: str, data: LinkTripRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        participation = (
            await session.execute(
                select(EventJourneyParticipation).where(
                    EventJourneyParticipation.customer_id == customer_id,
                    EventJourneyParticipation.event_id == event_id,
                )
            )
        ).scalar_one_or_none()
        if not participation:
            raise HTTPException(status_code=404, detail="No participation found for this event")

        participation.trip_id = data.tripId
        await session.commit()
        await session.refresh(participation)
        return _serialize_participation(participation)
