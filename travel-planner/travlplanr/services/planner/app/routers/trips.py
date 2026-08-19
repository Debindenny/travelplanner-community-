"""
Customer-facing trip CRUD — planner service.
Replaces localStorage 'travlplanr_trips' in the customer app.
"""

from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Request, Depends, HTTPException, status, BackgroundTasks, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm.attributes import flag_modified
from shared.auth_dependencies import require_customer
from app.utils.auth import require_trip_role
from shared.events import DomainEvent, EventType, STREAM_PLANNER
from shared.redis_client import emit_event
from shared.fx import convert_response

from app.models.trips import Trip, TripStatus, TripVersion
from app.services.itinerary_builder import build_days_from_segments, normalize_segments
from app.services.itinerary_image_service import enrich_itinerary_images
from app.services.wizard_plan_builder import build_wizard_plan
from app.services.embedding_service import generate_embedding
from app.services.trip_versions import snapshot_trip

import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _trip_duration_days(city_days: list[dict[str, Any]] | None, start_date: str, end_date: str) -> int:
    """Total trip days from city-night splits or explicit dates."""
    if city_days:
        total_nights = sum(max(int(c.get("nights", 1)), 1) for c in city_days)
        return max(total_nights + 1, 1)
    try:
        from datetime import datetime

        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        return max((end - start).days + 1, 1)
    except ValueError as e:
        logger.warning("Failed to parse start_date '%s' or end_date '%s', falling back to 4 days: %s", start_date, end_date, str(e))
        return 4


def _format_trip_title(destinations: list[str], start_date: str, end_date: str) -> str:
    place = (destinations[0].strip() if destinations else "") or "Unknown"
    try:
        from datetime import datetime

        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Cross-platform alternative to glibc %-d format specifier
        start_label = f"{start.strftime('%b')} {start.day}, {start.strftime('%Y')}"
        end_label = f"{end.strftime('%b')} {end.day}, {end.strftime('%Y')}"
        return f"{place} Trip - {start_label} to {end_label}"
    except ValueError:
        return f"{place} Trip"


class TripCreateBody(BaseModel):
    destinations: list[str] = Field(min_length=1)
    startDate: str
    endDate: str
    travelers: int = Field(ge=1, le=50)
    travelStyle: str
    travelMethod: str
    budget: str
    interests: list[str]
    foodPreferences: list[str]
    aiDates: bool | None = False
    cityDays: list[dict[str, Any]] | None = None
    departureLocation: str | None = None
    arrivalLocation: str | None = None
    coverageTier: str | None = "full"


@router.get("")
async def list_trips(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    auth: dict = Depends(require_customer),
):
    """List trips for the authenticated customer (paginated)."""
    customer_id_str = auth.get("customer_id")
    if not customer_id_str:
        return {"items": [], "total": 0}

    async with request.app.state.session_factory() as session:
        customer_uuid = uuid.UUID(customer_id_str)
        base = select(Trip).where(Trip.customer_id == customer_uuid, Trip.status != TripStatus.CANCELLED)
        total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0

        offset = (page - 1) * page_size
        result = await session.execute(
            base.order_by(Trip.created_at.desc()).offset(offset).limit(page_size)
        )
        trips = result.scalars().all()

        items = []
        for t in trips:
            items.append({
                "id": str(t.id),
                "title": t.title,
                "destination": t.destination,
                "startDate": t.start_date,
                "endDate": t.end_date,
                "travelers": t.travelers,
                "travelStyle": t.travel_style,
                "travelMethod": t.travel_method,
                "budget": t.budget,
                "interests": t.interests,
                "foodPreferences": t.food_preferences,
                "status": t.status.value,
                "image": t.image,
                "days": t.days or [],
                "cityDays": t.city_days or [],
                "segments": t.segments or [],
                "customizations": t.customizations or {},
                "createdAt": t.created_at.isoformat(),
                "coverageTier": getattr(t, "coverage_tier", "full") or "full",
            })

        redis = getattr(request.app.state, "redis", None)
        converted = await convert_response({"items": items, "total": total}, request, redis)
        return converted


