"""Travlplanr Reporting Service — dashboard read models, audit, notifications."""

from __future__ import annotations

import os
import sentry_sdk

if os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
    )

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI


from shared.config import ServiceSettings
from shared.database import create_engine_and_session
from shared.redis_client import create_redis_client
from shared.logging import configure_logging
from shared.errors import install_error_handlers
from shared.middleware import install_middleware

settings = ServiceSettings(service_name="reporting")
configure_logging(settings.service_name, settings.log_level, settings.environment, settings.log_json)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine, session_factory = create_engine_and_session(settings.database_url)
    
    from shared.database import Base
    # import models so they are registered
    from app.models.staff_customer_counts import StaffCustomerCount
    from app.models.customer_segment_counts import CustomerSegmentCount
    from app.models.trip_status_counts import TripStatusCount
    from app.models.dashboard_metric_daily import DashboardMetricDaily

    # Schema is managed by Alembic migrations ("alembic upgrade head" runs on container start).
    redis = await create_redis_client(settings.redis_url)

    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.redis = redis
    app.state.settings = settings

    from app.consumers.identity_consumer import process_identity_events
    from app.consumers.planner_consumer import process_planner_events
    from app.consumers.affiliate_consumer import process_affiliate_events
    import asyncio

    # Start background consumer
    task1 = asyncio.create_task(process_identity_events(redis, session_factory))
    task2 = asyncio.create_task(process_planner_events(redis, session_factory))
    task3 = asyncio.create_task(process_affiliate_events(redis, session_factory))
    app.state.consumer_task1 = task1
    app.state.consumer_task2 = task2
    app.state.consumer_task3 = task3

    yield

    task1.cancel()
    task2.cancel()
    task3.cancel()
    try:
        await asyncio.gather(task1, task2, task3)
    except asyncio.CancelledError:
        pass

    await redis.aclose()
    await engine.dispose()


app = FastAPI(
    title="Travlplanr Reporting Service",
    description="Dashboard read models, audit events, notifications, status counts.",
    version="0.1.0",
    lifespan=lifespan,
)
install_middleware(app, settings)
install_error_handlers(app)

from app.routers import dashboard, notifications, internal_stats, websocket  # noqa: E402

app.include_router(dashboard.router, prefix="/api/v1/admin/dashboard", tags=["Dashboard"])
app.include_router(
    notifications.router, prefix="/api/v1/admin/notifications", tags=["Notifications"]
)
app.include_router(internal_stats.router, prefix="/api/v1/internal/stats", tags=["Internal Stats"])
app.include_router(websocket.router, prefix="/api/v1/admin")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "reporting"}
