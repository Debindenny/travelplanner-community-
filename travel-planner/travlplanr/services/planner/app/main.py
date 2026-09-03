"""Travlplanr Planner Service — trips, destinations, itinerary CRUD."""

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

from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
import os

from shared.config import ServiceSettings
from shared.database import create_engine_and_session
from shared.redis_client import create_redis_client
from shared.logging import configure_logging
from shared.errors import install_error_handlers
from shared.middleware import install_middleware

settings = ServiceSettings(service_name="planner")
configure_logging(settings.service_name, settings.log_level, settings.environment, settings.log_json)

# Import models to ensure they are registered with Base.metadata
from app.models import *


from shared.auth_dependencies import require_staff
from shared.rate_limit import rate_limiter

# Shared per-IP limit for admin write/list traffic — generous enough for normal
# admin-console usage, low enough to blunt a runaway script or leaked token.
admin_rate_limit = Depends(rate_limiter("admin", 120, 60))

@asynccontextmanager
async def lifespan(app: FastAPI):
    engine, session_factory = create_engine_and_session(settings.database_url)
    # Schema is managed by Alembic migrations ("alembic upgrade head" runs on container start).
    redis = await create_redis_client(settings.redis_url)
    redis_session = await create_redis_client(settings.redis_session_url)
    redis_rate_limit = await create_redis_client(settings.redis_rate_limit_url)
    redis_ws = await create_redis_client(settings.redis_ws_url)

    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.redis = redis
    app.state.redis_session = redis_session
    app.state.redis_rate_limit = redis_rate_limit
    app.state.redis_ws = redis_ws
    app.state.settings = settings

    from app.consumers.ai_worker_consumer import process_ai_worker_events, run_trip_generating_sweeper
    from app.consumers.affiliate_consumer import start_affiliate_consumer
    from app.consumers.identity_consumer import start_identity_consumer
    from app.utils.pubsub import pubsub_listener
    from app.services.embedding_service import get_embedding_model
    import asyncio

    # Start background consumer for AI worker events
    task1 = asyncio.create_task(process_ai_worker_events(redis, session_factory))
    task2 = asyncio.create_task(start_affiliate_consumer(redis, session_factory))
    task3 = asyncio.create_task(start_identity_consumer(redis, session_factory))
    task4 = asyncio.create_task(pubsub_listener())
    app.state.consumer_task1 = task1
    app.state.consumer_task2 = task2
    app.state.consumer_task3 = task3
    app.state.pubsub_task = task4
    # Load the embedding model into memory now, off the event loop, so the
    # first trip-creation request after boot doesn't absorb the model-load
    # time on top of its own generation latency.
    asyncio.create_task(asyncio.to_thread(get_embedding_model))
    # Keep the chat model loaded and its persona prompt KV-cached so the
    # first chat message after idle streams immediately instead of paying
    # a cold model load + full prompt evaluation.
    from app.services.chat_providers import keep_ollama_warm
    task5 = asyncio.create_task(keep_ollama_warm())
    app.state.ollama_warm_task = task5

    from app.services.destination_embedding_backfill import run_destination_embedding_backfill
    task6 = asyncio.create_task(run_destination_embedding_backfill(session_factory))
    app.state.embed_backfill_task = task6

    # T2.2 — Weekly learning-flywheel eval job.
    from scripts.weekly_eval_job import weekly_eval_loop
    task7 = asyncio.create_task(weekly_eval_loop(session_factory))
    app.state.weekly_eval_task = task7

    # Stuck generating status sweeper task
    task8 = asyncio.create_task(run_trip_generating_sweeper(redis, session_factory))
    app.state.generating_sweeper_task = task8

    yield

    task1.cancel()
    task2.cancel()
    task3.cancel()
    task4.cancel()
    task5.cancel()
    task6.cancel()
    task7.cancel()
    task8.cancel()
    try:
        await asyncio.gather(task1, task2, task3, task4, task5, task6, task7, task8)
    except asyncio.CancelledError:
        pass

    await redis.aclose()
    await redis_session.aclose()
    await redis_rate_limit.aclose()
    await redis_ws.aclose()
    await engine.dispose()


app = FastAPI(
    title="Travlplanr Planner Service",
    description="Trips, destinations, cities, itinerary CRUD, generation facade.",
    version="0.1.0",
    lifespan=lifespan,
)
install_middleware(app, settings)
install_error_handlers(app)

os.makedirs("app/static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/static"), name="static_root")
app.mount("/api/v1/static", StaticFiles(directory="app/static"), name="static_api")

