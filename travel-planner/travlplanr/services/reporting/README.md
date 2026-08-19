# Reporting Service

Consumes domain events off Redis Streams to build admin dashboard projections,
notifications, and status/segment rollups. A read-only consumer with respect
to other services' data — it never writes to identity/planner/affiliate
tables, only to its own reporting tables derived from the events it observes.

## Owned domains (`app/routers/`)

- **`dashboard`** (`/api/v1/admin/dashboard`) — KPI summary cards, itinerary
  creation trend, popular-destinations donut, customer-segment donut,
  customer-growth chart, and GBV/net-revenue financials. All served from
  pre-aggregated read models, never live OLTP scans of other services.
- **`notifications`** (`/api/v1/admin/notifications`) — list/paginate admin
  notifications and mark them read; powers the admin header badge.
- **`internal_stats`** (`/api/v1/internal/stats`) — service-to-service
  endpoints (`/customer/{id}`, `/staff/{id}`) guarded by a shared
  `X-Internal-Secret` header (`verify_internal_secret`), not user auth.

## DB tables owned (`app/models/`)

- `dashboard_metric_daily` — generic daily KPI rollup (`metric_key`/`value`
  pairs, e.g. `customers_total`, `new_customers`, `staff_total`,
  `itin_created`, `gbv_cents`, `net_revenue_cents`).
- `trip_status_counts` — per customer+destination counts of created/pending/
  booked/cancelled trips.
- `staff_customer_counts` — per-staff counts of assigned customers/trips by
  status.
- `customer_segment_counts` — customer counts by segment (e.g. Couple,
  Family, Solo).
- `admin_notifications` — admin notification feed (`is_read`, `type`,
  `title`, `message`).

Note: there is currently no `audit_events` table or model in this service
despite it being mentioned in `services/shared/events.py`'s module docstring
and this service's `pyproject.toml` description — only the five tables above
exist under `app/models/`.

## Streams / consumer groups consumed (`app/consumers/`)

All three consumers share the single consumer group
`CONSUMER_GROUP_REPORTING` (`"reporting-consumer"`, from
`services/shared/events.py`) but each reads a distinct stream, and each is
started as an independent asyncio task in `app/main.py`'s lifespan:

- `identity_consumer.py` reads `STREAM_IDENTITY` (`events:identity`) —
  `customer.created`, `customer.updated`/`customer.status_changed`,
  `customer.deleted`, `staff.created`, `staff.deleted`. Writes
  `dashboard_metric_daily`, `customer_segment_counts`,
  `admin_notifications`.
- `planner_consumer.py` reads `STREAM_PLANNER` (`events:planner`) —
  `trip.created`, `trip.status_changed`, `trip.deleted`.
- `affiliate_consumer.py` reads `STREAM_AFFILIATE` (`events:affiliate`) —
  `trip.booked`, `booking.refunded`.

The `events:ai-worker` stream is not consumed by this service.

## Idempotency / dedup

The `DomainEvent` envelope (`services/shared/events.py`) carries an
`event_id` documented as "the idempotency key — consumers dedupe on this,"
and handling is meant to be at-least-once. In the actual consumer code
(`identity_consumer.py`, `planner_consumer.py`, `affiliate_consumer.py`),
however, there is no dedup keyed on `event_id` — delivery is only
best-effort exactly-once via the Redis Streams consumer-group ack
(`xack` after a successful DB commit). If a process crashes after commit but
before ack, the message will be redelivered and re-applied, double-counting
rollups. This is a gap relative to the documented contract, not an
implemented feature.

## Running locally

Via the repo's `docker-compose.yml` (service name `reporting`):

- Built from `services/reporting/Dockerfile` (context is repo root; it
  installs `services/shared` first, then this service's `pyproject.toml`).
- `DATABASE_URL` points at a dedicated `reporting_db` Postgres database.
- `REDIS_URL` points at the shared Redis instance used for all event
  streams.
- `INTERNAL_API_SECRET` protects the `internal_stats` router.
- Container start runs `alembic upgrade head` then
  `uvicorn app.main:app --host 0.0.0.0 --port 8000`; health check hits
  `/docs`, and the app also exposes `GET /health`.

```
docker compose up reporting
```

For standalone dev, install `services/shared` then this package's
`pyproject.toml` (FastAPI, SQLAlchemy async + asyncpg, Alembic, redis-py) and
run the same Alembic + uvicorn commands with `DATABASE_URL`/`REDIS_URL` set.
