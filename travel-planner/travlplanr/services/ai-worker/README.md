# ai-worker

Stateless Redis Streams consumer that generates itineraries asynchronously.
It exposes no HTTP API — all interaction happens over the `events:ai-worker` stream.

## What it consumes

- Stream: `STREAM_AI_WORKER = "events:ai-worker"` (defined in `services/shared/events.py`)
- Consumer group: `GROUP_NAME = "ai-worker-group"` (hardcoded in `app/main.py`), created with
  `redis.xgroup_create(STREAM_AI_WORKER, GROUP_NAME, id="0", mkstream=True)`, tolerating `BUSYGROUP`
- Consumer name: `CONSUMER_NAME`, from env `AI_WORKER_CONSUMER_NAME` (default `"worker-1"`)
- Main loop reclaims stale pending entries via `redis.xautoclaim` before reading new ones with
  `redis.xreadgroup(groupname=GROUP_NAME, consumername=CONSUMER_NAME, streams={STREAM_AI_WORKER: ">"}, count=10, block=5000)`
- Only handles `EventType.GENERATION_REQUESTED` (`"generation.requested"`)

**Known discrepancy:** `infra/keda/ai-worker-scaledobject.yaml` was recently fixed to use the
`redis-streams` scaler (previously a Redis list), but it still specifies `consumerGroup: ai-worker`,
which does not match the actual group name `ai-worker-group` used in code. This should be corrected
so KEDA reads lag from the group the worker actually uses.

## What it emits

Back onto the same stream, using event types from `services/shared/events.py`:

- `EventType.GENERATION_STARTED` (`"generation.started"`)
- `EventType.GENERATION_COMPLETED` (`"generation.completed"`)
- `EventType.GENERATION_FAILED` (`"generation.failed"`)

`EventType.GENERATION_PROGRESS` (`"generation.progress"`) exists in the enum but is not currently
emitted or consumed anywhere in this service.

Failed messages are also written to a dead-letter stream, `f"{STREAM_AI_WORKER}:dlq"` (i.e.
`events:ai-worker:dlq`), via `redis.xadd`.

## LLM provider fallback chain

Implemented in `app/llm_providers.py` via `resolve_provider_chain()`. Default mode `"auto"` tries
providers in order, using each provider's `is_available()` check:

1. **Ollama** — `OLLAMA_BASE_URL` (default `http://host.docker.internal:11434`), `OLLAMA_MODEL` (default `travlplanr`)
2. **Groq** — `GROQ_API_KEY`, `GROQ_MODEL` (code default `openai/gpt-oss-20b`; docker-compose sets `llama-3.1-8b-instant` — these differ, worth reconciling)
3. **Gemini** — `GEMINI_API_KEY` or `GOOGLE_API_KEY`, `GEMINI_MODEL` (default `gemini-2.0-flash`)
4. **Anthropic** — `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`)

A single provider can be forced via the `GENERATION_PROVIDER` / `CHAT_PROVIDER` env vars
(`ollama` | `groq` | `gemini` | `anthropic`). Groq and Gemini are called directly via `httpx`
(no SDK dependency); only `anthropic`'s official SDK is a declared dependency.

## Affiliate inventory hydration

`_hydrate_segments` / `_hydrate_one_segment` in `app/main.py` concurrently call
`GET http://affiliate:8000/api/v1/inventory/search` per itinerary segment, populating `provider`,
`price`, `deep_link`, `start_time`, `end_time`, `source` (`"inventory"` or `"ai_suggested"`), and
`bookable`. This is best-effort: failures are caught and the segment falls back to
AI-suggested/default values rather than failing the whole generation.

## Running locally

Via `docker-compose.yml` (service `ai-worker`): builds from `services/ai-worker/Dockerfile`, depends
on `redis` being healthy, and takes its config entirely from env vars (`REDIS_URL`,
`GENERATION_PROVIDER`, `CHAT_PROVIDER`, `OLLAMA_*`, `GROQ_*`, `GEMINI_*`/`GOOGLE_*`,
`ANTHROPIC_API_KEY`, etc.). It exposes no ports and has no HTTP healthcheck (process-based only).

```
docker compose up ai-worker
```

Standalone (from `services/ai-worker/`), there is no `[project.scripts]` entry point in
`pyproject.toml`; run the module directly:

```
python -m app.main
```

Requires a reachable Redis instance and at least one LLM provider configured (Ollama running
locally is the default/free option via `OLLAMA_BASE_URL`).