from app.routers import (
    trips,
    admin_itineraries,
    destinations,
    packages,
    chat,
    chat_sessions,
    geocode,
    checkout,
    cms,
    inventory,
    packages_cms,
    admin_community_news,
    admin_promotions,
    admin_destinations,
    admin_support,
    admin_reviews,
    voice,
    voice_socket,
    community_feed,
    community_posts,
    community_profile,
    community_stories,
    community_notifications,
    community_messages,
    community_misc,
    community_discover,
    community_saved,
    community_websockets,
    community_moderation,
    community_gamification,
    community_meetups,
    community_journals,
    community_spaces,
    community_space_messages,
    collaboration,
    matching,
    websocket,
    admin_blogs,
    contact,
    newsletter,
    admin_ai_learning,
    public_config,
)

app.include_router(trips.router, prefix="/api/v1/trips", tags=["Trips"])
app.include_router(
    admin_itineraries.router,
    prefix="/api/v1/admin/itineraries",
    tags=["Admin Itineraries"],
    dependencies=[admin_rate_limit],
)
app.include_router(destinations.router, prefix="/api/v1/destinations", tags=["Destinations"])
app.include_router(packages.router, prefix="/api/v1/packages", tags=["Packages"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(chat_sessions.router, prefix="/api/v1/chat/sessions", tags=["Chat Sessions"])
app.include_router(geocode.router, prefix="/api/v1", tags=["Geocode"])
app.include_router(public_config.router, prefix="/api/v1", tags=["Public Config"])
app.include_router(voice.router, prefix="/api/v1/voice", tags=["Voice"])
app.include_router(voice_socket.router, prefix="/api/v1/voice_socket", tags=["Voice Socket"])
app.include_router(community_feed.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(community_profile.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(community_stories.router, prefix="/api/v1/community/stories", tags=["Community"])
app.include_router(community_notifications.router, prefix="/api/v1/community/notifications", tags=["Community"])
app.include_router(community_messages.router, prefix="/api/v1/community/messages", tags=["Community"])
app.include_router(community_misc.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(community_discover.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(community_saved.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(community_websockets.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(community_moderation.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(community_gamification.router, prefix="/api/v1/community/gamification", tags=["Community"])
app.include_router(community_meetups.router, prefix="/api/v1/community/meetups", tags=["Community"])
app.include_router(community_journals.router, prefix="/api/v1/community/journals", tags=["Community"])
app.include_router(community_spaces.router, prefix="/api/v1/community/spaces", tags=["Community"])
app.include_router(community_space_messages.router, prefix="/api/v1/community/spaces", tags=["Community"])
# community_posts defines a catch-all GET/PATCH/DELETE "/{post_id}" under the bare
# "/api/v1/community" prefix — it MUST be registered last among community_* routers
# sharing that prefix, or its single-segment param route shadows every literal
# single-segment path (e.g. /community/spaces, /community/ads) registered after it.
app.include_router(community_posts.router, prefix="/api/v1/community", tags=["Community"])
app.include_router(collaboration.router, prefix="/api/v1/trips", tags=["Collaboration"])
app.include_router(matching.router, prefix="/api/v1/matching", tags=["Matching"])
app.include_router(websocket.router, prefix="/api/v1")
app.include_router(checkout.router, prefix="/api/v1/checkout", tags=["Checkout"])
app.include_router(cms.router, prefix="/api/v1/cms", tags=["CMS"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["Inventory"])
app.include_router(
    packages_cms.router, 
    prefix="/api/v1/admin/cms/packages", 
    tags=["Admin CMS Packages"],
    dependencies=[Depends(require_staff), admin_rate_limit]
)
app.include_router(
    admin_community_news.router, 
    prefix="/api/v1/admin/cms/news", 
    tags=["Admin CMS News"],
    dependencies=[Depends(require_staff), admin_rate_limit]
)
app.include_router(
    admin_promotions.router, 
    prefix="/api/v1/admin/promotions", 
    tags=["Admin Promotions"],
    dependencies=[Depends(require_staff), admin_rate_limit]
)
app.include_router(
    admin_destinations.router, 
    prefix="/api/v1/admin/destinations", 
    tags=["Admin Destinations"],
    dependencies=[Depends(require_staff), admin_rate_limit]
)
app.include_router(
    admin_support.router, 
    prefix="/api/v1/admin/support", 
    tags=["Admin Support"],
    dependencies=[Depends(require_staff), admin_rate_limit]
)
app.include_router(
    admin_reviews.router, 
    prefix="/api/v1/admin/reviews", 
    tags=["Admin Reviews"],
    dependencies=[Depends(require_staff), admin_rate_limit]
)
app.include_router(
    admin_blogs.router, 
    prefix="/api/v1/admin/blogs", 
    tags=["Admin Blogs"],
    dependencies=[Depends(require_staff), admin_rate_limit]
)
app.include_router(contact.router, prefix="/api/v1/contact", tags=["Contact"])
app.include_router(newsletter.router, prefix="/api/v1/newsletter", tags=["Newsletter"])
app.include_router(
    admin_ai_learning.router,
    prefix="/api/v1/admin/ai-learning",
    tags=["Admin AI Learning"],
    dependencies=[Depends(require_staff), admin_rate_limit],
)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "planner"}
