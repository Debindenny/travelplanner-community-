"""Tests for server-resolved flight-route enforcement and per-day inventory
backfill in the generation pipeline. Pure logic with a faked HTTP layer —
async tests rely on the root pyproject's asyncio_mode = "auto"."""

from __future__ import annotations

import app.main as main_module
from app.main import (
    _backfill_missing_days,
    _build_prompt,
    _city_for_day,
    _enforce_flight_route,
)


class _FakeResponse:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, handler, **_kwargs):
        self._handler = handler

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None):
        return await self._handler(url, params)


# ── _enforce_flight_route ────────────────────────────────────────────────────

def test_enforce_flight_route_pins_outbound_and_return():
    segments = [
        {"type": "flight", "day": 1, "depCode": "MAA", "arrCode": "CDG"},
        {"type": "activity", "day": 2, "title": "Backwaters"},
        {"type": "flight", "day": 4, "depCode": "CDG", "arrCode": "MAA"},
    ]
    result = _enforce_flight_route(segments, "BLR", "COK")
    assert result[0]["depCode"] == "BLR" and result[0]["arrCode"] == "COK"
    assert result[2]["depCode"] == "COK" and result[2]["arrCode"] == "BLR"
    assert result[1]["title"] == "Backwaters"


def test_enforce_flight_route_single_flight_only_touches_outbound():
    segments = [{"type": "flight", "day": 1, "depCode": "XXX", "arrCode": "YYY"}]
    result = _enforce_flight_route(segments, "BLR", "COK")
    assert result[0]["depCode"] == "BLR" and result[0]["arrCode"] == "COK"


def test_enforce_flight_route_leaves_mid_trip_flights_alone():
    segments = [
        {"type": "flight", "day": 1, "depCode": "AAA", "arrCode": "BBB"},
        {"type": "flight", "day": 3, "depCode": "MID", "arrCode": "MID2"},
        {"type": "flight", "day": 6, "depCode": "CCC", "arrCode": "DDD"},
    ]
    result = _enforce_flight_route(segments, "BLR", "COK")
    assert result[1]["depCode"] == "MID" and result[1]["arrCode"] == "MID2"


def test_enforce_flight_route_noop_without_codes():
    segments = [{"type": "flight", "day": 1, "depCode": "MAA", "arrCode": "CDG"}]
    assert _enforce_flight_route(segments, None, None)[0]["depCode"] == "MAA"


async def test_resolve_route_airports_from_city_names():
    """Chat regenerate sends cities, not IATA — must still pin BLR→MLE."""
    from app.main import _resolve_route_airports

    dep, arr = await _resolve_route_airports({
        "departure_location": "Bangalore",
        "arrival_location": "Maldives",
        "destination": "Maldives",
    })
    assert dep == "BLR"
    assert arr == "MLE"


async def test_resolve_route_airports_prefers_explicit_codes():
    from app.main import _resolve_route_airports

    dep, arr = await _resolve_route_airports({
        "departure_location": "Bangalore",
        "departure_airport": "DEL",
        "arrival_airport": "MLE",
        "destination": "Maldives",
    })
    assert dep == "DEL"
    assert arr == "MLE"


# ── _city_for_day ────────────────────────────────────────────────────────────

def test_city_for_day_walks_city_blocks():
    city_days = [{"city": "Kochi", "nights": 2}, {"city": "Munnar", "nights": 2}]
    assert _city_for_day(1, city_days, "Kerala") == "Kochi"
    assert _city_for_day(2, city_days, "Kerala") == "Kochi"
    assert _city_for_day(3, city_days, "Kerala") == "Munnar"
    assert _city_for_day(5, city_days, "Kerala") == "Kerala"  # beyond blocks


def test_city_for_day_defaults_to_destination():
    assert _city_for_day(2, None, "Chalakudy") == "Chalakudy"


# ── _backfill_missing_days ───────────────────────────────────────────────────

def _inventory_items(city: str):
    extra = [
        {"provider": "travelnext_activities", "title": f"{city} Experience #{i}", "price": 900 + i, "details": {}}
        for i in range(8)
    ]
    return [
        {
            "provider": "travelnext_activities",
            "title": f"{city} Waterfall Tour",
            "price": 1500,
            "image_url": "https://img.example/wf.jpg",
            "deep_link": "https://book.example/wf",
            "details": {"rating": 4.6, "duration": "3 hours"},
        },
        {
            "provider": "tripadvisor",
            "title": f"{city} Heritage Walk",
            "price": None,
            "details": {"content_only": True, "rating": 4.4},
        },
        {
            "provider": "google_places",
            "title": f"{city} Spice Market",
            "details": {},
        },
    ] + extra


