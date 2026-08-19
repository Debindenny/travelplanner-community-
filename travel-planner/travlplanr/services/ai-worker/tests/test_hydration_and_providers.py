"""Tests for concurrent segment hydration and Ollama availability caching.

Both are pure-logic once the network layer is faked out — no real HTTP, DB,
or Redis calls happen here. Async tests rely on this repo's root pyproject.toml
`asyncio_mode = "auto"` pytest-asyncio setting.
"""
from __future__ import annotations

import asyncio
import time

import pytest

from app.llm_providers import OllamaProvider
from app.main import _hydrate_segments, _pick_hotel_option


class _FakeResponse:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """Stand-in for httpx.AsyncClient supporting the `async with ... as client`
    usage in _hydrate_segments, with a pluggable `get` handler per test."""

    def __init__(self, handler, **_kwargs):
        self._handler = handler

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None):
        return await self._handler(url, params)


class _FakeTagsClient:
    """Stand-in for httpx.AsyncClient used by OllamaProvider.is_available()."""

    def __init__(self, call_counter: dict, **_kwargs):
        self._call_counter = call_counter

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url):
        self._call_counter["n"] += 1
        return _FakeResponse(200, None)


@pytest.fixture(autouse=True)
def _reset_ollama_cache():
    OllamaProvider._cached_available = None
    OllamaProvider._cached_at = 0.0
    yield
    OllamaProvider._cached_available = None
    OllamaProvider._cached_at = 0.0


# ── _hydrate_segments: concurrency + per-segment isolation ──────────────────

async def test_hydrate_segments_runs_concurrently(monkeypatch):
    """Ten segments each taking 50ms should finish in roughly one round-trip's
    time (concurrent), not ten round-trips (the old serial-loop behavior)."""
    import app.main as main_module

    async def handler(url, params):
        await asyncio.sleep(0.05)
        return _FakeResponse(200, [{"provider": "acme", "price": 100, "title": "Acme Option"}])

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))

    segments = [{"type": "activity", "day": i} for i in range(10)]

    start = time.monotonic()
    result = await _hydrate_segments("Paris", "standard", segments)
    elapsed = time.monotonic() - start

    assert len(result) == 10
    # Serial would take >= 10 * 0.05 = 0.5s; concurrent should be well under that.
    assert elapsed < 0.3
    assert all(seg["source"] == "inventory" and seg["bookable"] for seg in result)


async def test_hydrate_segments_isolates_per_segment_failure(monkeypatch):
    """One segment's inventory call failing must not affect the others, and
    the failed one falls back to ai_suggested/not-bookable rather than being
    dropped from the result or missing those keys entirely."""
    import app.main as main_module

    async def handler(url, params):
        if params["type"] == "hotel":
            raise RuntimeError("inventory unavailable for hotels")
        return _FakeResponse(200, [{"provider": "acme", "price": 100, "title": "Acme Option"}])

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))

    segments = [
        {"type": "flight", "day": 1},
        {"type": "hotel", "day": 1},
        {"type": "activity", "day": 1},
    ]

    result = await _hydrate_segments("Paris", "standard", segments)
    assert len(result) == 3
    flight, hotel, activity = result
    assert flight["source"] == "inventory" and flight["bookable"] is True
    assert hotel["source"] == "ai_suggested" and hotel["bookable"] is False
    assert activity["source"] == "inventory" and activity["bookable"] is True


async def test_hydrate_segments_rotates_through_options_by_index(monkeypatch):
    import app.main as main_module

    options = [{"provider": "a", "price": 1}, {"provider": "b", "price": 2}]

    async def handler(url, params):
        return _FakeResponse(200, options)

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))

    segments = [{"type": "activity", "day": i} for i in range(4)]
    result = await _hydrate_segments("Paris", "standard", segments)
    # idx % len(options): 0->a, 1->b, 2->a, 3->b
    assert [seg["provider"] for seg in result] == ["a", "b", "a", "b"]


def test_pick_hotel_option_uses_budget_tier():
    options = [{"price": 20, "title": "Hostel"}, {"price": 100, "title": "Mid"}, {"price": 400, "title": "Palace"}]
    assert _pick_hotel_option(options, "budget", 0)["title"] == "Hostel"
    assert _pick_hotel_option(options, "standard", 0)["title"] == "Mid"
    assert _pick_hotel_option(options, "premium", 0)["title"] == "Palace"


async def test_hydrate_hotel_replaces_ai_name_price_and_dates(monkeypatch):
    """AI may invent Leela Palace + Jan 2024 dates; live inventory must win."""
    import app.main as main_module

    async def handler(url, params):
        assert params["type"] == "hotel"
        assert params["date"] == "2026-07-18"
        assert params["location"] == "Bangalore"
        return _FakeResponse(
            200,
            [
                {
                    "provider": "travelomatix",
                    "title": "Westlake Hotels Amsterdam",
                    "price": 209.0,
                    "currency": "USD",
                    "image_url": "https://example.com/h.jpg",
                    "details": {
                        "checkin": "2026-07-18",
                        "checkout": "2026-07-20",
                        "address": "Airport Road",
                        "city": "Bangalore",
                        "resultToken": "tok",
                        "hotelId": "H1",
                        "bookable": True,
                    },
                },
                {
                    "provider": "travelomatix",
                    "title": "Budget Hostel",
                    "price": 28.0,
                    "currency": "USD",
                    "details": {"checkin": "2026-07-18", "checkout": "2026-07-20"},
                },
            ],
        )

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))

    segments = [
        {
            "type": "hotel",
            "day": 1,
            "name": "The Leela Palace Bangalore",
            "dates": "Mon 15 Jan 2024 – Wed 17 Jan 2024",
            "location": "Cunningham Road",
            "price": 28,
        }
    ]
    result = await _hydrate_segments(
        "Bangalore", "standard", segments, start_date="2026-07-18"
    )
    hotel = result[0]
    # standard budget picks mid of [28, 209] → not the ₹28 hostel with AI luxury name
    assert hotel["price"] == 209.0
    assert hotel["name"] == "Westlake Hotels Amsterdam"
    assert hotel["name"] != "The Leela Palace Bangalore"
    assert "2026" in hotel["dates"]
    assert "2024" not in hotel["dates"]
    assert hotel["currency"] == "USD"
    assert hotel["provider"] == "travelomatix"


# ── OllamaProvider.is_available(): short-TTL cache ───────────────────────────

async def test_ollama_is_available_caches_within_ttl(monkeypatch):
    call_count = {"n": 0}
    import shared.llm_providers as shared_providers

    monkeypatch.setattr(
        shared_providers.httpx, "AsyncClient", lambda **kw: _FakeTagsClient(call_count, **kw)
    )

    first = await OllamaProvider.is_available()
    second = await OllamaProvider.is_available()
    third = await OllamaProvider.is_available()

    assert (first, second, third) == (True, True, True)
    # Three calls in quick succession within the TTL window should hit the
    # network exactly once, not three times.
    assert call_count["n"] == 1


async def test_ollama_is_available_refreshes_after_ttl_expires(monkeypatch):
    call_count = {"n": 0}
    import shared.llm_providers as shared_providers

    monkeypatch.setattr(
        shared_providers.httpx, "AsyncClient", lambda **kw: _FakeTagsClient(call_count, **kw)
    )
    monkeypatch.setattr(OllamaProvider, "_AVAILABILITY_TTL_SECONDS", 0.01)

    await OllamaProvider.is_available()
    await asyncio.sleep(0.05)
    await OllamaProvider.is_available()

    assert call_count["n"] == 2
