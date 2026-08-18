"""Unified LLM provider chain for planner chat and ai-worker generation.

Both services previously maintained drifted copies (Gemini defaults, Ollama
availability caching, streaming). This module is the single source of truth.

Default production/dev config keeps CHAT_PROVIDER=ollama / GENERATION_PROVIDER=ollama
so only local Qwen (OLLAMA_MODEL=travlplanr) is used. Cloud backends exist for
optional fallback when explicitly enabled via env — they are never forced on.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections.abc import AsyncIterator
from typing import Any

import httpx

from shared.ollama_options import (
    build_ollama_options,
    extract_ollama_chat_content,
    extract_ollama_generate_response,
    ollama_base_url,
    ollama_keep_alive,
    ollama_model,
)

logger = logging.getLogger(__name__)

CHAT_TIMEOUT = float(os.environ.get("CHAT_TIMEOUT_SECONDS", "30"))
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT_SECONDS", "45"))
# Align chat + worker on a real, current Gemini Flash id. Override with GEMINI_MODEL.
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"
DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
_PLACEHOLDER_KEYS = {"", "placeholder_key", "<your_anthropic_api_key>", "your_anthropic_api_key"}


def valid_key(key: str | None) -> bool:
    k = (key or "").strip()
    return bool(k) and k.lower() not in _PLACEHOLDER_KEYS and not k.startswith("<")


def _gemini_api_key() -> str:
    return (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()


def _gemini_model() -> str:
    return os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)


def _groq_model() -> str:
    return os.environ.get("GROQ_MODEL", DEFAULT_GROQ_MODEL)


def _anthropic_model() -> str:
    return os.environ.get("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)


def log_provider_failure(provider_name: str, exc: Exception, *, kind: str = "llm") -> None:
    status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
    if status in (401, 403):
        logger.error(
            "%s provider auth failure — check API key",
            kind,
            extra={"provider": provider_name, "status_code": status, "error": str(exc)[:300]},
        )
    elif status == 429:
        logger.warning(
            "%s provider rate limited",
            kind,
            extra={"provider": provider_name, "status_code": status, "error": str(exc)[:300]},
        )
    else:
        logger.warning(
            "%s provider failed",
            kind,
            extra={"provider": provider_name, "status_code": status, "error": str(exc)[:300]},
        )


def _history_as_messages(
    system_prompt: str,
    message: str,
    history: list[dict[str, str]] | None,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    for turn in (history or [])[-20:]:
        role = turn.get("role", "user")
        if role in {"user", "assistant"} and turn.get("content"):
            messages.append({"role": role, "content": turn["content"]})
    messages.append({"role": "user", "content": message})
    return messages


# ---------------------------------------------------------------------------
# Ollama
# ---------------------------------------------------------------------------


class OllamaProvider:
    name = "ollama"
    _AVAILABILITY_TTL_SECONDS = 5.0
    _cached_available: bool | None = None
    _cached_at: float = 0.0
    _probe_lock: asyncio.Lock | None = None

    @classmethod
    async def is_available(cls) -> bool:
        if cls._probe_lock is None:
            cls._probe_lock = asyncio.Lock()

        now = time.monotonic()
        if cls._cached_available is not None and (now - cls._cached_at) < cls._AVAILABILITY_TTL_SECONDS:
            return cls._cached_available

        async with cls._probe_lock:
            now = time.monotonic()
            if cls._cached_available is not None and (now - cls._cached_at) < cls._AVAILABILITY_TTL_SECONDS:
                return cls._cached_available

            base_url = ollama_base_url()
            try:
                async with httpx.AsyncClient(timeout=1.5) as client:
                    resp = await client.get(f"{base_url}/api/tags")
                    available = resp.status_code == 200
            except Exception:
                available = False

            cls._cached_available = available
            cls._cached_at = now
            return available

    @classmethod
    def clear_availability_cache(cls) -> None:
        cls._cached_available = None
        cls._cached_at = 0.0

    @classmethod
    async def chat(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        timeout: float | None = None,
        format: str | dict | None = None,
        model: str | None = None,
    ) -> str:
        base_url = ollama_base_url()
        model_name = model or ollama_model()
        messages = _history_as_messages(system_prompt, message, history)
        payload: dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "stream": False,
            "think": False,
            "keep_alive": ollama_keep_alive(),
            "options": build_ollama_options(temperature=temperature, num_predict=max_tokens),
        }
        if format is not None:
            payload["format"] = format

        async with httpx.AsyncClient(timeout=timeout or CHAT_TIMEOUT) as client:
            resp = await client.post(f"{base_url}/api/chat", json=payload)
            resp.raise_for_status()
            text = extract_ollama_chat_content(resp.json())
            if not text:
                raise ValueError("Ollama returned an empty chat response")
            return text

    @classmethod
    async def chat_stream(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> AsyncIterator[str]:
        base_url = ollama_base_url()
        model_name = ollama_model()
        messages = _history_as_messages(system_prompt, message, history)
        stream_timeout = httpx.Timeout(
            connect=5.0, read=max(CHAT_TIMEOUT * 4, 120.0), write=10.0, pool=10.0
        )
        async with httpx.AsyncClient(timeout=stream_timeout) as client:
            async with client.stream(
                "POST",
                f"{base_url}/api/chat",
                json={
                    "model": model_name,
                    "messages": messages,
                    "stream": True,
                    "think": False,
                    "keep_alive": ollama_keep_alive(),
                    "options": build_ollama_options(temperature=temperature, num_predict=max_tokens),
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        payload = json.loads(line)
                    except ValueError:
                        continue
                    chunk = (payload.get("message") or {}).get("content") or ""
                    if chunk:
                        yield chunk
                    if payload.get("done"):
                        return

    @classmethod
    async def complete(cls, prompt: str, *, max_tokens: int, temperature: float) -> str:
        base_url = ollama_base_url()
        model_name = ollama_model()
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            resp = await client.post(
                f"{base_url}/api/generate",
                json={
                    "model": model_name,
                    "prompt": prompt,
                    "stream": False,
                    "think": False,
                    "keep_alive": ollama_keep_alive(),
                    "options": build_ollama_options(temperature=temperature, num_predict=max_tokens),
                },
            )
            resp.raise_for_status()
            text = extract_ollama_generate_response(resp.json())
            if not text:
                raise ValueError("Ollama returned an empty generation response")
            return text


# ---------------------------------------------------------------------------
# Groq
# ---------------------------------------------------------------------------


class GroqProvider:
    name = "groq"

    @classmethod
    async def is_available(cls) -> bool:
        return valid_key(os.environ.get("GROQ_API_KEY"))

    @classmethod
    async def chat(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        timeout: float | None = None,
        response_format: dict | None = None,
    ) -> str:
        api_key = os.environ.get("GROQ_API_KEY", "")
        messages = _history_as_messages(system_prompt, message, history)
        body: dict[str, Any] = {
            "model": _groq_model(),
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }
        if response_format is not None:
            body["response_format"] = response_format
        async with httpx.AsyncClient(timeout=timeout or CHAT_TIMEOUT) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

    @classmethod
    async def chat_stream(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> AsyncIterator[str]:
        api_key = os.environ.get("GROQ_API_KEY", "")
        messages = _history_as_messages(system_prompt, message, history)
        stream_timeout = httpx.Timeout(connect=5.0, read=max(CHAT_TIMEOUT * 4, 120.0), write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=stream_timeout) as client:
            async with client.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": _groq_model(),
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": messages,
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        return
                    try:
                        payload = json.loads(data)
                    except ValueError:
                        continue
                    delta = (payload.get("choices") or [{}])[0].get("delta") or {}
                    chunk = delta.get("content") or ""
                    if chunk:
                        yield chunk

    @classmethod
    async def complete(cls, prompt: str, *, max_tokens: int, temperature: float) -> str:
        return await cls.chat(prompt, "", temperature=temperature, max_tokens=max_tokens, timeout=LLM_TIMEOUT)


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------


class GeminiProvider:
    name = "gemini"

    @classmethod
    async def is_available(cls) -> bool:
        return valid_key(_gemini_api_key())

    @classmethod
    def _contents(
        cls,
        message: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> list[dict]:
        contents: list[dict] = []
        for turn in (history or [])[-20:]:
            role = turn.get("role")
            content = (turn.get("content") or "").strip()
            if role in {"user", "assistant"} and content:
                contents.append(
                    {
                        "role": "model" if role == "assistant" else "user",
                        "parts": [{"text": content}],
                    }
                )
        contents.append({"role": "user", "parts": [{"text": message}]})
        return contents

    @classmethod
    async def chat(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        timeout: float | None = None,
        response_mime_type: str | None = None,
    ) -> str:
        api_key = _gemini_api_key()
        model = _gemini_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        gen_cfg: dict[str, Any] = {"maxOutputTokens": max_tokens, "temperature": temperature}
        if response_mime_type:
            gen_cfg["responseMimeType"] = response_mime_type
        body: dict[str, Any] = {
            "contents": cls._contents(message, history=history),
            "generationConfig": gen_cfg,
        }
        if system_prompt:
            body["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        async with httpx.AsyncClient(timeout=timeout or CHAT_TIMEOUT) as client:
            resp = await client.post(url, headers={"x-goog-api-key": api_key}, json=body)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    @classmethod
    async def chat_stream(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> AsyncIterator[str]:
        api_key = _gemini_api_key()
        model = _gemini_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
        body: dict[str, Any] = {
            "contents": cls._contents(message, history=history),
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
        }
        if system_prompt:
            body["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        stream_timeout = httpx.Timeout(connect=5.0, read=max(CHAT_TIMEOUT * 4, 120.0), write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=stream_timeout) as client:
            async with client.stream(
                "POST", url, headers={"x-goog-api-key": api_key}, json=body
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        payload = json.loads(data)
                    except ValueError:
                        continue
                    parts = (((payload.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
                    for part in parts:
                        chunk = part.get("text") or ""
                        if chunk:
                            yield chunk

    @classmethod
    async def complete(cls, prompt: str, *, max_tokens: int, temperature: float) -> str:
        return await cls.chat(prompt, "", temperature=temperature, max_tokens=max_tokens, timeout=LLM_TIMEOUT)


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------


class AnthropicProvider:
    name = "anthropic"
    _client: Any = None
    _client_lock = asyncio.Lock()

    @classmethod
    async def is_available(cls) -> bool:
        return valid_key(os.environ.get("ANTHROPIC_API_KEY"))

    @classmethod
    def _get_client_sync(cls):
        """Non-async client access (used internally within already-async contexts)."""
        if cls._client is None:
            from anthropic import AsyncAnthropic

            cls._client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        return cls._client

    @classmethod
    def _turns(cls, message: str, history: list[dict[str, str]] | None) -> list[dict[str, str]]:
        turns: list[dict[str, str]] = []
        for turn in (history or [])[-20:]:
            role = turn.get("role", "user")
            if role in {"user", "assistant"} and turn.get("content"):
                turns.append({"role": role, "content": turn["content"]})
        turns.append({"role": "user", "content": message})
        return turns

    @classmethod
    async def chat(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> str:
        response = await cls._get_client().messages.create(
            model=_anthropic_model(),
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt or "",
            messages=cls._turns(message, history),
        )
        block = response.content[0]
        return getattr(block, "text", "") or ""

    @classmethod
    async def chat_stream(
        cls,
        message: str,
        system_prompt: str,
        *,
        history: list[dict[str, str]] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> AsyncIterator[str]:
        async with cls._get_client().messages.stream(
            model=_anthropic_model(),
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt or "",
            messages=cls._turns(message, history),
        ) as stream:
            async for text in stream.text_stream:
                if text:
                    yield text

    @classmethod
    async def complete(cls, prompt: str, *, max_tokens: int, temperature: float) -> str:
        return await cls.chat(prompt, "", temperature=temperature, max_tokens=max_tokens)


PROVIDERS: dict[str, type] = {
    "ollama": OllamaProvider,
    "groq": GroqProvider,
    "gemini": GeminiProvider,
    "anthropic": AnthropicProvider,
}

# Back-compat aliases used by chat_providers / tests
OllamaBackend = OllamaProvider
GroqBackend = GroqProvider
GeminiBackend = GeminiProvider
AnthropicBackend = AnthropicProvider


async def resolve_provider_chain(*, env_var: str = "CHAT_PROVIDER") -> list[str]:
    """Return provider names to try, in order.

    Explicit CHAT_PROVIDER / GENERATION_PROVIDER=ollama (our default) returns
    only local Ollama/Qwen — cloud providers are never contacted.
    """
    # Prefer the named env var; generation also accepts CHAT_PROVIDER as alias.
    explicit = (os.environ.get(env_var) or "").lower().strip()
    if not explicit and env_var == "GENERATION_PROVIDER":
        explicit = (os.environ.get("CHAT_PROVIDER") or "auto").lower().strip()
    elif not explicit:
        explicit = "auto"

    if explicit in {"ollama", "groq", "gemini", "anthropic"}:
        return [explicit]
    if explicit == "dev":
        return []

    chain: list[str] = []
    if await OllamaProvider.is_available():
        chain.append("ollama")
    if await GroqProvider.is_available():
        chain.append("groq")
    if await GeminiProvider.is_available():
        chain.append("gemini")
    if await AnthropicProvider.is_available():
        chain.append("anthropic")
    return chain


async def chat_reply(
    message: str,
    system_prompt: str,
    *,
    history: list[dict[str, str]] | None = None,
    provider_name: str,
    max_tokens: int = 450,
) -> str:
    provider = PROVIDERS[provider_name]
    return await provider.chat(
        message, system_prompt, history=history, max_tokens=max_tokens
    )


async def chat_reply_stream(
    message: str,
    system_prompt: str,
    *,
    history: list[dict[str, str]] | None = None,
    provider_name: str,
    max_tokens: int = 450,
) -> AsyncIterator[str]:
    provider = PROVIDERS[provider_name]
    async for chunk in provider.chat_stream(
        message, system_prompt, history=history, max_tokens=max_tokens
    ):
        yield chunk


async def complete(prompt: str, *, max_tokens: int = 2000, temperature: float = 0.7) -> tuple[str, str]:
    """Call the first available generation provider. Returns (text, provider_name)."""
    chain = await resolve_provider_chain(env_var="GENERATION_PROVIDER")
    last_error: Exception | None = None

    for provider_name in chain:
        provider_cls = PROVIDERS.get(provider_name)
        if not provider_cls or not await provider_cls.is_available():
            continue
        try:
            text = await provider_cls.complete(prompt, max_tokens=max_tokens, temperature=temperature)
            input_tokens = len(prompt) // 4
            output_tokens = len(text) // 4
            cost = 0.0
            if provider_name == "groq":
                cost = (input_tokens * 0.05 + output_tokens * 0.08) / 1_000_000
            elif provider_name == "gemini":
                cost = (input_tokens * 0.075 + output_tokens * 0.30) / 1_000_000
            elif provider_name == "anthropic":
                cost = (input_tokens * 0.25 + output_tokens * 1.25) / 1_000_000

            logger.info(
                "generation llm succeeded",
                extra={
                    "provider": provider_name,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost_usd": cost,
                },
            )
            return text, provider_name
        except Exception as exc:
            last_error = exc
            log_provider_failure(provider_name, exc, kind="generation")

    raise RuntimeError(f"All generation providers failed: {last_error}")


async def structured_json_chat(
    message: str,
    system_prompt: str,
    *,
    history: list[dict[str, str]] | None = None,
    timeout: float = 6.0,
    max_tokens: int = 220,
    model: str | None = None,
) -> str | None:
    """Best-effort JSON-mode completion. Prefers local Ollama/Qwen; only tries
    cloud providers when CHAT_PROVIDER is auto/cloud and keys exist. Returns
    None on total failure so callers keep regex-only behavior."""
    chain = await resolve_provider_chain(env_var="CHAT_PROVIDER")
    # Cost-aware slot routing: local Ollama first, then cheap Groq, then premium Gemini/Anthropic
    ordered = sorted(chain, key=lambda n: 0 if n == "ollama" else (1 if n == "groq" else 2))

    for name in ordered:
        try:
            if name == "ollama":
                return await OllamaProvider.chat(
                    message,
                    system_prompt,
                    history=history,
                    temperature=0.1,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    format="json",
                    model=model,
                )
            if name == "groq":
                return await GroqProvider.chat(
                    message,
                    system_prompt,
                    history=history,
                    temperature=0.1,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    response_format={"type": "json_object"},
                )
            if name == "gemini":
                return await GeminiProvider.chat(
                    message,
                    system_prompt,
                    history=history,
                    temperature=0.1,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    response_mime_type="application/json",
                )
            if name == "anthropic":
                # Anthropic has no JSON mode flag here — ask in the prompt and parse.
                return await AnthropicProvider.chat(
                    message,
                    system_prompt + "\n\nRespond with ONLY a valid JSON object.",
                    history=history,
                    temperature=0.1,
                    max_tokens=max_tokens,
                )
        except Exception as exc:
            log_provider_failure(name, exc, kind="structured_extraction")
            continue
    return None
