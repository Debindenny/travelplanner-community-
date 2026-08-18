"""Shared Redis client utilities — streams + cache."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis

from .events import DomainEvent


async def create_redis_client(redis_url: str) -> aioredis.Redis:
    """Create an async Redis client.

    ``socket_timeout`` MUST exceed the consumers' XREADGROUP block (5s). With the
    default (None), redis-py caps a blocking read's socket deadline at exactly the
    block time, which races the server's response under concurrent event-loop
    scheduling and spuriously raises ``TimeoutError`` every poll. A generous
    timeout avoids that while still bounding genuinely dead sockets.
    """
    return aioredis.from_url(
        redis_url,
        decode_responses=True,
        socket_timeout=30,
        socket_keepalive=True,
    )


async def emit_event(redis: aioredis.Redis, stream_key: str, event: DomainEvent) -> str:
    """Emit a domain event to a Redis Stream. Returns the stream message ID."""
    data = {"event": event.model_dump_json()}
    message_id = await redis.xadd(stream_key, data, maxlen=10000, approximate=True)
    return message_id


async def ensure_consumer_group(
    redis: aioredis.Redis, stream_key: str, group_name: str
) -> None:
    """Create a consumer group if it doesn't already exist."""
    try:
        await redis.xgroup_create(stream_key, group_name, id="0", mkstream=True)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


async def read_events(
    redis: aioredis.Redis,
    stream_key: str,
    group_name: str,
    consumer_name: str,
    count: int = 10,
    block_ms: int = 5000,
) -> list[tuple[str, DomainEvent]]:
    """Read pending events from a consumer group. Returns list of (message_id, event)."""
    results = await redis.xreadgroup(
        groupname=group_name,
        consumername=consumer_name,
        streams={stream_key: ">"},
        count=count,
        block=block_ms,
    )
    events: list[tuple[str, DomainEvent]] = []
    for _stream, messages in results:
        for msg_id, data in messages:
            event_json = data.get("event", "{}")
            event = DomainEvent.model_validate_json(event_json)
            events.append((msg_id, event))
    return events


async def ack_event(
    redis: aioredis.Redis, stream_key: str, group_name: str, message_id: str
) -> None:
    """Acknowledge a processed event."""
    await redis.xack(stream_key, group_name, message_id)
