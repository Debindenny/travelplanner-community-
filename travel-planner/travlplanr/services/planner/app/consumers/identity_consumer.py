import asyncio
import json
import logging
from sqlalchemy import update
from shared.events import CONSUMER_GROUP_PLANNER, STREAM_IDENTITY, EventType
from shared.redis_client import ensure_consumer_group

logger = logging.getLogger(__name__)


async def claim_pending_invites(session_factory, email, user_id, display_name=None) -> int:
    """Link any pending (unregistered) collaborator rows for ``email`` to a
    newly-registered user. Returns the number of rows claimed.

    Extracted so it can be unit/integration-tested directly without driving the
    Redis stream loop. The consumer below delegates to it.
    """
    if not (email and user_id):
        return 0
    from app.models.collaboration import TripCollaborator

    normalized = email.strip().lower()
    async with session_factory() as session:
        stmt = (
            update(TripCollaborator)
            .where(
                TripCollaborator.email == normalized,
                TripCollaborator.user_id.is_(None),
            )
            .values(user_id=user_id, display_name=display_name, status="active")
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount or 0


async def _to_dlq(redis, msg_data, reason: str) -> None:
    """Park a permanently-failed message on a dead-letter stream for later inspection.

    The main stream is always acked (to avoid poison loops), so without this the
    original payload would be lost. The DLQ keeps it for observability/replay.
    """
    try:
        event_val = msg_data.get(b"event", msg_data.get("event", ""))
        if isinstance(event_val, bytes):
            event_val = event_val.decode("utf-8")
        await redis.xadd(
            f"{STREAM_IDENTITY}:dlq",
            {"event": event_val, "reason": reason},
            maxlen=1000,
            approximate=True,
        )
    except Exception:
        logger.exception("Failed to write to DLQ")


async def start_identity_consumer(redis, session_factory):
    """Consume identity events for the planner service."""
    await ensure_consumer_group(redis, STREAM_IDENTITY, CONSUMER_GROUP_PLANNER)

    logger.info("Planner service identity consumer started.")

    while True:
        try:
            messages = await redis.xreadgroup(
                CONSUMER_GROUP_PLANNER,
                "planner-identity-consumer-1",
                {STREAM_IDENTITY: ">"},
                count=10,
                block=5000,
            )

            for stream, msgs in messages:
                for msg_id, msg_data in msgs:
                    try:
                        # Shared DomainEvent wrapper shape
                        event_dict = json.loads(msg_data[b"event"] if b"event" in msg_data else msg_data["event"])
                        
                        if event_dict.get("event_type") == EventType.CUSTOMER_CREATED:
                            payload = event_dict.get("payload", {})
                            claimed = await claim_pending_invites(
                                session_factory,
                                payload.get("email"),
                                event_dict.get("subject_id"),
                                payload.get("display_name"),
                            )
                            if claimed:
                                logger.info(
                                    f"Claimed {claimed} pending collaborators for {payload.get('email')}"
                                )

                    except Exception as inner_e:
                        logger.error(f"Error processing identity event: {inner_e}")
                        await _to_dlq(redis, msg_data, str(inner_e))
                    finally:
                        await redis.xack(STREAM_IDENTITY, CONSUMER_GROUP_PLANNER, msg_id)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Identity consumer loop error: {e}")
            await asyncio.sleep(5)