@router.get("/{trip_id}")
async def get_trip(
    trip_id: uuid.UUID,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor", "viewer"]))
):
    """Get a specific trip by ID."""
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(Trip).where(Trip.id == trip_id)
        )
        t = result.scalar_one_or_none()
        if not t:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        payload = {
            "id": str(t.id),
            "title": t.title,
            "destination": t.destination,
            "startDate": t.start_date,
            "endDate": t.end_date,
            "travelers": t.travelers,
            "travelStyle": t.travel_style,
            "travelMethod": t.travel_method,
            "budget": t.budget,
            "interests": t.interests,
            "foodPreferences": t.food_preferences,
            "status": t.status.value,
            "image": t.image,
            "days": t.days or [],
            "cityDays": t.city_days or [],
            "segments": t.segments or [],
            "customizations": t.customizations or {},
            "createdAt": t.created_at.isoformat(),
            "is_confirmed": getattr(t, "is_confirmed", False),
            "coverageTier": getattr(t, "coverage_tier", "full") or "full",
        }
        redis = getattr(request.app.state, "redis", None)
        return await convert_response(payload, request, redis)

@router.get("/{trip_id}/versions")
async def list_trip_versions(
    trip_id: uuid.UUID,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor", "viewer"])),
):
    """List saved itinerary snapshots for a trip, newest first — see TripVersion."""
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        versions = await session.execute(
            select(TripVersion)
            .where(TripVersion.trip_id == trip_id)
            .order_by(TripVersion.version_number.desc())
        )
        return [
            {
                "id": str(v.id),
                "versionNumber": v.version_number,
                "reason": v.reason,
                "title": v.title,
                "segmentCount": len(v.segments or []),
                "createdAt": v.created_at.isoformat(),
            }
            for v in versions.scalars()
        ]


@router.get("/{trip_id}/versions/{version_id}")
async def get_trip_version(
    trip_id: uuid.UUID,
    version_id: uuid.UUID,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor", "viewer"])),
):
    """Fetch the full snapshot payload for one saved version."""
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(TripVersion).where(
                TripVersion.id == version_id, TripVersion.trip_id == trip_id
            )
        )
        v = result.scalar_one_or_none()
        if not v:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip version not found")

        payload = {
            "id": str(v.id),
            "versionNumber": v.version_number,
            "reason": v.reason,
            "title": v.title,
            "days": v.days or [],
            "cityDays": v.city_days or [],
            "segments": v.segments or [],
            "customizations": v.customizations or {},
            "createdAt": v.created_at.isoformat(),
        }
        redis = getattr(request.app.state, "redis", None)
        return await convert_response(payload, request, redis)


