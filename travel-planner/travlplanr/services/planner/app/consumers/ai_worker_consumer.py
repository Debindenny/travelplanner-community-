"""
Consumer for AI Worker events in Planner service.
Listens to STREAM_AI_WORKER for generation.{completed,failed} and updates trips
so a trip always leaves the GENERATING state (READY on success, fallback plan on failure).
"""

import asyncio
import json
import logging
import uuid
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from shared.events import STREAM_AI_WORKER, EventType, DomainEvent, STREAM_PLANNER
from shared.redis_client import emit_event
from app.models.trips import Trip, TripStatus
from app.services.itinerary_image_service import enrich_itinerary_images
from app.services.itinerary_builder import build_days_from_segments, normalize_segments
from app.services.wizard_plan_builder import build_wizard_plan
from app.routers.websocket import broadcast_to_user

logger = logging.getLogger(__name__)


async def _broadcast_generation_event(event: DomainEvent, status: str) -> None:
    """Push a generation progress update to the trip owner's open sockets, if any."""
    customer_id = event.payload.get("customer_id")
    if not customer_id:
        return
    try:
        await broadcast_to_user(
            customer_id,
            "generation.progress",
            {
                "trip_id": event.subject_id,
                "status": status,
                "reason": event.payload.get("reason"),
            },
        )
    except Exception:
        logger.exception("failed to broadcast generation progress", extra={"trip_id": event.subject_id})


import os

def _build_fallback_plan(trip: Trip) -> dict:
    """Build a complete local itinerary when the AI worker cannot generate one."""
    custom = trip.customizations or {}
    return build_wizard_plan(
        destination=trip.destination,
        city_days=trip.city_days,
        start_date=trip.start_date,
        end_date=trip.end_date,
        travelers=trip.travelers,
        travel_style=trip.travel_style,
        travel_method=trip.travel_method,
        budget=trip.budget,
        interests=trip.interests or [],
        image=trip.image,
        departure_location=custom.get("departureLocation"),
        arrival_location=custom.get("arrivalLocation"),
    )


async def _apply_ready_trip(redis, session_factory, event: DomainEvent, segments: list[dict]):
    """Persist a ready itinerary (AI or fallback) and emit TRIP_UPDATED."""
    subject_id = event.subject_id
    if not subject_id:
        return

    async with session_factory() as session:
        try:
            result = await session.execute(
                select(Trip).where(Trip.id == uuid.UUID(subject_id))
            )
            trip = result.scalar_one_or_none()
            if not trip:
                logger.warning("trip not found for generation event", extra={"trip_id": subject_id})
                return

            trip.status = TripStatus.READY
            normalized_segments = normalize_segments(segments, trip)
            from app.services.travel_time_service import enrich_segments_with_travel_times

            normalized_segments = await enrich_segments_with_travel_times(normalized_segments)
            trip.segments = await enrich_itinerary_images(redis, trip, normalized_segments)
            flag_modified(trip, "segments")
            flag_modified(trip, "image")
            flag_modified(trip, "customizations")
            trip.days = build_days_from_segments(trip.segments, trip)

            if not trip.city_days:
                fallback = _build_fallback_plan(trip)
                if fallback.get("city_days"):
                    trip.city_days = fallback["city_days"]
                if not trip.start_date:
                    trip.start_date = fallback["start_date"]
                if not trip.end_date:
                    trip.end_date = fallback["end_date"]
            
            # Generate and save embedding for the finalized trip
            from app.services.embedding_service import generate_embedding
            prompt_text = f"Destination: {trip.destination}, Travelers: {trip.travelers}, Style: {trip.travel_style}, Method: {trip.travel_method}, Budget: {trip.budget}, Interests: {', '.join(trip.interests or [])}, Food: {', '.join(trip.food_preferences or [])}"
            try:
                vector_list = await generate_embedding(prompt_text)
                if vector_list:
                    trip.embedding = vector_list
            except Exception as e:
                logger.error(f"Failed to save embedding for trip {trip.id}: {e}")

            await session.commit()

            await emit_event(
                redis,
                STREAM_PLANNER,
                DomainEvent(
                    event_type=EventType.TRIP_UPDATED,
                    subject_id=str(trip.id),
                    tenant_id=str(trip.tenant_id),
                    payload={
                        "customer_id": str(trip.customer_id),
                        "title": trip.title,
                        "status": trip.status.value,
                    },
                ),
            )
            logger.info(
                "trip itinerary saved",
                extra={
                    "trip_id": subject_id,
                    "segment_count": len(trip.segments or []),
                    "source": event.payload.get("source", "ai"),
                },
            )
        except Exception:
            logger.exception("failed to apply ready trip", extra={"trip_id": subject_id})


