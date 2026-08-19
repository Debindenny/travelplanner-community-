# Identity Service

FastAPI service for users, customer profiles, staff, auth, plans, and subscriptions.

## Owned Domains

Routers in `app/routers/`:

- **auth** (`/api/v1/auth`) — login, signup, OTP request/verify, logout, refresh, dev admin seeding (`/seed`).
- **me** (`/api/v1/me`) — current-user self-service: plan, profile (get/update), avatar/cover upload, preferences, notification settings, data export, account deletion.
- **customers** (`/api/v1/admin/customers`) — admin CRUD over customer records, plus a "recent" listing.
- **staff** (`/api/v1/admin/staff`) — admin CRUD over staff records.
- **agents** (`/api/v1/admin/agents`) — agent listing and approve/reject workflow.
- **internal** (`/api/v1/internal`, secured by `verify_internal_secret`) — user identity/plan resolution for other services.
- `GET /health` — defined directly in `main.py`.

## DB Tables

Models in `app/models/`:

- `User` → `users`
- `StaffProfile` → `staff`
- `CustomerProfile` → `customer_profiles`
- `CustomerAssignment` → `customer_assignments`
- `Plan` → `plans`
- `Subscription` → `subscriptions`
- `NotificationSetting` → `notification_settings`

## Events

### Emitted

Published to stream `events:identity` via `shared.redis_client.emit_event` using `shared.events.DomainEvent` / `EventType`:

- `CUSTOMER_CREATED` — `routers/customers.py`, `routers/auth.py` (signup)
- `CUSTOMER_STATUS_CHANGED` — `routers/customers.py`
- `CUSTOMER_UPDATED` — `routers/customers.py`
- `CUSTOMER_DELETED` — `routers/customers.py`
- `STAFF_CREATED` — `routers/staff.py`, `routers/auth.py` (signup)
- `STAFF_DELETED` — `routers/staff.py`

Note: `shared.events.EventType` also defines `STAFF_UPDATED` and `STAFF_STATUS_CHANGED`, but nothing in this service currently emits them.

### Consumed

`app/consumers/ai_worker_consumer.py` runs as a background task (started in `main.py`'s lifespan) and consumes `GENERATION_COMPLETED` events from stream `events:ai-worker` (consumer group `identity_group`). On receipt it looks up the customer's active `Subscription` and increments `plans_used`.

## Running Locally

Run via docker-compose from the repo root (service name `identity`, depends on `postgres` and `redis`):

```bash
docker compose up identity
```

The container runs migrations then starts the API:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Key env vars (set in `docker-compose.yml`): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SERVICE_NAME=identity`, `INTERNAL_API_SECRET`.

Not published directly to the host — access via the `gateway` (nginx) service, which routes `/api/*` requests to it.
