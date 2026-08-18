# Architecture

## Service boundaries

| Service | Owns | Notes |
|---|---|---|
| `identity` | Auth, customers, staff, agents, plan usage | Issues JWTs consumed by every other service |
| `planner` | Trips, itineraries, chat/wizard, destinations, packages, checkout, collaboration, community, admin CMS | Largest service — candidate for future extraction (see Phase 4 of `DESIGN_ENHANCEMENT_PLAN.md`) |
| `ai-worker` | Async itinerary generation | Stateless Redis Streams consumer; no HTTP API |
| `affiliate` | Travel inventory search + bookings | TravelNext + Google Places/Routes + Tripadvisor |
| `reporting` | Dashboard projections, notifications, audit stats | Read-only consumer of domain events; never writes to other services' tables |
| `shared` | Event envelope, auth dependencies, rate limiting, circuit breaker, middleware | Imported by every service, not independently deployed |

## Gateway routing

External traffic enters through the nginx gateway (`infra/gateway/nginx.conf`), which routes by path prefix to the appropriate service container. Services are not reachable directly from outside the Docker network — internal service-to-service calls use `INTERNAL_API_SECRET` for auth.

## Event bus

Services communicate asynchronously over Redis Streams using the envelope defined in `services/shared/events.py`:

```python
class DomainEvent(BaseModel):
    event_id: str        # idempotency key, consumers dedupe on this
    event_type: EventType
    occurred_at: datetime
    actor_user_id: str | None
    subject_id: str
    tenant_id: str
    payload: dict[str, Any]
```

Delivery is at-least-once; consumers must be idempotent (dedupe on `event_id`).

### Streams

| Stream | Producer | Consumers |
|---|---|---|
| `events:identity` | identity | reporting |
| `events:planner` | planner | reporting |
| `events:affiliate` | affiliate | reporting |
| `events:ai-worker` | planner (enqueues generation requests) | ai-worker (consumer group `ai-worker`); ai-worker also publishes `generation.*` progress/result events back onto this stream |

### Event catalog (see `services/shared/events.py` for the source of truth)

- Identity: `customer.created/updated/status_changed/deleted`, `staff.created/updated/status_changed/deleted`
- Planner: `trip.created/updated/edited/status_changed/deleted`, `collaborator.invited`, `expense.added`
- Affiliate: `trip.booked`, `trip.cancelled`, `booking.refunded`
- AI Worker: `generation.requested/started/progress/completed/failed`
- Plan: `plan.used`

Reporting is the only writer of `audit_events`, `dashboard_metric_daily`, `trip_status_counts`, `staff_customer_counts`, and `notifications`.

## Frontend apps

| App | Path | Status |
|---|---|---|
| Customer | `apps/web/src/` | Primary SPA — landing, auth, wizard, trips, itinerary, explore, community |
| Admin | `apps/web/projects/admin/` | Lazy-routed (`loadComponent` per route, same pattern as customer); diverges visually from the customer design tokens |
| B2B | `apps/web/projects/b2b/` | Stub — planned for Phase 3/4 once agent APIs mature |
| Shared UI | `apps/web/projects/ui/` | Buttons, skeleton, empty-state — imported as `from 'ui'` by both customer and admin |

## API contract

- Every service exposes `/openapi.json`; `scripts/export_openapi.py` dumps each into `openapi/*.json` without booting a server, and `apps/web/scripts/codegen-api.mjs` generates TypeScript types into `apps/web/src/app/api/generated/` (`npm run codegen`).
- All services use the shared error envelope `{code, message, details, request_id}` (`services/shared/errors.py`, installed via `install_error_handlers(app)`).
- See `docs/API_VERSIONING.md` for the versioning policy, and `scripts/export_event_schemas.py` for the event-catalog JSON Schema export.

## Known architectural debt

- `planner` is a god-service carrying trips, chat, destinations, packages, checkout, collaboration, community, and CMS — gradual extraction is planned, not a big-bang rewrite.
- Dark mode exists in the admin app (`ThemeService`) but not yet in the customer app.
- `@angular/material` is still a dependency of the customer/admin apps (toast + confirm-dialog) pending a custom replacement.

See `DESIGN_ENHANCEMENT_PLAN.md` for the full roadmap.
