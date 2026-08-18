# Backend testing

## Run

```bash
# from repo root (uses [tool.pytest.ini_options] testpaths = ["services"])
pytest services

# just the shared-package suite
pytest services/shared/tests
```

Requires Python 3.12 (the code uses `enum.StrEnum`). Install dev deps per service:
`pip install -e "services/identity[dev]"` etc., or `pip install pytest pytest-asyncio`.

## Layers

1. **Pure-logic tests (done):** `services/shared/tests/` — the domain-event envelope,
   the production JWT-secret guard, and the JWT encode/decode contract. No DB/Redis.
2. **Service unit tests (next):** validators, mappers, and pure helpers inside each
   service's `app/` — add a `tests/` dir per service.
3. **Integration tests (next):** spin up Postgres + Redis (Testcontainers or the
   compose stack) and exercise routers end-to-end with `httpx.AsyncClient`. Prioritise
   the money paths: OTP auth, wizard → generation → itinerary, checkout → booking,
   admin CRUD.
4. **Event-contract tests (next):** assert each producer emits the payload shape its
   consumer reads (catches mismatches like the segment-recount key drift).