@router.post("/{trip_id}/versions/{version_id}/restore")
async def restore_trip_version(
    trip_id: uuid.UUID,
    version_id: uuid.UUID,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor"])),
):
    """Roll a trip's itinerary back to a previously saved version.

    The trip's current state is snapshotted first, so the restore itself is undoable.
    """
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_id = uuid.UUID(auth["customer_id"])

    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        version_result = await session.execute(
            select(TripVersion).where(
                TripVersion.id == version_id, TripVersion.trip_id == trip_id
            )
        )
        version = version_result.scalar_one_or_none()
        if not version:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip version not found")

        await snapshot_trip(session, trip, reason="pre_restore")

        trip.title = version.title
        trip.days = version.days
        trip.city_days = version.city_days
        trip.segments = version.segments
        trip.customizations = version.customizations

        if hasattr(trip, "version"):
            trip.version += 1

        from app.models.collaboration import TripActivity
        activity = TripActivity(
            trip_id=trip.id,
            actor_id=customer_id,
            actor_name=auth.get("display_name") or auth.get("email") or "Unknown",
            action="restore_version",
            summary=f"Restored version {version.version_number}",
            meta={"versionNumber": version.version_number, "versionId": str(version.id)},
        )
        session.add(activity)

        event = DomainEvent(
            event_type=EventType.TRIP_EDITED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            actor_user_id=str(customer_id),
            payload={
                "customer_id": str(customer_id),
                "title": trip.title,
                "restored_version": version.version_number,
            },
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        return {
            "id": str(trip.id),
            "status": trip.status.value,
            "restoredVersionNumber": version.version_number,
        }


def _travelers_from_style(travel_style: str | None, travelers: int) -> int:
    """Align headcount with the selected travel group when the client sends a stale default."""
    style = (travel_style or "").lower()
    style_defaults = {"solo": 1, "couple": 2, "family": 4, "friends": 2}
    if style in style_defaults:
        return style_defaults[style]
    return max(travelers, 1)


@router.post("")
async def create_trip(body: TripCreateBody, request: Request, background_tasks: BackgroundTasks, auth: dict = Depends(require_customer)):
    """Create a trip from wizard state."""
    customer_id = uuid.UUID(auth["customer_id"])
    customer_name = auth.get("customer_name", "Unknown")
    tenant_id = uuid.UUID(auth["tenant_id"])

    # Enforce plan limit
    import httpx
    try:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            async with httpx.AsyncClient() as client:
                resp = await client.get("http://identity:8000/api/v1/me/plan", headers={"Authorization": auth_header})
                if resp.status_code == 200:
                    plan_data = resp.json()
                    if plan_data.get("plans_used", 0) >= plan_data.get("plans_limit", 2):
                        raise HTTPException(status.HTTP_403_FORBIDDEN, "Plan limit reached. Please upgrade to create more trips.")
    except httpx.RequestError as exc:
        # Fail CLOSED: if the plan limit can't be verified (identity unreachable),
        # do not allow unmetered trip creation — surface a retryable error instead.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Unable to verify your plan right now. Please try again shortly.",
        ) from exc

    async with request.app.state.session_factory() as session:
        # Generate ITIN code with a random suffix to avoid concurrency conflicts
        import secrets
        from sqlalchemy import func
        count_res = await session.execute(select(func.count()).select_from(Trip))
        random_suffix = "".join(secrets.choice("0123456789") for _ in range(4))
        itin_code = f"ITIN-{(count_res.scalar() or 0) + 1:04d}-{random_suffix}"

        trip = Trip(
            tenant_id=tenant_id,
            customer_id=customer_id,
            customer_name=customer_name,
            display_code=itin_code,
            title=_format_trip_title(body.destinations, body.startDate, body.endDate),
            destination=", ".join(body.destinations) if body.destinations else "Unknown",
            start_date=body.startDate,
            end_date=body.endDate,
            travelers=_travelers_from_style(body.travelStyle, body.travelers),
            travel_style=body.travelStyle,
            travel_method=body.travelMethod,
            budget=body.budget,
            interests=body.interests,
            food_preferences=body.foodPreferences,
            status=TripStatus.GENERATING,
            image="assets/images/landing/journey-thailand.jpg",
            days=[],  # AI Worker populates this
            city_days=body.cityDays or [],
            coverage_tier=(body.coverageTier or "full").lower(),
            customizations={
                "departureLocation": body.departureLocation,
                "arrivalLocation": body.arrivalLocation
                or (body.destinations[-1] if body.destinations else None),
            },
        )
        session.add(trip)
        await session.flush()
        
        # Add owner collaborator record
        from app.models.collaboration import TripCollaborator
        owner = TripCollaborator(
            trip_id=trip.id,
            user_id=customer_id,
            email=auth.get("email", ""),  # Fallback if email is missing
            display_name=customer_name,
            role="owner",
            status="active",
            invited_by=customer_id,  # owner self-invited; column is NOT NULL
        )
        session.add(owner)

        event = DomainEvent(
            event_type=EventType.TRIP_CREATED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "destination": trip.destination,
                "status": trip.status.value,
            }
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        # Emit GENERATION_REQUESTED to AI Worker
        from shared.events import STREAM_AI_WORKER
        
        # Determine RAG examples from Postgres using pgvector
        rag_examples = []
        prompt_text = f"Destination: {trip.destination}, Travelers: {trip.travelers}, Style: {trip.travel_style}, Method: {trip.travel_method}, Budget: {trip.budget}, Interests: {', '.join(trip.interests or [])}, Food: {', '.join(trip.food_preferences or [])}"
        try:
            vector_list = await generate_embedding(prompt_text)
            if vector_list:
                similar_trips = await session.execute(
                    select(Trip)
                    .where(Trip.embedding.is_not(None))
                    .where(Trip.status == TripStatus.READY)
                    # Never draw RAG examples from another tenant's private trips.
                    .where(Trip.tenant_id == tenant_id)
                    .order_by(Trip.embedding.l2_distance(vector_list))
                    .limit(2)
                )
                for t in similar_trips.scalars():
                    if t.segments:
                        import json
                        rag_examples.append({
                            "title": t.title,
                            "destination": t.destination,
                            "travelers": t.travelers,
                            "budget": t.budget,
                            "interests": t.interests,
                            "segments": t.segments,
                        })
        except Exception as e:
            logger.error(f"Failed to fetch RAG examples: {e}")

        place_research = None
        coverage_tier = (trip.coverage_tier or "full").lower()
        primary_destination = body.destinations[0] if body.destinations else trip.destination
        if coverage_tier == "draft" and primary_destination:
            try:
                from app.services.place_research_service import research_place

                place_research = await research_place(
                    primary_destination,
                    interests=list(trip.interests or []),
                )
                logger.info(
                    "Draft trip place research completed for %s (sources=%s)",
                    primary_destination,
                    place_research.get("sources"),
                )
            except Exception as exc:
                logger.warning("Place research failed for %s: %s", primary_destination, exc)

        gen_event = DomainEvent(
            event_type=EventType.GENERATION_REQUESTED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "destination": trip.destination,
                "travelers": trip.travelers,
                "budget": trip.budget,
                "interests": trip.interests,
                "duration_days": _trip_duration_days(trip.city_days, trip.start_date, trip.end_date),
                "city_days": trip.city_days,
                "travel_method": trip.travel_method,
                "food_preferences": trip.food_preferences,
                "start_date": trip.start_date,
                "end_date": trip.end_date,
                "departure_location": body.departureLocation,
                "arrival_location": body.arrivalLocation,
                "rag_examples": rag_examples,
                "coverage_tier": coverage_tier,
                "place_research": place_research,
            }
        )
        await emit_event(request.app.state.redis, STREAM_AI_WORKER, gen_event)

        return {"id": str(trip.id), "status": trip.status.value}


