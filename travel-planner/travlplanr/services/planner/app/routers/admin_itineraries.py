"""
Admin itinerary management endpoints — planner service.
Replaces the hardcoded itineraryList array in itinerary.component.ts.
"""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from app.models.trips import Trip, TripStatus
from app.models.community import CommunityProfile
from shared.auth_dependencies import require_staff
import uuid

router = APIRouter()


# Allowed status transitions for staff edits. Same-status is always allowed (no-op).
ALLOWED_TRANSITIONS: dict[TripStatus, set[TripStatus]] = {
    TripStatus.DRAFT: {TripStatus.GENERATING, TripStatus.READY, TripStatus.CREATED, TripStatus.PENDING, TripStatus.CANCELLED},
    TripStatus.GENERATING: {TripStatus.READY, TripStatus.CREATED, TripStatus.CANCELLED},
    TripStatus.READY: {TripStatus.CREATED, TripStatus.PENDING, TripStatus.BOOKED, TripStatus.CANCELLED},
    TripStatus.CREATED: {TripStatus.READY, TripStatus.PENDING, TripStatus.BOOKED, TripStatus.CANCELLED},
    TripStatus.PENDING: {TripStatus.CREATED, TripStatus.BOOKED, TripStatus.CANCELLED},
    TripStatus.BOOKED: {TripStatus.CANCELLED},
    TripStatus.CANCELLED: set(),
}


class ItineraryListResponse(BaseModel):
    kpis: dict[str, int]
    items: list[dict]
    page: int
    page_size: int
    total: int
    total_pages: int


@router.get("", response_model=ItineraryListResponse)
async def list_itineraries(
    request: Request,
    period: str = Query("last_30d"),
    status_filter: str = Query("all", alias="status"),
    sort: str = Query("-created_at"),
    q: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: dict = Depends(require_staff),
):
    """List itineraries with real pagination — replaces hardcoded of 80."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        base = select(Trip).where(Trip.tenant_id == tenant_id)

        if status_filter != "all":
            try:
                base = base.where(Trip.status == TripStatus(status_filter.lower()))
            except ValueError:
                pass

        if q:
            term = f"%{q}%"
            base = base.where(
                or_(
                    Trip.customer_name.ilike(term),
                    Trip.destination.ilike(term),
                    Trip.display_code.ilike(term),
                )
            )

        # Count total
        count_q = select(func.count()).select_from(base.subquery())
        total = (await session.execute(count_q)).scalar() or 0

        # Sort
        if sort == "-created_at":
            base = base.order_by(Trip.created_at.desc())
        else:
            base = base.order_by(Trip.created_at.desc())

        # Paginate
        offset = (page - 1) * page_size
        base = base.offset(offset).limit(page_size)

        result = await session.execute(base)
        rows = result.scalars().all()

        customer_ids = [trip.customer_id for trip in rows]
        profiles = {}
        if customer_ids:
            prof_res = await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id.in_(customer_ids)))
            for prof in prof_res.scalars().all():
                profiles[prof.customer_id] = prof.avatar_url

        items = []
        for trip in rows:
            duration = "Unknown"
            if trip.city_days:
                nights = sum(city.get("nights", 0) for city in trip.city_days)
                duration = f"{nights + 1} Days, {nights} Nights"

            items.append({
                "id": str(trip.id),
                "customerName": trip.customer_name,
                "customerId": str(trip.customer_id),
                "destination": trip.destination,
                "duration": duration,
                "travelDates": f"{trip.start_date} - {trip.end_date}",
                "traveler": f"{trip.travelers} Traveler{'s' if trip.travelers > 1 else ''}",
                "type": trip.travel_style or "Standard",
                "status": trip.status.value.capitalize(),
                "departureReturn": trip.start_date,
                "title": trip.title,
                "curator": "Unassigned",  # P4 assigning logic
                "curatorPhone": "",
                "displayCode": trip.display_code,
                "customerAvatar": profiles.get(trip.customer_id) or "/assets/images/default-avatar.svg",
            })

        # KPIs
        kpi_base = select(Trip).where(Trip.tenant_id == tenant_id)
        total_all = (await session.execute(select(func.count()).select_from(kpi_base.subquery()))).scalar() or 0
        
        # Helper to count by status
        async def count_status(status_val):
            q = select(func.count()).select_from(kpi_base.where(Trip.status == status_val).subquery())
            return (await session.execute(q)).scalar() or 0

        kpis = {
            "total": total_all,
            "pending": await count_status(TripStatus.PENDING),
            "created": await count_status(TripStatus.CREATED) + await count_status(TripStatus.READY) + await count_status(TripStatus.DRAFT),
            "booked": await count_status(TripStatus.BOOKED),
        }

        total_pages = max(1, (total + page_size - 1) // page_size)

        return ItineraryListResponse(
            kpis=kpis,
            items=items,
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )


@router.get("/recent")
async def recent_itineraries(request: Request, limit: int = Query(5), auth: dict = Depends(require_staff)):
    """Top N itineraries by created_at DESC — powers dashboard Recent Itineraries."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(Trip).where(Trip.tenant_id == tenant_id).order_by(Trip.created_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        
        items = []
        for trip in rows:
            items.append({
                "id": str(trip.id),
                "title": trip.title,
                "customerName": trip.customer_name,
                "status": trip.status.value.capitalize(),
                "destination": trip.destination,
                "created_at": trip.created_at.isoformat() if trip.created_at else None,
            })
            
        return {"items": items}


