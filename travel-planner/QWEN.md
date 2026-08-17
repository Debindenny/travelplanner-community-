# Travlplanr

Full-stack travel planning platform. The actual product lives in `travlplanr/` —
everything else at this level (`skills/`, `agent-skills/`, `claude-marketplace/`,
`bencium-claude-code-design-skill/`, `ui-ux-pro-max-skill/`) is unrelated
tooling/skill repos, not part of the product. Always `cd travlplanr` before
touching product code.

`BUGS.md` at this level is **stale** — it references `app.module.ts` and NgRx
patterns from an old NgModule-based version of the app. The frontend has since
been rewritten as 100% standalone Angular components with signals. Don't trust
it; verify current code instead.

There is **no git repository** anywhere in this tree yet (`travlplanr/` has a
`.gitignore` and `.github/` but no `.git/`). Don't assume `git status`/`git log`
will work — check first.

## Monorepo structure (inside `travlplanr/`)

```
travlplanr/
├── apps/web/          Angular 17 SPA — two projects in one workspace:
│                        "web" (main app, port 4200) and "admin" (port 4320)
├── services/
│   ├── identity/       Auth, users, JWT (FastAPI)
│   ├── planner/        Trips, itineraries, chat/NLU, destinations (FastAPI)
│   ├── ai-worker/      LLM itinerary generation worker
│   ├── affiliate/      Flights/hotels/affiliate integrations
│   ├── reporting/      Analytics/reporting service
│   └── shared/         Shared Python lib (auth deps, events, JWT) — imported
│                        by every service as `from shared...`
├── infra/              Bicep IaC + KEDA scaling (Azure)
└── docker-compose.yml  Full local stack (Postgres+pgvector, Redis, MinIO,
                          Ollama, whisper STT, nginx gateway on :8080)
```

## Tech stack

- Frontend: Angular 17 (standalone components + signals, NOT NgModules), NgRx
  17 (only where still used — most new code is signals-first), Tailwind 3.
- Backend: Python 3.12, FastAPI, uv workspace (`services/*` are workspace
  members), per-service `pyproject.toml`.
- DB: PostgreSQL (pgvector), one DB per service in the same local Postgres
  instance (`identity_db`, `planner_db`, `affiliate_db`, `reporting_db`).
- Local LLM: Ollama (`OLLAMA_MODEL=travlplanr`), with Groq/Gemini/Anthropic as
  optional cloud fallbacks via `CHAT_PROVIDER=auto`.
- Prod AI: Azure OpenAI.

## Commands

Frontend (`cd travlplanr/apps/web`):
- `npm start` — serves the "web" project on :4200 (proxies `/api` → :8080)
- `npm run start:admin` — serves the "admin" project on :4320
- `npm test` — Karma/Jasmine unit tests
- `npm run test:all-chat` — chat feature + integration + destination-tier
  test scripts (`scripts/test-*.ts` / `.sh`)
- `npm run lint:hex` — fails on hardcoded hex colors outside the design tokens

Backend (from `travlplanr/` root):
- `pytest services` — full suite (`testpaths = ["services"]` in root
  `pyproject.toml`)
- `pytest services/planner/tests` — planner-only (chat intent, trip slots,
  destination tiers — the most actively-changed area)
- Use `python3`, not `python` — `python` is not on PATH on this box.
- Some test modules (`test_collaboration_helpers.py`, `test_input_validation.py`,
  `test_trip_helpers.py`, parts of `test_destination_tiers.py`) currently fail
  to **collect** with `ModuleNotFoundError: No module named 'jose'` — a missing
  dev dependency in this environment, unrelated to any code change. Don't
  chase this; just note it's pre-existing and exclude with `--ignore` if it
  blocks an unrelated run.
- `test_chat_providers.py::test_resolve_provider_chain_*` currently fail
  (assert against a coroutine instead of an awaited value) — also pre-existing,
  unrelated to chat/trip-slot work.

Full stack: `docker compose up` from `travlplanr/` (gateway on :8080 routes
`/api/*` to the right service, mirroring Azure APIM in prod).

## Architecture conventions worth knowing before changing chat/trip code