@router.post("/{trip_id}/cancel")
async def cancel_trip(
    trip_id: uuid.UUID,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor"]))
):
    """
    Cancel a trip (OTA Self-Service Cancellation).
    """
    async with request.app.state.session_factory() as session:
        trip = (
            await session.execute(
                select(Trip).where(Trip.id == trip_id)
            )
        ).scalar_one_or_none()
        
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
            
        if trip.status == TripStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="Trip is already cancelled")

        # Update status
        old_status = trip.status.value
        trip.status = TripStatus.CANCELLED
        await session.commit()

        # Emit Domain Event for downstream processing (e.g. Refunds, Reporting).
        # Uses TRIP_STATUS_CHANGED (not TRIP_DELETED) so reporting's status-count
        # rollup can move this trip from its old bucket into "cancelled".
        cancelled_event = DomainEvent(
            event_type=EventType.TRIP_STATUS_CHANGED,
            actor_user_id=auth.get("sub"),
            subject_id=str(trip.id),
            tenant_id=str(trip.tenant_id),
            payload={
                "customer_id": str(trip.customer_id),
                "destination": trip.destination,
                "old_status": old_status,
                "new_status": trip.status.value,
            },
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, cancelled_event)
        
        return {"message": "Trip cancelled successfully", "status": trip.status.value}