class CreateItineraryRequest(BaseModel):
    customer_id: str
    customer_name: str = ""
    destination: str
    dates: str = ""
    travelers: str = "2"
    budget: str = "Standard"

@router.post("")
async def create_itinerary(body: CreateItineraryRequest, request: Request, auth: dict = Depends(require_staff)):
    """Create a new itinerary manually from the admin portal."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        customer_uuid = uuid.UUID(body.customer_id) if body.customer_id else uuid.uuid4()

        # Generate ITIN display code (mirrors customer trip creation)
        count_res = await session.execute(select(func.count()).select_from(Trip))
        itin_code = f"ITIN-{(count_res.scalar() or 0) + 1:04d}"

        trip = Trip(
            tenant_id=tenant_id,
            customer_id=customer_uuid,
            customer_name=body.customer_name or "Unknown Customer",
            display_code=itin_code,
            title=f"Trip to {body.destination}",
            destination=body.destination,
            start_date=body.dates.split(" - ")[0] if " - " in body.dates else body.dates,
            end_date=body.dates.split(" - ")[1] if " - " in body.dates else body.dates,
            travelers=int(body.travelers) if body.travelers.isdigit() else 2,
            budget=body.budget,
            status=TripStatus.DRAFT
        )
        session.add(trip)
        await session.commit()
        await session.refresh(trip)

        # Notify reporting so admin-created itineraries are counted
        from shared.events import DomainEvent, EventType, STREAM_PLANNER
        from shared.redis_client import emit_event
        event = DomainEvent(
            event_type=EventType.TRIP_CREATED,
            actor_user_id=auth.get("sub"),
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_uuid),
                "destination": trip.destination,
                "status": trip.status.value,
            },
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)

        return {"id": str(trip.id), "display_code": itin_code, "status": "created"}


@router.get("/{itinerary_id}")
async def get_itinerary(itinerary_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Itinerary detail — powers the admin modal."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(Trip).where(Trip.id == uuid.UUID(itinerary_id), Trip.tenant_id == tenant_id)
        )
        trip = result.scalar_one_or_none()
        if not trip:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Itinerary not found")
            
        return {
            "id": str(trip.id),
            "title": trip.title,
            "destination": trip.destination,
            "status": trip.status.value.capitalize(),
            "travelers": trip.travelers,
            "start_date": trip.start_date,
            "end_date": trip.end_date,
            "days": trip.days,
        }


@router.put("/{itinerary_id}")
async def update_itinerary(itinerary_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Update itinerary details."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(Trip).where(Trip.id == uuid.UUID(itinerary_id), Trip.tenant_id == tenant_id)
        )
        trip = result.scalar_one_or_none()
        if not trip:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Itinerary not found")
        
        body = await request.json()
        status_changed = False
        old_status = trip.status.value
        if "title" in body: trip.title = body["title"]
        if "destination" in body: trip.destination = body["destination"]
        if "status" in body:
            try:
                new_status = TripStatus(body["status"].lower())
            except ValueError:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail=f"Invalid status '{body['status']}'")
            if trip.status != new_status:
                allowed = ALLOWED_TRANSITIONS.get(trip.status, set())
                if new_status not in allowed:
                    from fastapi import HTTPException
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot change status from {trip.status.value} to {new_status.value}",
                    )
                trip.status = new_status
                status_changed = True
        if "days" in body: trip.days = body["days"]

        await session.commit()
        
        if status_changed:
            from shared.events import DomainEvent, EventType, STREAM_PLANNER
            from shared.redis_client import emit_event
            
            event = DomainEvent(
                event_type=EventType.TRIP_STATUS_CHANGED,
                actor_user_id=auth.get("sub"),
                subject_id=str(trip.id),
                tenant_id=str(tenant_id),
                payload={
                    "customer_id": str(trip.customer_id),
                    "destination": trip.destination,
                    "old_status": old_status,
                    "new_status": trip.status.value,
                },
            )
            await emit_event(request.app.state.redis, STREAM_PLANNER, event)

        return {"id": str(trip.id), "status": "updated"}


@router.delete("/{itinerary_id}")
async def delete_itinerary(itinerary_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Delete an itinerary."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(Trip).where(Trip.id == uuid.UUID(itinerary_id), Trip.tenant_id == tenant_id)
        )
        trip = result.scalar_one_or_none()
        if not trip:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Itinerary not found")
            
        await session.delete(trip)
        await session.commit()
        
        from shared.events import DomainEvent, EventType, STREAM_PLANNER
        from shared.redis_client import emit_event
        
        event = DomainEvent(
            event_type=EventType.TRIP_DELETED,
            actor_user_id=auth.get("sub"),
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={"status": trip.status.value},
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)

        return {"id": itinerary_id, "status": "deleted"}
