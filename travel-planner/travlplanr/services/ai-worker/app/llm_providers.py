"""LLM providers for itinerary generation — thin wrapper over shared.llm_providers.

Keeps the ai-worker import path (`from app.llm_providers import complete`) stable
while sharing the real implementation with planner chat so Gemini defaults and
Ollama availability caching cannot drift.

Default GENERATION_PROVIDER=ollama / CHAT_PROVIDER=ollama → local Qwen only.
"""

from __future__ import annotations

from shared.llm_providers import (  # noqa: F401 — re-exports for tests/callers
    AnthropicProvider,
    GeminiProvider,
    GroqProvider,
    OllamaProvider,
    PROVIDERS,
    complete,
    resolve_provider_chain as _resolve_provider_chain,
)


async def resolve_provider_chain() -> list[str]:
    return await _resolve_provider_chain(env_var="GENERATION_PROVIDER")