async def process_ai_worker_events(redis, session_factory):
    group_name = "planner-ai-consumer-group"
    try:
        await redis.xgroup_create(STREAM_AI_WORKER, group_name, id="0", mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            logger.error("could not create consumer group", extra={"error": str(e)})

    logger.info("listening to ai-worker stream", extra={"group": group_name})
    
    block_ms = int(os.environ.get("REDIS_BLOCK_MS", "5000"))
    attempt = 0

    while True:
        try:
            messages = await redis.xreadgroup(
                groupname=group_name,
                consumername="planner-worker-1",
                streams={STREAM_AI_WORKER: ">"},
                count=10,
                block=block_ms,
            )
            attempt = 0  # reset on successful read

            for _stream_name, stream_messages in messages:
                for message_id, payload_data in stream_messages:
                    try:
                        try:
                            event_json = payload_data.get("event")
                            if not event_json:
                                continue
                            event = DomainEvent(**json.loads(event_json))
                        except Exception:
                            logger.exception("could not decode ai-worker event", extra={"message_id": message_id})
                            continue

                        if event.event_type == EventType.GENERATION_STARTED:
                            await _broadcast_generation_event(event, "started")
                        elif event.event_type == EventType.GENERATION_PROGRESS:
                            status_val = event.payload.get("status", "generating")
                            await _broadcast_generation_event(event, status_val)
                        elif event.event_type == EventType.GENERATION_COMPLETED:
                            segments = event.payload.get("segments") or []
                            await _apply_ready_trip(redis, session_factory, event, segments)
                            await _broadcast_generation_event(event, "completed")
                        elif event.event_type == EventType.GENERATION_FAILED:
                            try:
                                reason = event.payload.get("reason", "unknown")
                                logger.warning(
                                    "generation failed — applying fallback itinerary",
                                    extra={"trip_id": event.subject_id, "reason": reason[:200]},
                                )
                                await _broadcast_generation_event(event, "failed")
                                async with session_factory() as session:
                                    result = await session.execute(
                                        select(Trip).where(Trip.id == uuid.UUID(event.subject_id))
                                    )
                                    trip = result.scalar_one_or_none()
                                    if trip:
                                        fallback = _build_fallback_plan(trip)
                                        failed_event = DomainEvent(
                                            event_type=EventType.GENERATION_COMPLETED,
                                            subject_id=event.subject_id,
                                            tenant_id=event.tenant_id,
                                            payload={
                                                "customer_id": event.payload.get("customer_id", ""),
                                                "status": "ready",
                                                "segments": fallback["segments"],
                                                "source": "fallback",
                                                "reason": reason,
                                            },
                                        )
                                        await _apply_ready_trip(
                                            redis, session_factory, failed_event, fallback["segments"]
                                        )
                                        await _broadcast_generation_event(failed_event, "completed")
                            except Exception as e:
                                logger.exception("failed to process GENERATION_FAILED event", extra={"trip_id": event.subject_id, "error": str(e)})

                    finally:
                        await redis.xack(STREAM_AI_WORKER, group_name, message_id)

        except Exception as e:
            attempt += 1
            logger.error("error processing ai-worker events", extra={"error": str(e), "attempt": attempt})
            await asyncio.sleep(min(2 ** attempt, 60))


async def run_trip_generating_sweeper(redis, session_factory):
    """Periodically check for trips stuck in GENERATING status and apply fallback plan."""
    from datetime import datetime, timezone, timedelta
    
    logger.info("Starting trip generating status sweeper loop")
    
    while True:
        try:
            await asyncio.sleep(60)  # Run every 60 seconds
            
            async with session_factory() as session:
                cutoff = datetime.now(timezone.utc) - timedelta(seconds=180)
                stmt = select(Trip).where(
                    Trip.status == TripStatus.GENERATING,
                    Trip.updated_at < cutoff
                )
                result = await session.execute(stmt)
                stuck_trips = result.scalars().all()
                
                for trip in stuck_trips:
                    logger.warning(
                        "Found trip stuck in GENERATING status, applying fallback plan",
                        extra={"trip_id": str(trip.id), "updated_at": trip.updated_at.isoformat()}
                    )
                    try:
                        fallback = _build_fallback_plan(trip)
                        failed_event = DomainEvent(
                            event_type=EventType.GENERATION_COMPLETED,
                            subject_id=str(trip.id),
                            tenant_id=str(trip.tenant_id),
                            payload={
                                "customer_id": str(trip.customer_id),
                                "status": "ready",
                                "segments": fallback["segments"],
                                "source": "fallback",
                                "reason": "Generation timed out (stuck in GENERATING status)",
                            },
                        )
                        await _apply_ready_trip(redis, session_factory, failed_event, fallback["segments"])
                        await _broadcast_generation_event(failed_event, "failed")
                        await _broadcast_generation_event(failed_event, "completed")
                    except Exception as e:
                        logger.error(
                            "Failed to apply fallback to stuck trip",
                            extra={"trip_id": str(trip.id), "error": str(e)}
                        )
        except asyncio.CancelledError:
            logger.info("Trip generating status sweeper loop cancelled")
            break
        except Exception as e:
            logger.error("Error in trip generating status sweeper loop: %s", str(e))
            await asyncio.sleep(10)