async def test_backfill_fills_every_thin_day(monkeypatch):
    calls = []

    async def handler(url, params):
        calls.append(params)
        return _FakeResponse(200, _inventory_items(params["location"]))

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))
    monkeypatch.setattr(main_module, "MIN_ACTIVITIES_PER_DAY", 2)

    # LLM output: everything piled onto Day 1, days 2-4 empty.
    segments = [
        {"type": "flight", "day": 1},
        {"type": "hotel", "day": 1},
        {"type": "activity", "day": 1, "title": "Athirappilly Falls"},
        {"type": "activity", "day": 1, "title": "Backwater Cruise"},
    ]
    result = await _backfill_missing_days("Chalakudy", "standard", 4, None, segments)

    per_day = {}
    for seg in result:
        if seg.get("type") == "activity":
            per_day[seg["day"]] = per_day.get(seg["day"], 0) + 1
    assert per_day == {1: 2, 2: 2, 3: 2, 4: 2}
    # One inventory search per city, not per day.
    assert len(calls) == 1 and calls[0]["type"] == "activity" and calls[0]["location"] == "Chalakudy"


async def test_backfill_marks_bookable_vs_content_only(monkeypatch):
    async def handler(url, params):
        return _FakeResponse(200, _inventory_items(params["location"]))

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))
    monkeypatch.setattr(main_module, "MIN_ACTIVITIES_PER_DAY", 2)

    result = await _backfill_missing_days("Chalakudy", "standard", 1, None, [{"type": "hotel", "day": 1}])
    added = [s for s in result if s.get("type") == "activity"]
    assert len(added) == 2
    bookable = next(s for s in added if s["provider"] == "travelnext_activities")
    content = next(s for s in added if s["provider"] == "tripadvisor")
    assert bookable["source"] == "inventory" and bookable["bookable"] is True
    assert bookable["price"] == 1500 and bookable["deep_link"] == "https://book.example/wf"
    assert content["source"] == "tripadvisor" and content["bookable"] is False
    assert "price" not in content  # content APIs carry no bookable price


async def test_backfill_skips_titles_already_in_plan(monkeypatch):
    async def handler(url, params):
        return _FakeResponse(200, _inventory_items(params["location"]))

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))
    monkeypatch.setattr(main_module, "MIN_ACTIVITIES_PER_DAY", 2)

    segments = [
        {"type": "activity", "day": 1, "title": "Chalakudy Waterfall Tour"},
    ]
    result = await _backfill_missing_days("Chalakudy", "standard", 1, None, segments)
    titles = [s["title"].lower() for s in result if s.get("type") == "activity"]
    assert len(titles) == len(set(titles))


async def test_backfill_uses_per_day_city(monkeypatch):
    async def handler(url, params):
        return _FakeResponse(200, _inventory_items(params["location"]))

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))
    monkeypatch.setattr(main_module, "MIN_ACTIVITIES_PER_DAY", 1)

    city_days = [{"city": "Kochi", "nights": 1}, {"city": "Munnar", "nights": 1}]
    result = await _backfill_missing_days("Kerala", "standard", 2, city_days, [])
    added = [s for s in result if s.get("type") == "activity"]
    assert {s["location"] for s in added} == {"Kochi", "Munnar"}


async def test_backfill_survives_inventory_outage(monkeypatch):
    async def handler(url, params):
        raise RuntimeError("affiliate down")

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(handler, **kw))

    segments = [{"type": "activity", "day": 1, "title": "Solo Activity"}]
    result = await _backfill_missing_days("Chalakudy", "standard", 3, None, segments)
    assert result == segments  # unchanged, no exception


# ── prompt: authoritative airport codes ─────────────────────────────────────

def test_prompt_includes_resolved_airport_codes():
    payload = {
        "travelers": 2,
        "budget": "standard",
        "duration_days": 3,
        "departure_location": "Bangalore",
        "arrival_location": "Chalakudy",
        "departure_airport": "BLR",
        "arrival_airport": "COK",
    }
    prompt = _build_prompt(payload, "Chalakudy", "cust-1")
    assert 'depCode is "BLR"' in prompt
    assert 'arrCode is "COK"' in prompt
    assert "return flight reverses these codes" in prompt
