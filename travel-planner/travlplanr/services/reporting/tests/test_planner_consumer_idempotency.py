"""Dashboard-projection idempotency coverage for the planner event consumer.

``shared/events.py`` documents the wire contract every reporting consumer is
supposed to honor::

    Handling is at-least-once and idempotent (dedupe on event_id).

Redis Streams consumer groups are at-least-once by construction: if a
consumer crashes (or is killed, or its ack round-trip fails) after it has
already ``COMMIT``ed a projection update but before it calls ``XACK``, the
same stream entry — carrying the same ``DomainEvent.event_id`` — is
redelivered on the next read. A correct consumer must recognize it has
already applied that ``event_id`` and skip re-applying it.

This suite proves the "processed once" half of that contract, then proves
``process_planner_events`` does NOT honor the "dedupe on event_id" half: it
has no record of which event_ids it has already applied, so redelivery
double-counts every read model it touches (dashboard_metric_daily,
trip_status_counts) and duplicates admin notifications.
"""

from __future__ import annotations

import asyncio
import contextlib
import uuid

import pytest

from conftest import TENANT_ID, patch_blocking_xreadgroup


async def _run_consumer_briefly(redis, session_factory, seconds: float = 1.5) -> None:
    """Run the real consumer loop for a bit, then stop it.

    ``process_planner_events`` runs ``while True`` forever, blocking on
    ``XREADGROUP`` between batches, so tests can't just ``await`` it to
    completion. Instead we let it run long enough to drain whatever is
    already on the stream, then cancel it — mirroring how the app itself
    tears the task down on shutdown (see ``app/main.py``'s lifespan).
    """
    from app.consumers.planner_consumer import process_planner_events

    patch_blocking_xreadgroup(redis)
    task = asyncio.ensure_future(
        process_planner_events(redis, session_factory, consumer_name="test-planner-consumer")
    )
    await asyncio.sleep(seconds)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


async def _fetch_projection(session_factory, customer_id: str, destination: str):
    from sqlalchemy import select

    from app.models.dashboard_metric_daily import DashboardMetricDaily
    from app.models.notifications import AdminNotification
    from app.models.trip_status_counts import TripStatusCount

    tenant_uuid = uuid.UUID(TENANT_ID)
    async with session_factory() as session:
        total_q = await session.execute(
            select(DashboardMetricDaily).where(
                DashboardMetricDaily.tenant_id == tenant_uuid,
                DashboardMetricDaily.metric_key == "total_itineraries",
            )
        )
        total_metric = total_q.scalar_one_or_none()

        itin_q = await session.execute(
            select(DashboardMetricDaily).where(
                DashboardMetricDaily.tenant_id == tenant_uuid,
                DashboardMetricDaily.metric_key == "itin_created",
            )
        )
        itin_metric = itin_q.scalar_one_or_none()

        tsc_q = await session.execute(
            select(TripStatusCount).where(
                TripStatusCount.tenant_id == tenant_uuid,
                TripStatusCount.customer_id == uuid.UUID(customer_id),
                TripStatusCount.destination == destination,
            )
        )
        tsc = tsc_q.scalar_one_or_none()

        notif_q = await session.execute(
            select(AdminNotification).where(AdminNotification.tenant_id == tenant_uuid)
        )
        notifications = notif_q.scalars().all()

    return {
        "total_itineraries": total_metric.value if total_metric else 0,
        "itin_created": itin_metric.value if itin_metric else 0,
        "count_created": tsc.count_created if tsc else 0,
        "notification_count": len(notifications),
    }


def _make_trip_created_event(customer_id: str, destination: str):
    from shared.events import DomainEvent, EventType

    return DomainEvent(
        event_type=EventType.TRIP_CREATED,
        subject_id=str(uuid.uuid4()),
        tenant_id=TENANT_ID,
        payload={"customer_id": customer_id, "destination": destination},
    )


async def test_trip_created_event_updates_dashboard_projection_once(db, fake_redis):
    """A single TRIP_CREATED event should bump every projection by exactly one."""
    from shared.events import STREAM_PLANNER
    from shared.redis_client import emit_event

    customer_id = str(uuid.uuid4())
    destination = "Lisbon"
    event = _make_trip_created_event(customer_id, destination)

    await emit_event(fake_redis, STREAM_PLANNER, event)
    await _run_consumer_briefly(fake_redis, db)

    projection = await _fetch_projection(db, customer_id, destination)
    assert projection == {
        "total_itineraries": 1,
        "itin_created": 1,
        "count_created": 1,
        "notification_count": 1,
    }


@pytest.mark.xfail(
    strict=True,
    reason=(
        "BUG: app/consumers/planner_consumer.py has no event_id dedup guard. "
        "shared/events.py's DomainEvent docstring promises 'Handling is "
        "at-least-once and idempotent (dedupe on event_id)', but the consumer "
        "just increments counters and inserts a notification on every delivery "
        "with no check for an event_id it has already applied. Redelivering the "
        "identical TRIP_CREATED event (same event_id — the exact scenario a "
        "crash between COMMIT and XACK produces) double-counts "
        "dashboard_metric_daily.total_itineraries / itin_created, "
        "trip_status_counts.count_created, and inserts a duplicate admin "
        "notification. Flip this to a plain (non-xfail) assertion once the "
        "consumer tracks processed event_ids and skips repeats."
    ),
)
async def test_trip_created_event_redelivery_does_not_double_count(db, fake_redis):
    """Redelivering the SAME event_id must be a no-op the second time."""
    from shared.events import STREAM_PLANNER
    from shared.redis_client import emit_event

    customer_id = str(uuid.uuid4())
    destination = "Lisbon"
    # One logical domain event (fixed event_id), delivered twice on the
    # stream — simulating at-least-once redelivery of the same event_id.
    event = _make_trip_created_event(customer_id, destination)

    await emit_event(fake_redis, STREAM_PLANNER, event)
    await emit_event(fake_redis, STREAM_PLANNER, event)
    await _run_consumer_briefly(fake_redis, db)

    projection = await _fetch_projection(db, customer_id, destination)
    assert projection == {
        "total_itineraries": 1,
        "itin_created": 1,
        "count_created": 1,
        "notification_count": 1,
    }
