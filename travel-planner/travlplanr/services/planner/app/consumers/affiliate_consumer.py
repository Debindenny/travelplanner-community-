import asyncio
import json
import logging
import uuid
from sqlalchemy import select
from shared.events import CONSUMER_GROUP_PLANNER, STREAM_AFFILIATE, EventType, DomainEvent, STREAM_PLANNER
from shared.redis_client import emit_event

logger = logging.getLogger(__name__)

async def start_affiliate_consumer(redis, session_factory):
    """Consume affiliate events for the planner service."""
    try:
        await redis.xgroup_create(STREAM_AFFILIATE, CONSUMER_GROUP_PLANNER, mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            logger.warning(f"Consumer group error: {e}")

    logger.info("Planner service affiliate consumer started.")
    from app.models.trips import Trip, TripStatus

    while True:
        try:
            messages = await redis.xreadgroup(
                CONSUMER_GROUP_PLANNER,
                "planner-affiliate-consumer-1",
                {STREAM_AFFILIATE: ">"},
                count=10,
                block=5000,
            )

            for stream, msgs in messages:
                for msg_id, msg_data in msgs:
                    try:
                        event_dict = json.loads(msg_data["event"])
                        event = DomainEvent(**event_dict)

                        if event.event_type == EventType.TRIP_BOOKED:
                            async with session_factory() as session:
                                trip_id_str = event.subject_id
                                if not trip_id_str:
                                    continue

                                try:
                                    tid = uuid.UUID(trip_id_str)
                                except ValueError:
                                    continue

                                result = await session.execute(
                                    select(Trip).where(Trip.id == tid)
                                )
                                trip = result.scalar_one_or_none()
                                if trip:
                                    old_status = trip.status.value if trip.status else "created"
                                    # Update status to booked
                                    trip.status = TripStatus.BOOKED
                                    
                                    # Update segments
                                    if trip.days:
                                        new_days = []
                                        for day in trip.days:
                                            new_items = []
                                            for item in day.get("items", []):
                                                item["status"] = "booked"
                                                new_items.append(item)
                                            day["items"] = new_items
                                            new_days.append(day)
                                        trip.days = new_days
                                        
                                    if trip.segments:
                                        new_segments = []
                                        for seg in trip.segments:
                                            seg["status"] = "booked"
                                            new_segments.append(seg)
                                        trip.segments = new_segments
                                        
                                    await session.commit()
                                    
                                    # Emit TRIP_STATUS_CHANGED event
                                    status_event = DomainEvent(
                                        event_type=EventType.TRIP_STATUS_CHANGED,
                                        actor_user_id=event.actor_user_id,
                                        subject_id=str(trip.id),
                                        tenant_id=str(trip.tenant_id),
                                        payload={
                                            "old_status": old_status,
                                            "new_status": "booked",
                                            "destination": trip.destination,
                                            "customer_id": str(trip.customer_id) if trip.customer_id else None
                                        }
                                    )
                                    await emit_event(redis, STREAM_PLANNER, status_event)
                                    logger.info(f"Trip {tid} updated to booked.")
                    except Exception as inner_e:
                        logger.error(f"Error processing affiliate event: {inner_e}")
                    finally:
                        await redis.xack(STREAM_AFFILIATE, CONSUMER_GROUP_PLANNER, msg_id)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Affiliate consumer loop error: {e}")
            await asyncio.sleep(5)
