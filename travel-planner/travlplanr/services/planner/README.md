# Planner Service

FastAPI service ("Trips, destinations, cities, itinerary CRUD, generation facade") that owns most of the traveler-facing domain logic for Travlplanr.

**Note:** This is the largest service in the system — a god-service covering trips, chat, destinations, packages, checkout, collaboration, community, CMS, voice, matching, and websockets. Per `DESIGN_ENHANCEMENT_PLAN.md` it is a **gradual-extraction candidate**, not something to split in one pass. Do not attempt a big-bang breakup; extract one domain at a time.

## Owned domains / routers

From `app/routers/`, registered in `app/main.py` under `/api/v1/...`:

- **Trips**: `trips.py`, `admin_itineraries.py`
- **Destinations**: `destinations.py`, `admin_destinations.py`
- **Packages / inventory**: `packages.py`, `packages_cms.py`, `inventory.py`, `inventory_search.py`
- **Chat / voice**: `chat.py`, `voice.py`, `voice_socket.py`
- **Checkout**: `checkout.py`
- **Collaboration**: `collaboration.py`
- **Community** (8 routers, all under `/api/v1/community...`): `community.py`, `community_feed.py`, `community_posts.py`, `community_profile.py`, `community_stories.py`, `community_notifications.py`, `community_messages.py`, `community_misc.py`, `community_websockets.py`
- **Matching**: `matching.py`
- **Websockets**: `websocket.py`
- **CMS / admin content**: `cms.py`, `admin_blogs.py`, `admin_promotions.py`, `admin_reviews.py`, `admin_support.py`, `admin_community_news.py`
- **Contact**: `contact.py`

## DB tables / models

From `app/models/`, one module per domain: `trips.py`, `destinations.py`, `destination_requests.py`, `packages.py`, `inventory.py`, `cms.py`, `promotions.py`, `reviews.py`, `support.py`, `communications.py`, `community.py`, `matching.py`, `collaboration.py`.

## Events

Uses the shared envelope (`services/shared/events.py` `DomainEvent` / `EventType`), publishing onto `STREAM_PLANNER` (and `STREAM_AFFILIATE` for booking events).

**Emitted** (grep `EventType.` in `app/routers/*.py`, `app/consumers/*.py`):
- `TRIP_CREATED`, `TRIP_UPDATED`, `TRIP_EDITED`, `TRIP_STATUS_CHANGED`, `TRIP_DELETED` — from `routers/trips.py`, `routers/admin_itineraries.py`
- `COLLABORATOR_INVITED` — from `routers/trips.py` / `routers/collaboration.py`
- `EXPENSE_ADDED` — from `routers/trips.py`
- `TRIP_BOOKED`, `BOOKING_REFUNDED` — from `routers/checkout.py`
- `CUSTOMER_CREATED` — from `consumers/affiliate_consumer.py`
- `GENERATION_REQUESTED` — enqueued onto `events:ai-worker` (`STREAM_AI_WORKER`) to request itinerary/content generation from the AI worker service

**Consumed**:
- `consumers/ai_worker_consumer.py` listens on `STREAM_AI_WORKER` (consumer group), handling `GENERATION_COMPLETED` / `GENERATION_FAILED` results and writing them back onto trips
- `consumers/affiliate_consumer.py` and `consumers/identity_consumer.py` consume the affiliate/identity streams respectively (e.g. `CUSTOMER_CREATED`)
- `utils/pubsub.py` runs a separate Redis pub/sub listener (not a Streams consumer group)

The full `EventType` enum lives in `services/shared/events.py` and is shared across all services — cross-check there before adding new event types.

## Known debt

- A duplicate `app/routers/community/` subpackage was previously removed. Only the flat `community_*.py` files listed above are live. `DESIGN_ENHANCEMENT_PLAN.md` still references the old subpackage as something to delete — that reference is stale.
- This service should not gain new unrelated domains; new features belong in a more targeted service where possible, pending the gradual-extraction work described in `DESIGN_ENHANCEMENT_PLAN.md`.

## Running locally

Via `docker-compose.yml`, service `planner`:
- Builds from `services/planner/Dockerfile`
- Depends on `postgres` and `redis` (both `service_healthy`)
- Key env vars: `DATABASE_URL` (points at `planner_db`), `REDIS_URL`, `JWT_SECRET`, `CHAT_PROVIDER`, `ANTHROPIC_API_KEY` / `GROQ_API_KEY` / `GEMINI_API_KEY`, `STRIPE_API_KEY`, plus image/whisper/ollama config
- Volumes mount `app/`, `alembic/`, `scripts/`, and `services/shared/` for live-reload
- Healthcheck hits `/docs`

Package metadata (`services/planner/pyproject.toml`): name `travlplanr-planner`, requires Python `>=3.12`, depends on FastAPI, SQLAlchemy (async) + asyncpg, Alembic, Redis, Anthropic/Stripe/sendgrid/boto3 SDKs, pgvector, sentence-transformers, and the workspace `travlplanr-shared` package. No console-script entry point is defined — run it via `uvicorn` as configured in the Dockerfile.

Local dev commands (from `services/planner/`):

```bash
docker compose up planner
# or, outside docker, with deps already running:
uvicorn app.main:app --reload
```

Dev/test extras: `pytest`, `pytest-asyncio`, `ruff`, `fakeredis`.
