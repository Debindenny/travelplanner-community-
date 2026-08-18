import asyncio
import json
import logging
import uuid
from sqlalchemy import select
from shared.events import STREAM_AI_WORKER, EventType, DomainEvent
from app.models.plans import Subscription

logger = logging.getLogger(__name__)

async def start_ai_worker_consumer(redis, session_factory):
    """Consume AI worker events to meter usage."""
    group_name = "identity_group"
    try:
        await redis.xgroup_create(STREAM_AI_WORKER, group_name, mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            logger.warning(f"Consumer group error: {e}")

    logger.info("Identity AI worker consumer started.")

    while True:
        try:
            messages = await redis.xreadgroup(
                group_name,
                "identity-consumer-1",
                {STREAM_AI_WORKER: ">"},
                count=10,
                block=5000,
            )

            for stream, msgs in messages:
                for msg_id, msg_data in msgs:
                    try:
                        event_dict = json.loads(msg_data["event"])
                        event = DomainEvent(**event_dict)

                        if event.event_type == EventType.GENERATION_COMPLETED:
                            async with session_factory() as session:
                                customer_id_str = event.payload.get("customer_id")
                                if not customer_id_str:
                                    continue

                                try:
                                    customer_uuid = uuid.UUID(customer_id_str)
                                except ValueError:
                                    continue

                                # Get active subscription for customer
                                result = await session.execute(
                                    select(Subscription)
                                    .where(Subscription.user_id == customer_uuid)
                                    .order_by(Subscription.period_end.desc())
                                    .limit(1)
                                )
                                subscription = result.scalar_one_or_none()
                                if subscription:
                                    subscription.plans_used += 1
                                    await session.commit()
                                    logger.info(f"Incremented plans_used to {subscription.plans_used} for user {customer_id_str}")

                    except Exception as inner_e:
                        logger.error(f"Error processing identity event: {inner_e}")
                    finally:
                        await redis.xack(STREAM_AI_WORKER, group_name, msg_id)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Identity consumer loop error: {e}")
            await asyncio.sleep(5)