- **Chat-first planning, wizard is secondary.** The hero search bar on the
  landing page (`apps/web/.../landing/components/hero-section`) is the
  primary trip-planning entry point via `TravelChatSessionService`. The
  `/wizard` route (form-based, `authGuard`-protected) still exists as an
  "advanced planner" escape hatch, not the default flow. CTAs that used to
  jump straight to `/wizard` (explore page search, journeys carousel) now
  call `chat.prefillComposer(...)` and navigate home instead, so chat picks
  up the query.
- **Never let a trip auto-create without explicit user-stated info.** See
  `services/planner/app/services/trip_planning_slots.py` — `TripPlanningSlots`
  tracks `duration_confirmed` / `travelers_confirmed` / `prefs_confirmed`,
  which are only `True` when a value came from the user's actual words
  (regex/history), never from the best-effort LLM hint pass
  (`llm_slot_extraction.py`). The small local Ollama model used for hinting
  does NOT reliably honor "never guess" — it will happily invent a duration
  or preference. `ready_to_auto_create()` must keep gating on the confirmed
  flags, not raw values, or trips get created without dates/travelers/prefs.
- `enrich_reply()` in `chat_intent.py` appends canned "I'm building your
  itinerary..." tails. Whenever it's about to say a clarifying question OR
  hasn't actually triggered a create action, it must call
  `_strip_premature_action_claims()` first — otherwise the raw LLM reply can
  independently claim it's "already building/opening" something that didn't
  happen, producing contradictory replies.
- Frontend mirror of this gating lives in
  `apps/web/.../shared/utils/chat-intent.util.ts` (`buildClientActions`) —
  it's regex-only (no LLM hints available client-side), so it's already safe,
  but keep both sides in sync if the gating rules change.
- **Itinerary images are enriched server-side.** AI-generated trips are saved
  through `services/planner/app/consumers/ai_worker_consumer.py`, which
  normalizes segments and then calls
  `services/planner/app/services/itinerary_image_service.py`. That service uses
  `image_search_service.search_images_async()` to try exact-place Wikipedia
  thumbnails first for landmarks/attractions, then Unsplash when
  `UNSPLASH_ACCESS_KEY` is set, with retry query tiers for weak hotel/activity
  matches. Good provider results cache via `IMAGE_SEARCH_CACHE_TTL_SECONDS`;
  curated fallback results use the shorter `IMAGE_FALLBACK_CACHE_TTL_SECONDS` so
  weak misses are retried sooner. Keep image API keys server-side only; Angular
  should render persisted `Trip.image` / segment `image` / `imageUrl` values and
  use local pools only for missing or generic placeholders.

## Angular gotchas hit in this codebase

- **Never use `??` (or other complex expressions) directly in an `@for` track
  clause**, especially inside nested `@if`/`@else` blocks — Angular's
  control-flow compiler can generate code referencing an undefined temp
  variable (`ReferenceError: tmp_N_0 is not defined`) at runtime, and the
  failure is silent in the UI (that section just renders blank, no visible
  error unless you check devtools console). Use a plain `trackByX(item)`
  method on the component instead of `track item.id ?? item.title`.
- Package cards, itinerary cards, etc. — always search for `track .*\?\?`
  before adding a new `@for` loop with an optional id field.

## Where to look first for common tasks

- Chat NLU / intent detection: `services/planner/app/services/chat_intent.py`
- Trip slot collection: `services/planner/app/services/trip_planning_slots.py`
- Destination resolution/tiers: `services/planner/app/services/destination_resolver.py`
- Chat system prompt / LLM provider chain: `services/planner/app/services/chat_providers.py`
- Chat HTTP route: `services/planner/app/routers/chat.py`
- Hero chat UI: `apps/web/src/app/landing/components/hero-section/hero-section.component.ts`
- Floating chatbot UI: `apps/web/src/app/shared/components/floating-chatbot/floating-chatbot.component.ts`
- Shared chat session state: `apps/web/src/app/shared/services/travel-chat-session.service.ts`
- Cross-component chat visibility/coordination: `apps/web/src/app/shared/services/chat-context.service.ts`
- Packages listing/filtering: `apps/web/src/app/packages/packages-page.component.ts`
