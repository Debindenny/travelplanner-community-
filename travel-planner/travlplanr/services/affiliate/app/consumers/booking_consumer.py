import asyncio
import json
import logging
import uuid
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from shared.events import STREAM_AFFILIATE, EventType, DomainEvent
from app.models.bookings import Booking, BookingStatus
from app.utils.pnr import generate_pnr

logger = logging.getLogger(__name__)

async def start_booking_consumer(redis, session_factory):
    """Consume events to create bookings."""
    group_name = "affiliate_group"
    try:
        await redis.xgroup_create(STREAM_AFFILIATE, group_name, mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            logger.warning(f"Consumer group error: {e}")

    logger.info("Affiliate booking consumer started.")

    while True:
        try:
            messages = await redis.xreadgroup(
                group_name,
                "affiliate-consumer-1",
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
                                payload = event.payload
                                trip_id_str = payload.get("trip_id")
                                package_id = payload.get("package_id")
                                from decimal import Decimal
                                # Prefer the customer profile id from the payload (matches trips);
                                # fall back to the actor (user id) for older events.
                                customer_id_str = payload.get("customer_id") or event.actor_user_id
                                tenant_id_str = event.tenant_id
                                booked_amount = Decimal(str(payload.get("amount") or 0.0))
                                booked_currency = payload.get("currency") or "USD"

                                if not trip_id_str and not package_id:
                                    continue

                                try:
                                    trip_uuid = uuid.UUID(trip_id_str) if trip_id_str else None
                                    customer_uuid = uuid.UUID(customer_id_str) if customer_id_str else uuid.uuid4()
                                    tenant_uuid = uuid.UUID(tenant_id_str) if tenant_id_str else uuid.uuid4()
                                except ValueError:
                                    continue

                                # Check if booking already exists (check both trip_id and package_id to prevent false duplicate matches)
                                query = select(Booking).where(
                                    Booking.customer_id == customer_uuid,
                                    Booking.tenant_id == tenant_uuid,
                                    Booking.trip_id == trip_uuid,
                                    Booking.package_id == package_id
                                )

                                existing = (await session.execute(query)).scalar_one_or_none()
                                if not existing:
                                    booking = Booking(
                                        tenant_id=tenant_uuid,
                                        customer_id=customer_uuid,
                                        trip_id=trip_uuid,
                                        package_id=package_id,
                                        amount=booked_amount,
                                        currency=booked_currency,
                                        status=BookingStatus.CONFIRMED,
                                        pnr=generate_pnr(),
                                    )
                                    session.add(booking)
                                    try:
                                        await session.commit()
                                    except IntegrityError:
                                        # Extremely unlikely PNR collision — retry once with a fresh code.
                                        await session.rollback()
                                        booking.pnr = generate_pnr()
                                        session.add(booking)
                                        await session.commit()
                                    logger.info(f"Booking row created for trip {trip_id_str} (PNR {booking.pnr})")

                    except Exception as inner_e:
                        logger.error(f"Error processing affiliate event: {inner_e}")
                    finally:
                        await redis.xack(STREAM_AFFILIATE, group_name, msg_id)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Affiliate consumer loop error: {e}")
            await asyncio.sleep(5)
