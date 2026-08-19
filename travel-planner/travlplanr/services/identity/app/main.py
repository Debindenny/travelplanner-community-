"""Travlplanr Identity Service — FastAPI application."""

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

# Add shared package to path

from shared.config import ServiceSettings
from shared.database import create_engine_and_session, Base
from shared.redis_client import create_redis_client
from shared.logging import configure_logging
from shared.errors import install_error_handlers
from shared.middleware import install_middleware

# Import models to ensure they are registered with Base.metadata
from app.models.users import User
from app.models.staff import StaffProfile
from app.models.customer_profiles import CustomerProfile
from app.models.customer_assignments import CustomerAssignment
from app.models.plans import Plan, Subscription
from app.models.notification_settings import NotificationSetting

import logging

settings = ServiceSettings(service_name="identity")
configure_logging(settings.service_name, settings.log_level, settings.environment, settings.log_json)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage DB engine + Redis connection lifecycle."""
    engine, session_factory = create_engine_and_session(settings.database_url)
    # Schema is managed by Alembic migrations ("alembic upgrade head" runs on container start).

    # Initialize redis
    redis = await create_redis_client(settings.redis_url)

    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.redis = redis
    app.state.settings = settings

    import asyncio
    from app.consumers.ai_worker_consumer import start_ai_worker_consumer
    task = asyncio.create_task(start_ai_worker_consumer(redis, session_factory))
    app.state.consumer_task = task

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    await redis.aclose()
    await engine.dispose()


app = FastAPI(
    title="Travlplanr Identity Service",
    description="Users, customer profiles, staff, auth, plans, and subscriptions.",
    version="0.1.0",
    lifespan=lifespan,
)
install_middleware(app, settings)
install_error_handlers(app)


# --- Routers ---
from app.routers import auth, customers, me, staff, agents, internal  # noqa: E402

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(me.router, prefix="/api/v1/me", tags=["Me"])
app.include_router(customers.router, prefix="/api/v1/admin/customers", tags=["Admin Customers"])
app.include_router(staff.router, prefix="/api/v1/admin/staff", tags=["Admin Staff"])
app.include_router(agents.router, prefix="/api/v1/admin/agents", tags=["Admin Agents"])
app.include_router(internal.router, prefix="/api/v1/internal", tags=["Internal"])


@app.get("/health")
async def health():
    import httpx
    import asyncio
    from fastapi.responses import JSONResponse

    services = {
        "planner": "http://planner:8000/health",
        "affiliate": "http://affiliate:8000/health",
        "reporting": "http://reporting:8000/health",
    }
    results = {"identity": "ok"}
    status_code = 200

    async def check_service(name: str, url: str):
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    results[name] = "ok"
                else:
                    results[name] = f"error: HTTP {res.status_code}"
                    nonlocal status_code
                    status_code = 503
        except Exception as e:
            logger.warning("Health check failed for service %s: %s", name, str(e))
            results[name] = "error: service unreachable"
            status_code = 503

    await asyncio.gather(*(check_service(name, url) for name, url in services.items()))
    
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if status_code == 200 else "error",
            "service": "identity-aggregate",
            "details": results
        }
    )
