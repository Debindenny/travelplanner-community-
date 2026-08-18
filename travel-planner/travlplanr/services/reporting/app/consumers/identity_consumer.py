"""
Identity events consumer for reporting service.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

import sys
from pathlib import Path

from shared.events import CONSUMER_GROUP_REPORTING, STREAM_IDENTITY, EventType
from shared.redis_client import ack_event, ensure_consumer_group, read_events
from app.models.dashboard_metric_daily import DashboardMetricDaily
from app.models.customer_segment_counts import CustomerSegmentCount
from app.models.notifications import AdminNotification
from app.routers.websocket import broadcast_dashboard_update

logger = logging.getLogger(__name__)


async def process_identity_events(
    redis: aioredis.Redis,
    session_factory: async_sessionmaker,
    consumer_name: str = "reporting-worker-1",
) -> None:
    """Consume and process events from the identity stream."""
    await ensure_consumer_group(redis, STREAM_IDENTITY, CONSUMER_GROUP_REPORTING)

    logger.info("Started identity consumer %s", consumer_name)

    while True:
        try:
            events = await read_events(
                redis, STREAM_IDENTITY, CONSUMER_GROUP_REPORTING, consumer_name
            )
            for msg_id, event in events:
                try:
                    async with session_factory() as session:
                        tenant_id = event.tenant_id
                        today = datetime.now(timezone.utc).date()

                        if event.event_type == EventType.CUSTOMER_CREATED:
                            customer_name = event.payload.get("name", "A new user")
                            notif = AdminNotification(
                                tenant_id=tenant_id,
                                type="customer_created",
                                title="New User Registered",
                                message=f"{customer_name} has just registered.",
                            )
                            session.add(notif)

                            # Increment total
                            total_q = await session.execute(
                                select(DashboardMetricDaily).where(
                                    DashboardMetricDaily.tenant_id == tenant_id,
                                    DashboardMetricDaily.metric_date == today,
                                    DashboardMetricDaily.metric_key == "customers_total",
                                )
                            )
                            total_metric = total_q.scalar_one_or_none()
                            if not total_metric:
                                total_metric = DashboardMetricDaily(
                                    tenant_id=tenant_id,
                                    metric_date=today,
                                    metric_key="customers_total",
                                    value=1,
                                )
                                session.add(total_metric)
                            else:
                                total_metric.value += 1

                            # Increment new
                            new_q = await session.execute(
                                select(DashboardMetricDaily).where(
                                    DashboardMetricDaily.tenant_id == tenant_id,
                                    DashboardMetricDaily.metric_date == today,
                                    DashboardMetricDaily.metric_key == "new_customers",
                                )
                            )
                            new_metric = new_q.scalar_one_or_none()
                            if not new_metric:
                                new_metric = DashboardMetricDaily(
                                    tenant_id=tenant_id,
                                    metric_date=today,
                                    metric_key="new_customers",
                                    value=1,
                                )
                                session.add(new_metric)
                            else:
                                new_metric.value += 1

                            # Update customer segment
                            customer_type = event.payload.get("customer_type")
                            if customer_type:
                                segment_q = await session.execute(
                                    select(CustomerSegmentCount).where(
                                        CustomerSegmentCount.tenant_id == tenant_id,
                                        CustomerSegmentCount.segment == customer_type,
                                    )
                                )
                                segment_metric = segment_q.scalar_one_or_none()
                                if not segment_metric:
                                    segment_metric = CustomerSegmentCount(
                                        tenant_id=tenant_id,
                                        segment=customer_type,
                                        count=1,
                                    )
                                    session.add(segment_metric)
                                else:
                                    segment_metric.count += 1

                        elif event.event_type == EventType.STAFF_CREATED:
                            total_q = await session.execute(
                                select(DashboardMetricDaily).where(
                                    DashboardMetricDaily.tenant_id == tenant_id,
                                    DashboardMetricDaily.metric_date == today,
                                    DashboardMetricDaily.metric_key == "staff_total",
                                )
                            )
                            total_metric = total_q.scalar_one_or_none()
                            if not total_metric:
                                total_metric = DashboardMetricDaily(
                                    tenant_id=tenant_id,
                                    metric_date=today,
                                    metric_key="staff_total",
                                    value=1,
                                )
                                session.add(total_metric)
                            else:
                                total_metric.value += 1

                        elif event.event_type in (EventType.CUSTOMER_UPDATED, EventType.CUSTOMER_STATUS_CHANGED):
                            old_segment = event.payload.get("old_segment")
                            new_segment = event.payload.get("new_segment")
                            if old_segment and new_segment and old_segment != new_segment:
                                old_q = await session.execute(
                                    select(CustomerSegmentCount).where(
                                        CustomerSegmentCount.tenant_id == tenant_id,
                                        CustomerSegmentCount.segment == old_segment,
                                    )
                                )
                                old_metric = old_q.scalar_one_or_none()
                                if old_metric and old_metric.count > 0:
                                    old_metric.count -= 1
                                
                                new_q = await session.execute(
                                    select(CustomerSegmentCount).where(
                                        CustomerSegmentCount.tenant_id == tenant_id,
                                        CustomerSegmentCount.segment == new_segment,
                                    )
                                )
                                new_metric = new_q.scalar_one_or_none()
                                if not new_metric:
                                    new_metric = CustomerSegmentCount(
                                        tenant_id=tenant_id,
                                        segment=new_segment,
                                        count=1,
                                    )
                                    session.add(new_metric)
                                else:
                                    new_metric.count += 1

                        elif event.event_type == EventType.CUSTOMER_DELETED:
                            total_q = await session.execute(
                                select(DashboardMetricDaily).where(
                                    DashboardMetricDaily.tenant_id == tenant_id,
                                    DashboardMetricDaily.metric_date == today,
                                    DashboardMetricDaily.metric_key == "customers_total",
                                )
                            )
                            total_metric = total_q.scalar_one_or_none()
                            if total_metric and total_metric.value > 0:
                                total_metric.value -= 1

                            customer_type = event.payload.get("customer_type")
                            if customer_type:
                                seg_q = await session.execute(
                                    select(CustomerSegmentCount).where(
                                        CustomerSegmentCount.tenant_id == tenant_id,
                                        CustomerSegmentCount.segment == customer_type,
                                    )
                                )
                                seg = seg_q.scalar_one_or_none()
                                if seg and seg.count > 0:
                                    seg.count -= 1

                        elif event.event_type == EventType.STAFF_DELETED:
                            total_q = await session.execute(
                                select(DashboardMetricDaily).where(
                                    DashboardMetricDaily.tenant_id == tenant_id,
                                    DashboardMetricDaily.metric_date == today,
                                    DashboardMetricDaily.metric_key == "staff_total",
                                )
                            )
                            total_metric = total_q.scalar_one_or_none()
                            if total_metric and total_metric.value > 0:
                                total_metric.value -= 1

                        await session.commit()

                    try:
                        await broadcast_dashboard_update("dashboard.updated")
                    except Exception:
                        logger.exception("failed to broadcast dashboard update")

                    # Ack message
                    await ack_event(redis, STREAM_IDENTITY, CONSUMER_GROUP_REPORTING, msg_id)
                except Exception as e:
                    logger.error("Error processing event %s: %s", msg_id, e)
        except Exception as e:
            logger.error("Consumer loop error: %s", e)
            await asyncio.sleep(5)