@router.post("/{trip_id}/rebuild")
async def rebuild_trip_itinerary(
    trip_id: uuid.UUID,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor"]))
):
    """Rebuild a missing/failed itinerary locally (fallback when AI is unavailable)."""
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_id = uuid.UUID(auth["customer_id"])  # Use customer_id from payload for events

    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        if trip.customizations and trip.customizations.get("packageId"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Package itineraries cannot be rebuilt")

        if trip.segments:
            await snapshot_trip(session, trip, reason="rebuild")

        corrected_travelers = _travelers_from_style(trip.travel_style, trip.travelers or 1)
        trip.travelers = corrected_travelers
        custom = trip.customizations or {}

        plan = build_wizard_plan(
            destination=trip.destination,
            city_days=trip.city_days,
            start_date=trip.start_date,
            end_date=trip.end_date,
            travelers=corrected_travelers,
            travel_style=trip.travel_style,
            travel_method=trip.travel_method,
            budget=trip.budget,
            interests=trip.interests or [],
            image=trip.image,
            departure_location=custom.get("departureLocation"),
            arrival_location=custom.get("arrivalLocation"),
        )

        trip.segments = normalize_segments(plan["segments"], trip)
        redis = getattr(request.app.state, "redis", None)
        trip.segments = await enrich_itinerary_images(redis, trip, trip.segments)
        flag_modified(trip, "segments")
        flag_modified(trip, "image")
        flag_modified(trip, "customizations")
        trip.days = build_days_from_segments(trip.segments, trip)
        trip.city_days = plan["city_days"]
        trip.start_date = plan["start_date"]
        trip.end_date = plan["end_date"]
        trip.status = TripStatus.READY

        event = DomainEvent(
            event_type=EventType.TRIP_UPDATED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "title": trip.title,
                "status": trip.status.value,
                "source": "rebuild",
            },
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        return {
            "id": str(trip.id),
            "status": trip.status.value,
            "segmentCount": len(trip.segments or []),
        }


class RegenerateBody(BaseModel):
    day: int | None = None
    style: str | None = None
    departureLocation: str | None = None
    arrivalLocation: str | None = None


def _pin_flight_route(
    segments: list[dict],
    *,
    dep_code: str | None,
    arr_code: str | None,
    dep_location: str | None = None,
    arr_location: str | None = None,
) -> list[dict]:
    """Rewrite outbound/return flight airports without regenerating the whole trip."""
    if not dep_code and not arr_code:
        return segments
    updated = [dict(s) for s in segments]
    flights = [s for s in updated if (s.get("type") or "").lower() == "flight"]
    if not flights:
        return updated
    outbound = min(flights, key=lambda s: int(s.get("day") or 1))
    inbound = max(flights, key=lambda s: int(s.get("day") or 1))
    if dep_code:
        outbound["depCode"] = dep_code
        outbound["depLocation"] = dep_location or dep_code
    if arr_code:
        outbound["arrCode"] = arr_code
        outbound["arrLocation"] = arr_location or arr_code
    if inbound is not outbound:
        if arr_code:
            inbound["depCode"] = arr_code
            inbound["depLocation"] = arr_location or arr_code
        if dep_code:
            inbound["arrCode"] = dep_code
            inbound["arrLocation"] = dep_location or dep_code
    return updated


@router.post("/{trip_id}/regenerate")
async def regenerate_trip_itinerary(
    trip_id: uuid.UUID,
    request: Request,
    body: RegenerateBody | None = None,
    auth: dict = Depends(require_trip_role(["owner", "editor"])),
):
    """Trigger full AI regeneration (or day-focused rewrite) via the AI worker.

    Route-only corrections (departure/arrival city) are applied surgically —
    including on package itineraries, which otherwise reject full regen.
    """
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_id = uuid.UUID(auth["customer_id"])

    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        if getattr(trip, "is_confirmed", False):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Confirmed itineraries cannot be regenerated")

        from shared.airports import resolve_airport_code
        from shared.events import STREAM_AI_WORKER

        regen_day = body.day if body else None
        regen_style = body.style if body else None
        custom = dict(trip.customizations or {})
        if body and body.departureLocation:
            custom["departureLocation"] = body.departureLocation
        if body and body.arrivalLocation:
            custom["arrivalLocation"] = body.arrivalLocation

        departure_location = custom.get("departureLocation")
        arrival_location = custom.get("arrivalLocation") or trip.destination
        departure_airport = await resolve_airport_code(departure_location) if departure_location else None
        arrival_airport = await resolve_airport_code(arrival_location) if arrival_location else None
        if departure_airport:
            custom["departureAirport"] = departure_airport
        if arrival_airport:
            custom["arrivalAirport"] = arrival_airport

        is_package = bool(custom.get("packageId"))
        route_correction = bool(
            body and (body.departureLocation or body.arrivalLocation) and not regen_day
        )

        # Package trips block full AI rewrite, but "starting from Bangalore" must
        # still update outbound/return flights.
        if route_correction and (departure_airport or arrival_airport):
            if trip.segments:
                await snapshot_trip(session, trip, reason="route_correction")
            trip.customizations = custom or None
            trip.segments = _pin_flight_route(
                list(trip.segments or []),
                dep_code=departure_airport,
                arr_code=arrival_airport,
                dep_location=departure_location,
                arr_location=arrival_location,
            )
            trip.days = build_days_from_segments(trip.segments, trip)
            trip.status = TripStatus.READY
            await session.commit()
            logger.info(
                "route correction applied",
                extra={
                    "trip_id": str(trip.id),
                    "departure_airport": departure_airport,
                    "arrival_airport": arrival_airport,
                    "package": is_package,
                },
            )
            return {
                "id": str(trip.id),
                "status": trip.status.value,
                "regenerating": False,
                "routeUpdated": True,
                "departureAirport": departure_airport,
                "arrivalAirport": arrival_airport,
            }

        if is_package:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Package itineraries cannot be regenerated")

        if trip.segments:
            await snapshot_trip(session, trip, reason="regenerate")

        # Persist route + GENERATING in one commit so customizations aren't lost
        # when the session closes (previously status was committed first and the
        # departure city never stuck).
        trip.customizations = custom or None
        trip.status = TripStatus.GENERATING
        await session.commit()

        # Determine RAG examples from Postgres using pgvector
        rag_examples = []
        prompt_text = f"Destination: {trip.destination}, Travelers: {trip.travelers}, Style: {trip.travel_style}, Method: {trip.travel_method}, Budget: {trip.budget}, Interests: {', '.join(trip.interests or [])}, Food: {', '.join(trip.food_preferences or [])}"
        try:
            vector_list = await generate_embedding(prompt_text)
            if vector_list:
                similar_trips = await session.execute(
                    select(Trip)
                    .where(Trip.embedding.is_not(None))
                    .where(Trip.id != trip.id)
                    .where(Trip.status == TripStatus.READY)
                    # Never draw RAG examples from another tenant's private trips.
                    .where(Trip.tenant_id == tenant_id)
                    .order_by(Trip.embedding.l2_distance(vector_list))
                    .limit(2)
                )
                for t in similar_trips.scalars():
                    if t.segments:
                        rag_examples.append({
                            "title": t.title,
                            "destination": t.destination,
                            "travelers": t.travelers,
                            "budget": t.budget,
                            "interests": t.interests,
                            "segments": t.segments,
                        })
        except Exception as e:
            logger.error(f"Failed to fetch RAG examples for regen: {e}")

        place_research = None
        coverage_tier = (trip.coverage_tier or "full").lower()
        if coverage_tier == "draft" and trip.destination:
            try:
                from app.services.place_research_service import research_place

                place_research = await research_place(
                    trip.destination,
                    interests=list(trip.interests or []),
                )
            except Exception as exc:
                logger.warning("Place research failed on regen for %s: %s", trip.destination, exc)

        gen_event = DomainEvent(
            event_type=EventType.GENERATION_REQUESTED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "destination": trip.destination,
                "travelers": trip.travelers,
                "budget": trip.budget,
                "interests": trip.interests,
                "duration_days": _trip_duration_days(trip.city_days, trip.start_date, trip.end_date),
                "city_days": trip.city_days,
                "travel_method": trip.travel_method,
                "food_preferences": trip.food_preferences,
                "start_date": trip.start_date,
                "end_date": trip.end_date,
                "regenerate_day": regen_day,
                "regenerate_style": regen_style,
                "departure_location": departure_location,
                "arrival_location": arrival_location,
                "departure_airport": departure_airport,
                "arrival_airport": arrival_airport,
                "rag_examples": rag_examples,
                "coverage_tier": coverage_tier,
                "place_research": place_research,
            },
        )
        await emit_event(request.app.state.redis, STREAM_AI_WORKER, gen_event)

        return {"id": str(trip.id), "status": trip.status.value, "regenerating": True}


