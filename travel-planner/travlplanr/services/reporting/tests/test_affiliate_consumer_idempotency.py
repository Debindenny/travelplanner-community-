"""Idempotency coverage for the affiliate (booking revenue) event consumer.

Same contract as ``test_planner_consumer_idempotency.py``: ``shared/events.py``
promises at-least-once delivery is deduped on ``event_id``. This suite checks
that promise against ``process_affiliate_events``, which persists real GBV /
net revenue into ``dashboard_metric_daily`` — a financial rollup, so silent
double-counting here is worse than cosmetic.
"""

from __future__ import annotations

import asyncio
import contextlib
import uuid

import pytest

from conftest import TENANT_ID, patch_blocking_xreadgroup


async def _run_consumer_briefly(redis, session_factory, seconds: float = 1.5) -> None:
    from app.consumers.affiliate_consumer import process_affiliate_events

    patch_blocking_xreadgroup(redis)
    task = asyncio.ensure_future(
        process_affiliate_events(redis, session_factory, consumer_name="test-affiliate-consumer")
    )
    await asyncio.sleep(seconds)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


async def _fetch_revenue_metrics(session_factory):
    from sqlalchemy import select

    from app.models.dashboard_metric_daily import DashboardMetricDaily

    tenant_uuid = uuid.UUID(TENANT_ID)
    async with session_factory() as session:
        rows_q = await session.execute(
            select(DashboardMetricDaily).where(DashboardMetricDaily.tenant_id == tenant_uuid)
        )
        rows = rows_q.scalars().all()
    return {row.metric_key: row.value for row in rows}


def _make_trip_booked_event(amount: float, markup_applied: float):
    from shared.events import DomainEvent, EventType

    return DomainEvent(
        event_type=EventType.TRIP_BOOKED,
        subject_id=str(uuid.uuid4()),
        tenant_id=TENANT_ID,
        payload={"amount": amount, "markup_applied": markup_applied},
    )


async def test_trip_booked_event_updates_revenue_projection_once(db, fake_redis):
    """A single TRIP_BOOKED event should post GBV/net-revenue/bookings exactly once."""
    from shared.events import STREAM_AFFILIATE
    from shared.redis_client import emit_event

    event = _make_trip_booked_event(amount=500.0, markup_applied=1.25)

    await emit_event(fake_redis, STREAM_AFFILIATE, event)
    await _run_consumer_briefly(fake_redis, db)

    metrics = await _fetch_revenue_metrics(db)
    assert metrics.get("gbv_cents") == 50_000
    assert metrics.get("net_revenue_cents") == 10_000
    assert metrics.get("bookings_count") == 1


@pytest.mark.xfail(
    strict=True,
    reason=(
        "BUG: app/consumers/affiliate_consumer.py has no event_id dedup guard "
        "either, same root cause as the planner consumer. Redelivering the "
        "identical TRIP_BOOKED event (same event_id) double-posts real booking "
        "revenue into dashboard_metric_daily (gbv_cents / net_revenue_cents / "
        "bookings_count) — a financial figure, not just a display counter. Flip "
        "to a plain assertion once dedup is implemented."
    ),
)
async def test_trip_booked_event_redelivery_does_not_double_count(db, fake_redis):
    from shared.events import STREAM_AFFILIATE
    from shared.redis_client import emit_event

    event = _make_trip_booked_event(amount=500.0, markup_applied=1.25)

    await emit_event(fake_redis, STREAM_AFFILIATE, event)
    await emit_event(fake_redis, STREAM_AFFILIATE, event)
    await _run_consumer_briefly(fake_redis, db)

    metrics = await _fetch_revenue_metrics(db)
    assert metrics.get("gbv_cents") == 50_000
    assert metrics.get("net_revenue_cents") == 10_000
    assert metrics.get("bookings_count") == 1
