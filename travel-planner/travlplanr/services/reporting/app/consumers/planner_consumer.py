"""
Planner events consumer for reporting service.
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

from shared.events import CONSUMER_GROUP_REPORTING, STREAM_PLANNER, EventType
from shared.redis_client import ack_event, ensure_consumer_group, read_events
from app.models.dashboard_metric_daily import DashboardMetricDaily
from app.models.trip_status_counts import TripStatusCount
from app.models.notifications import AdminNotification
from app.routers.websocket import broadcast_dashboard_update

logger = logging.getLogger(__name__)


async def process_planner_events(
    redis: aioredis.Redis,
    session_factory: async_sessionmaker,
    consumer_name: str = "reporting-worker-planner",
) -> None:
    """Consume and process events from the planner stream."""
    await ensure_consumer_group(redis, STREAM_PLANNER, CONSUMER_GROUP_REPORTING)

    logger.info("Started planner consumer %s", consumer_name)

    while True:
        try:
            events = await read_events(
                redis, STREAM_PLANNER, CONSUMER_GROUP_REPORTING, consumer_name
            )
            for msg_id, event in events:
                try:
                    async with session_factory() as session:
                        tenant_id = event.tenant_id
                        today = datetime.now(timezone.utc).date()

                        if event.event_type == EventType.TRIP_CREATED:
                            customer_id = event.payload.get("customer_id")
                            destination = event.payload.get("destination", "Unknown")

                            # Add AdminNotification
                            notif = AdminNotification(
                                tenant_id=tenant_id,
                                type="trip_created",
                                title="New Itinerary Created",
                                message=f"A new itinerary for {destination} was created.",
                            )
                            session.add(notif)

                            # Increment total
                            total_q = await session.execute(
                                select(DashboardMetricDaily).where(
                                    DashboardMetricDaily.tenant_id == tenant_id,
                                    DashboardMetricDaily.metric_date == today,
                                    DashboardMetricDaily.metric_key == "total_itineraries",
                                )
                            )
                            total_metric = total_q.scalar_one_or_none()
                            if not total_metric:
                                total_metric = DashboardMetricDaily(
                                    tenant_id=tenant_id,
                                    metric_date=today,
                                    metric_key="total_itineraries",
                                    value=1,
                                )
                                session.add(total_metric)
                            else:
                                total_metric.value += 1

                            # Update itin_created
                            itin_created_q = await session.execute(
                                select(DashboardMetricDaily).where(
                                    DashboardMetricDaily.tenant_id == tenant_id,
                                    DashboardMetricDaily.metric_date == today,
                                    DashboardMetricDaily.metric_key == "itin_created",
                                )
                            )
                            itin_created_metric = itin_created_q.scalar_one_or_none()
                            if not itin_created_metric:
                                itin_created_metric = DashboardMetricDaily(
                                    tenant_id=tenant_id,
                                    metric_date=today,
                                    metric_key="itin_created",
                                    value=1,
                                )
                                session.add(itin_created_metric)
                            else:
                                itin_created_metric.value += 1

                            # Update TripStatusCount
                            if customer_id:
                                tsc_q = await session.execute(
                                    select(TripStatusCount).where(
                                        TripStatusCount.tenant_id == tenant_id,
                                        TripStatusCount.customer_id == customer_id,
                                        TripStatusCount.destination == destination,
                                    )
                                )
                                tsc = tsc_q.scalar_one_or_none()
                                if not tsc:
                                    tsc = TripStatusCount(
                                        tenant_id=tenant_id,
                                        customer_id=customer_id,
                                        destination=destination,
                                        count_created=1,
                                    )
                                    session.add(tsc)
                                else:
                                    tsc.count_created += 1

                        elif event.event_type == EventType.TRIP_STATUS_CHANGED:
                            customer_id = event.payload.get("customer_id")
                            destination = event.payload.get("destination", "Unknown")
                            old_status = event.payload.get("old_status")
                            new_status = event.payload.get("new_status")
                            
                            if customer_id and old_status and new_status and old_status != new_status:
                                tsc_q = await session.execute(
                                    select(TripStatusCount).where(
                                        TripStatusCount.tenant_id == tenant_id,
                                        TripStatusCount.customer_id == customer_id,
                                        TripStatusCount.destination == destination,
                                    )
                                )
                                tsc = tsc_q.scalar_one_or_none()
                                if not tsc:
                                    tsc = TripStatusCount(
                                        tenant_id=tenant_id,
                                        customer_id=customer_id,
                                        destination=destination,
                                    )
                                    session.add(tsc)
                                
                                # decrement old
                                if old_status == "created" and tsc.count_created > 0:
                                    tsc.count_created -= 1
                                elif old_status == "pending" and tsc.count_pending > 0:
                                    tsc.count_pending -= 1
                                elif old_status == "booked" and tsc.count_booked > 0:
                                    tsc.count_booked -= 1
                                elif old_status == "cancelled" and tsc.count_cancelled > 0:
                                    tsc.count_cancelled -= 1
                                    
                                # increment new
                                if new_status == "created":
                                    tsc.count_created += 1
                                elif new_status == "pending":
                                    tsc.count_pending += 1
                                elif new_status == "booked":
                                    tsc.count_booked += 1
                                elif new_status == "cancelled":
                                    tsc.count_cancelled += 1

                        elif event.event_type == EventType.TRIP_DELETED:
                            customer_id = event.payload.get("customer_id")
                            destination = event.payload.get("destination", "Unknown")
                            status = event.payload.get("status", "created")
                            if customer_id:
                                tsc_q = await session.execute(
                                    select(TripStatusCount).where(
                                        TripStatusCount.tenant_id == tenant_id,
                                        TripStatusCount.customer_id == customer_id,
                                        TripStatusCount.destination == destination,
                                    )
                                )
                                tsc = tsc_q.scalar_one_or_none()
                                if tsc:
                                    if status == "created" and tsc.count_created > 0:
                                        tsc.count_created -= 1
                                    elif status == "pending" and tsc.count_pending > 0:
                                        tsc.count_pending -= 1
                                    elif status == "booked" and tsc.count_booked > 0:
                                        tsc.count_booked -= 1
                                    elif status == "cancelled" and tsc.count_cancelled > 0:
                                        tsc.count_cancelled -= 1

                        await session.commit()

                    try:
                        await broadcast_dashboard_update("dashboard.updated")
                    except Exception:
                        logger.exception("failed to broadcast dashboard update")

                    # Ack message
                    await ack_event(redis, STREAM_PLANNER, CONSUMER_GROUP_REPORTING, msg_id)
                except Exception as e:
                    logger.error("Error processing planner event %s: %s", msg_id, e)
        except Exception as e:
            logger.error("Planner consumer loop error: %s", e)
            await asyncio.sleep(5)
