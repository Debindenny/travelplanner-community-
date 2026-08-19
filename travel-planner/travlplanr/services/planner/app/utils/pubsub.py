"""Async Redis PubSub bridge for WebSocket notification routing.

Replaces the original synchronous ``Redis.from_url()`` that was used with
``await`` on the event loop (a runtime bug) and never closed during app
shutdown (a connection leak).  The Redis client is created lazily to avoid
import-time side effects and is properly torn down in the planner service's
lifespan teardown.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

from redis.asyncio import Redis

from app.routers.websocket import broadcast_to_user

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
PUBSUB_CHANNEL = "ws_notifications"

# Lazy async Redis client — created on first use, closed in lifespan teardown.
_redis_client: Redis | None = None


def _ensure_client() -> Redis:
    """Return (or create) the lazy async Redis client."""
    global _redis_client  # noqa: PLW0603
    if _redis_client is None:
        _redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


async def close_redis() -> None:
    """Close the async Redis client during app shutdown."""
    global _redis_client  # noqa: PLW0603
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


async def publish_message(user_id: str, event_type: str, payload: dict) -> None:
    """Publish a message to Redis so that any worker can send it to the user."""
    client = _ensure_client()
    message = {"user_id": user_id, "event_type": event_type, "payload": payload}
    await client.publish(PUBSUB_CHANNEL, json.dumps(message))


async def pubsub_listener() -> None:
    """Listen for messages from Redis and route them to local websockets."""
    client = _ensure_client()
    pubsub = client.pubsub()
    await pubsub.subscribe(PUBSUB_CHANNEL)
    logger.info("Started Redis PubSub listener for WebSockets.")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                user_id = data.get("user_id")
                event_type = data.get("event_type")
                payload = data.get("payload")

                if user_id and event_type:
                    await broadcast_to_user(user_id, event_type, payload)  # type: ignore[arg-type]
    except asyncio.CancelledError:
        logger.info("PubSub listener cancelled")
    except Exception as e:
        logger.error("Error in pubsub_listener: %s", e)
    finally:
        await pubsub.unsubscribe(PUBSUB_CHANNEL)
        await pubsub.close()
