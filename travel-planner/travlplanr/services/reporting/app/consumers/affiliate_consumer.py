"""
Affiliate events consumer for reporting service.

Persists real booking revenue (GBV / net revenue) into dashboard_metric_daily
so the "God Mode" financials dashboard reflects actual Stripe activity instead
of mock data.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from shared.events import CONSUMER_GROUP_REPORTING, STREAM_AFFILIATE, EventType
from shared.redis_client import ack_event, ensure_consumer_group, read_events
from app.models.dashboard_metric_daily import DashboardMetricDaily
from app.routers.websocket import broadcast_dashboard_update

logger = logging.getLogger(__name__)


async def _bump_metric(session, tenant_id: str, metric_date, metric_key: str, delta: int) -> None:
    """Upsert-and-add a signed delta onto today's rollup for `metric_key`, floored at 0."""
    result = await session.execute(
        select(DashboardMetricDaily).where(
            DashboardMetricDaily.tenant_id == tenant_id,
            DashboardMetricDaily.metric_date == metric_date,
            DashboardMetricDaily.metric_key == metric_key,
        )
    )
    metric = result.scalar_one_or_none()
    if not metric:
        metric = DashboardMetricDaily(
            tenant_id=tenant_id,
            metric_date=metric_date,
            metric_key=metric_key,
            value=max(delta, 0),
        )
        session.add(metric)
    else:
        metric.value = max(metric.value + delta, 0)


async def process_affiliate_events(
    redis: aioredis.Redis,
    session_factory: async_sessionmaker,
    consumer_name: str = "reporting-worker-affiliate",
) -> None:
    """Consume booking/refund events from the affiliate stream."""
    await ensure_consumer_group(redis, STREAM_AFFILIATE, CONSUMER_GROUP_REPORTING)

    logger.info("Started affiliate consumer %s", consumer_name)

    while True:
        try:
            events = await read_events(
                redis, STREAM_AFFILIATE, CONSUMER_GROUP_REPORTING, consumer_name
            )
            for msg_id, event in events:
                try:
                    async with session_factory() as session:
                        tenant_id = event.tenant_id
                        today = datetime.now(timezone.utc).date()

                        if event.event_type == EventType.TRIP_BOOKED:
                            amount = float(event.payload.get("amount") or 0)
                            gbv_cents = round(amount * 100)

                            try:
                                markup = float(event.payload.get("markup_applied") or 1.0)
                            except (TypeError, ValueError):
                                markup = 1.0
                            net_cents = round(gbv_cents * (1 - 1 / markup)) if markup > 0 else 0

                            await _bump_metric(session, tenant_id, today, "gbv_cents", gbv_cents)
                            await _bump_metric(session, tenant_id, today, "net_revenue_cents", net_cents)
                            await _bump_metric(session, tenant_id, today, "bookings_count", 1)

                        elif event.event_type == EventType.BOOKING_REFUNDED:
                            amount = float(event.payload.get("amount") or 0)
                            gbv_cents = round(amount * 100)
                            await _bump_metric(session, tenant_id, today, "gbv_cents", -gbv_cents)
                            # Net revenue isn't reversed here: the refund event doesn't carry
                            # the original booking's markup, so we can't isolate the margin
                            # portion of this specific refund without looking up that booking.

                        await session.commit()

                    try:
                        await broadcast_dashboard_update("dashboard.updated")
                    except Exception:
                        logger.exception("failed to broadcast dashboard update")

                    await ack_event(redis, STREAM_AFFILIATE, CONSUMER_GROUP_REPORTING, msg_id)
                except Exception as e:
                    logger.error("Error processing affiliate event %s: %s", msg_id, e)
        except Exception as e:
            logger.error("Affiliate consumer loop error: %s", e)
            await asyncio.sleep(5)