class TripUpdateBody(BaseModel):
    """Validated body for trip updates. All fields optional — only supplied fields are applied."""
    title: str | None = Field(default=None, max_length=300)
    days: list[dict] | None = None
    cityDays: list[dict] | None = None
    segments: list[dict] | None = None
    customizations: dict | None = None
    startDate: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    endDate: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    travelers: int | None = Field(default=None, ge=1, le=50)
    version: int | None = None
    section_versions: dict[str, int] | None = None

    model_config = {"extra": "forbid"}


@router.put("/{trip_id}")
async def update_trip(
    trip_id: uuid.UUID,
    body: TripUpdateBody,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor"]))
):
    """Update a trip."""
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_id = uuid.UUID(auth["customer_id"])

    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        # Only operate on the fields that were explicitly provided
        provided = body.model_dump(exclude_unset=True)
        
        # Optimistic Concurrency Control (Document Version)
        if "version" in provided:
            if getattr(trip, "version", 0) != provided["version"]:
                raise HTTPException(status.HTTP_409_CONFLICT, "Trip has been modified by another user. Please refresh.")
                
        # Granular Section Concurrency
        incoming_sections = provided.get("section_versions", {})
        current_sections = trip.section_versions or {}
        new_sections = current_sections.copy()
        
        has_conflicts = False
        for section, incoming_version in incoming_sections.items():
            db_version = current_sections.get(section, 0)
            if incoming_version < db_version:
                has_conflicts = True
                break
            # Increment the version for the updated section
            new_sections[section] = db_version + 1
            
        if has_conflicts:
            raise HTTPException(
                status.HTTP_409_CONFLICT, 
                "A specific section you are editing was modified by someone else. Please refresh."
            )
            
        if "title" in provided: trip.title = provided["title"]
        if "days" in provided: trip.days = provided["days"]
        if "cityDays" in provided: trip.city_days = provided["cityDays"]
        if "segments" in provided: trip.segments = provided["segments"]
        if "customizations" in provided: trip.customizations = provided["customizations"]
        if "startDate" in provided and provided["startDate"]:
            trip.start_date = provided["startDate"]
        if "endDate" in provided and provided["endDate"]:
            trip.end_date = provided["endDate"]
        if "travelers" in provided and provided["travelers"] is not None:
            trip.travelers = provided["travelers"]

        # Save updated granular versions
        if incoming_sections:
            trip.section_versions = new_sections
        
        if hasattr(trip, "version"):
            trip.version += 1

        # Record activity
        from app.models.collaboration import TripActivity
        activity = TripActivity(
            trip_id=trip.id,
            actor_id=customer_id,
            actor_name=auth.get("display_name") or auth.get("email") or "Unknown",
            action="update_trip",
            summary="Updated trip",
            meta={"fields": list(provided.keys())},
        )
        session.add(activity)

        event = DomainEvent(
            event_type=EventType.TRIP_EDITED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            actor_user_id=str(customer_id),
            payload={
                "customer_id": str(customer_id),
                "title": trip.title,
                "sections_modified": list(incoming_sections.keys()) if incoming_sections else []
            }
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        return {"id": str(trip.id), "status": trip.status.value}


@router.delete("/{trip_id}")
async def delete_trip(
    trip_id: uuid.UUID,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner"]))
):
    """Delete a trip."""
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_id = uuid.UUID(auth["customer_id"])

    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
        
        # Hard DELETE guard for shared trips: 
        # Only owners can delete, and maybe we shouldn't hard-delete if shared, 
        # but for now we enforce owner-only at the role level.


        status_val = trip.status.value
        trip.status = TripStatus.CANCELLED

        event = DomainEvent(
            event_type=EventType.TRIP_DELETED,
            subject_id=str(trip_id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "status": status_val,
            }
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        return {"id": str(trip_id), "status": "cancelled"}


class SegmentStatusUpdate(BaseModel):
    status: str

@router.patch("/{trip_id}/segments/{idx}")
async def update_segment_status(
    trip_id: uuid.UUID,
    idx: int,
    body: SegmentStatusUpdate,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor"]))
):
    """Update the status of a specific segment."""
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_id = uuid.UUID(auth["customer_id"])

    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        segments = trip.segments or []
        if idx < 0 or idx >= len(segments):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Segment not found")

        segments[idx]["status"] = body.status
        trip.segments = list(segments)
        
        if hasattr(trip, "version"):
            trip.version += 1
            
        # Record activity
        from app.models.collaboration import TripActivity
        activity = TripActivity(
            trip_id=trip.id,
            actor_id=customer_id,
            actor_name=auth.get("display_name") or auth.get("email") or "Unknown",
            action="update_segment",
            summary=f"Updated segment {idx}",
            meta={"segment_idx": idx, "status": body.status},
        )
        session.add(activity)

        event = DomainEvent(
            event_type=EventType.TRIP_UPDATED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "segment_idx": idx,
                "segment_status": body.status
            }
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        return {"id": str(trip_id), "segment_idx": idx, "status": body.status}


class SegmentReorderBody(BaseModel):
    from_index: int
    to_index: int


@router.post("/{trip_id}/segments/reorder")
async def reorder_segments(
    trip_id: uuid.UUID,
    body: SegmentReorderBody,
    request: Request,
    auth: dict = Depends(require_trip_role(["owner", "editor"]))
):
    """Reorder segments (drag-and-drop support)."""
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_id = uuid.UUID(auth["customer_id"])

    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Trip).where(Trip.id == trip_id))
        trip = result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")

        segments = list(trip.segments or [])
        n = len(segments)
        if body.from_index < 0 or body.from_index >= n or body.to_index < 0 or body.to_index >= n:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid segment indices")

        # Reorder segment
        segment = segments.pop(body.from_index)
        segments.insert(body.to_index, segment)
        trip.segments = segments
        
        # Recalculate days from segments
        trip.days = build_days_from_segments(trip.segments, trip)

        if hasattr(trip, "version"):
            trip.version += 1

        # Record activity
        from app.models.collaboration import TripActivity
        activity = TripActivity(
            trip_id=trip.id,
            actor_id=customer_id,
            actor_name=auth.get("display_name") or auth.get("email") or "Unknown",
            action="reorder_segments",
            summary=f"Reordered segments from {body.from_index} to {body.to_index}",
            meta={"from_index": body.from_index, "to_index": body.to_index},
        )
        session.add(activity)

        event = DomainEvent(
            event_type=EventType.TRIP_UPDATED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "action": "reorder_segments",
            }
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        return {"id": str(trip_id), "segments": trip.segments, "days": trip.days}
