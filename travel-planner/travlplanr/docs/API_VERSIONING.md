# API Versioning Policy

## Current state

Every service prefixes all routes with `/api/v1/` (see `services/*/app/main.py`
`include_router(..., prefix="/api/v1/...")` calls) and the gateway
(`infra/gateway/nginx.conf`) routes on that same prefix. There is currently
only one version in production — this document defines how a second version
would be introduced without breaking existing clients.

## Principles

1. **Version the URL path, not headers or content negotiation.** `/api/v1/`,
   `/api/v2/` — consistent with what's already deployed, easy to route at the
   gateway, and visible in logs/traces without extra parsing.
2. **A version bump is for breaking changes only.** Additive changes (new
   optional field, new endpoint, new enum value the client can ignore) ship
   into `v1` directly. Breaking changes (removed/renamed field, changed
   status code, changed auth requirement, removed endpoint) require `v2`.
3. **Services version independently.** `planner` moving to `v2` does not
   require `identity` or `affiliate` to also cut a `v2` — each service's
   version reflects its own contract, not a platform-wide release train.
4. **Old versions are supported for a deprecation window, not forever.** Once
   a service ships `v2` for a given surface, `v1` gets a `Deprecation` and
   `Sunset` response header (RFC 8594) and a tracked removal date — default
   window is 90 days unless a consumer (e.g. the B2B portal) needs longer.
5. **The error envelope (`{code, message, details, request_id}`, see
   `services/shared/errors.py`) does not version with the API** — it is
   part of the transport contract and stays stable across `v1`/`v2`.

## Adding a `v2` endpoint

1. New router module registered under `/api/v1/<domain>` gets duplicated (or
   composed) as `/api/v2/<domain>` in the same service's `main.py`.
2. Add the gateway route in `infra/gateway/nginx.conf` alongside the existing
   `v1` location block.
3. Regenerate the OpenAPI schema and TypeScript client
   (`npm run codegen` in `apps/web`, see `scripts/export_openapi.py`) —
   consumers pick up the new types, `v1` types stay untouched.
4. If replacing a `v1` endpoint outright, add `Deprecation`/`Sunset` headers
   to the `v1` handler and note the removal date in that service's
   `README.md`.

## What does NOT require a new version

- Adding a new optional request field or response field
- Adding a new endpoint under the existing prefix
- Adding a new value to an existing enum, if clients are expected to handle
  unknown values gracefully (document this expectation per-field)
- Performance or internal implementation changes with no observable contract
  change

## Internal (service-to-service) APIs

Routes under `/api/v1/internal/` (see `infra/gateway/nginx.conf`, blocked
from external access) are not subject to this policy in the same way —
they're only consumed by other Travlplanr services deployed from the same
repo, so breaking changes there are coordinated via a single PR touching both
sides rather than a version bump.
