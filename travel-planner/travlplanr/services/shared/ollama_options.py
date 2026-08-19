"""Shared Ollama request options — GPU-safe defaults for local inference."""

from __future__ import annotations

import os


def _int_env(name: str) -> int | None:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    return int(raw)


def ollama_base_url() -> str:
    """Default matches docker-compose; override with OLLAMA_BASE_URL."""
    return os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434").rstrip("/")


def ollama_model() -> str:
    """Return the model name to send to Ollama.

    ``travlplanr`` is a Modelfile alias over the same ``qwen3.8`` weights.
    On a single L40 we must use one model *name* with OneOps, or Ollama
    (MAX_LOADED_MODELS=1) unloads/reloads and both apps time out.
    Travlplanr still injects its travel system prompt via chat messages.
    """
    model = (os.environ.get("OLLAMA_MODEL") or "travlplanr").strip()
    shared = (os.environ.get("OLLAMA_SHARED_MODEL") or "qwen3.8-max").strip()
    if model in {"travlplanr", "travlplanr:latest"}:
        return shared or "qwen3.8-max"
    return model or "qwen3.8-max"


def ollama_keep_alive() -> str:
    # Long enough that the model survives normal gaps between chat messages;
    # the planner's warm-ping loop (keep_ollama_warm) refreshes it anyway.
    return os.environ.get("OLLAMA_KEEP_ALIVE", "30m")


def build_ollama_options(*, temperature: float, num_predict: int) -> dict:
    """Build Ollama `options` with env-tunable GPU limits."""
    options: dict = {
        "temperature": temperature,
        "num_predict": num_predict,
    }
    # Same 128k as the shared qwen3.8-max Modelfile. A smaller num_ctx on that
    # name rebuilds KV and stalls every app on the L40.
    options["num_ctx"] = _int_env("OLLAMA_NUM_CTX") or 131072
    return options


def extract_ollama_chat_content(payload: dict) -> str:
    """Return assistant text from /api/chat. Never exposes chain-of-thought."""
    message = payload.get("message") or {}
    content = (message.get("content") or "").strip()
    if content:
        return content
    # Thinking models may leave content empty when think mode is on — treat as no reply.
    return ""


def extract_ollama_generate_response(payload: dict) -> str:
    """Return text from /api/generate. Never exposes chain-of-thought."""
    response = (payload.get("response") or "").strip()
    if response:
        return response
    return ""
