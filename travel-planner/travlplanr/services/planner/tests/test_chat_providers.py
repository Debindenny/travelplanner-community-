"""Tests for chat provider chain (shared.llm_providers via chat_providers)."""
from __future__ import annotations

import asyncio

from app.services import chat_providers as cp
from shared.llm_providers import OllamaProvider, valid_key


def test_valid_key_accepts_real_rejects_placeholders():
    assert valid_key("gsk_real_groq_key_123") is True
    for bad in ["", "  ", "placeholder_key", "<your_anthropic_api_key>", None]:
        assert valid_key(bad) is False, f"expected {bad!r} to be invalid"


def test_backends_registered():
    assert set(cp._BACKENDS) == {"ollama", "groq", "gemini", "anthropic"}


def _disable_ollama(monkeypatch):
    """Stub the local-Ollama reachability probe so "auto" chain tests stay
    hermetic — otherwise resolve_provider_chain does a real network probe to
    the Ollama host, which is nondeterministic and slow in CI."""

    async def _unavailable(cls) -> bool:
        return False

    monkeypatch.setattr(OllamaProvider, "is_available", classmethod(_unavailable))
    monkeypatch.setattr(cp.OllamaBackend, "is_available", classmethod(_unavailable))


def test_resolve_provider_chain_ollama_only_when_forced(monkeypatch):
    """Platform default: CHAT_PROVIDER=ollama never contacts cloud providers."""
    monkeypatch.setenv("CHAT_PROVIDER", "ollama")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_key")
    monkeypatch.setenv("GEMINI_API_KEY", "gem_test")
    assert asyncio.run(cp.resolve_provider_chain()) == ["ollama"]


def test_resolve_provider_chain_auto_prefers_groq(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "auto")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    _disable_ollama(monkeypatch)
    assert asyncio.run(cp.resolve_provider_chain()) == ["groq"]


def test_resolve_provider_chain_auto_full_chain(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "auto")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GEMINI_API_KEY", "gem_test")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    _disable_ollama(monkeypatch)
    assert asyncio.run(cp.resolve_provider_chain()) == ["groq", "gemini", "anthropic"]


def test_resolve_provider_chain_explicit_groq(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "groq")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert asyncio.run(cp.resolve_provider_chain()) == ["groq"]


def test_resolve_provider_chain_dev_empty(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "dev")
    assert asyncio.run(cp.resolve_provider_chain()) == []


def test_generate_reply_falls_back_to_dev_when_no_keys(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "auto")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    _disable_ollama(monkeypatch)
    text, provider = asyncio.run(cp.generate_reply("hi", "Alice"))
    assert provider == "dev"
    assert text == ""


def test_build_system_prompt_includes_name():
    assert "Alice" in cp.build_system_prompt("Alice")
    assert "traveler" in cp.build_system_prompt("")
