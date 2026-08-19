"""Travlplanr Affiliate Service — bookings, inventory."""

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

# NOTE: do NOT pass database_url as a kwarg — an explicit init arg overrides the
# DATABASE_URL env var (pydantic-settings precedence), which in Docker points the
# service at localhost instead of the postgres container. Let env populate it,
# matching identity/planner/reporting.
settings = ServiceSettings(service_name="affiliate")
configure_logging(settings.service_name, settings.log_level, settings.environment, settings.log_json)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine, session_factory = create_engine_and_session(settings.database_url)
    redis = await create_redis_client(settings.redis_url)
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.redis = redis
    app.state.settings = settings

    import asyncio
    from app.adapters.providers.travelnext import get_travelnext_ip
    from app.consumers.booking_consumer import start_booking_consumer
    task = asyncio.create_task(start_booking_consumer(redis, session_factory))
    app.state.consumer_task = task

    # Warm the egress-IP autodetect cache off the event loop thread. Without
    # this, the first TravelNext request of any kind blocks the whole loop
    # for up to 5s (get_travelnext_ip does a synchronous urllib call) — every
    # concurrent request stalls, not just TravelNext ones.
    asyncio.create_task(asyncio.to_thread(get_travelnext_ip))

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    await redis.aclose()
    await engine.dispose()


app = FastAPI(
    title="Travlplanr Affiliate Service",
    description="Bookings source of truth, inventory catalog.",
    version="0.1.0",
    lifespan=lifespan,
)
install_middleware(app, settings)
install_error_handlers(app)

from app.routers import (  # noqa: E402
    bookings,
    inventory,
    travelnext,
    travelnext_activities,
    travelnext_cars,
    travelnext_cruise,
    travelnext_events,
    travelnext_holidays,
    travelomatix_hotels,
    travelnext_rail,
    travelnext_transfers,
)

app.include_router(bookings.router, prefix="/api/v1/bookings", tags=["Bookings"])
app.include_router(inventory.router, prefix="/api/v1", tags=["Inventory"])
app.include_router(travelnext.router, prefix="/api/v1/travelnext", tags=["TravelNext"])
app.include_router(travelnext_cars.router, prefix="/api/v1/travelnext-cars", tags=["TravelNext Cars"])
app.include_router(travelnext_holidays.router, prefix="/api/v1/travelnext-holidays", tags=["TravelNext Holidays"])
app.include_router(travelnext_events.router, prefix="/api/v1/travelnext-events", tags=["TravelNext Events"])
app.include_router(travelomatix_hotels.router, prefix="/api/v1/travelomatix-hotels", tags=["Travelomatix Hotels"])
app.include_router(travelnext_transfers.router, prefix="/api/v1/travelnext-transfers", tags=["TravelNext Transfers"])
app.include_router(travelnext_rail.router, prefix="/api/v1/travelnext-rail", tags=["TravelNext Rail"])
app.include_router(
    travelnext_activities.router, prefix="/api/v1/travelnext-activities", tags=["TravelNext Activities"]
)
app.include_router(travelnext_cruise.router, prefix="/api/v1/travelnext-cruise", tags=["TravelNext Cruise"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "affiliate"}
