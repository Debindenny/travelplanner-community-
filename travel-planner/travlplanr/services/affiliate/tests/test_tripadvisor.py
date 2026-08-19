"""TripAdvisor adapter unit tests (no network — httpx monkeypatched)."""
from __future__ import annotations

import httpx
import pytest

import app.adapters.providers.tripadvisor as tripadvisor
from app.schemas.inventory import InventoryItem

pytestmark = pytest.mark.asyncio


class _FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code
        self.text = str(json_data)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "error",
                request=httpx.Request("GET", "https://example.com"),
                response=httpx.Response(self.status_code),
            )

    def json(self):
        return self._json


class _FakeAsyncClient:
    def __init__(self, handler, *_a, **_kw):
        self._handler = handler

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

    async def get(self, url, **kwargs):
        return self._handler("get", url, kwargs)


@pytest.fixture(autouse=True)
def _ta_creds(monkeypatch):
    monkeypatch.setattr(tripadvisor, "TRIPADVISOR_API_KEY", "test-ta-key")


async def test_search_attractions_maps_nearby_results(monkeypatch):
    def handler(_method, url, kwargs):
        assert "X-API-Key" in kwargs.get("headers", {})
        assert "/locations/nearby" in url
        return _FakeResponse(
            {
                "data": [
                    {
                        "distance_kilometers": 1.2,
                        "location": {
                            "id": 10433089,
                            "names": [{"language": "en", "primary": True, "value": "Trigger Tours"}],
                            "traveler_ratings": {"overall": {"rating": 4.7, "count": 120}},
                            "addresses": [{"formatted": "Amsterdam, Netherlands"}],
                            "urls": {"tripadvisor": {"main": "https://www.tripadvisor.com/10433089"}},
                        },
                        "photo": {
                            "photo": {
                                "key": "photo-o/26/a9/17/5e/trigger-tours.jpg",
                                "original_height": 2331,
                                "original_width": 3500,
                                "media_type": "photo"
                            }
                        },
                    }
                ],
                "pagination": {"page": 1, "size": 1},
            }
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    results = await tripadvisor.search_attractions("Amsterdam", "standard")
    assert len(results) == 1
    assert results[0].provider == "tripadvisor"
    assert results[0].title == "Trigger Tours"
    assert results[0].price == 0.0
    assert results[0].details["content_only"] is True
    assert results[0].details["bookable"] is False
    assert results[0].details["rating"] == 4.7
    assert results[0].image_url == (
        "https://dynamic-media.tacdn.com/media/photo-o/26/a9/17/5e/trigger-tours.jpg"
    )
    assert "inventory/redirect" in results[0].deep_link


async def test_search_attractions_without_creds_returns_empty(monkeypatch):
    monkeypatch.setattr(tripadvisor, "TRIPADVISOR_API_KEY", "")
    results = await tripadvisor.search_attractions("Amsterdam")
    assert results == []


async def test_recommend_places_falls_back_to_nearby(monkeypatch):
    """When Agentic Search is forbidden, nearby + details + reviews still work."""

    class _Client(_FakeAsyncClient):
        async def post(self, url, **kwargs):
            return self._handler("post", url, kwargs)

    async def fake_nearby(location, budget=None, **_kw):
        return [
            InventoryItem(
                id="10433089",
                type="activity",
                provider="tripadvisor",
                title="Trigger Tours",
                price=0.0,
                currency="USD",
                deep_link="http://localhost/redirect",
                details={
                    "tripadvisor_id": 10433089,
                    "address": "Amsterdam",
                    "rating": 4.8,
                    "attraction_type": "Attraction",
                    "content_only": True,
                },
            )
        ]

    calls: list[str] = []

    def handler(method, url, kwargs):
        calls.append(f"{method}:{url}")
        if method == "post":
            return _FakeResponse({"detail": "Access Denied"}, status_code=403)
        if "/reviews" in url:
            return _FakeResponse(
                {
                    "data": [
                        {
                            "text": [{"language": "en", "primary": True, "value": "Great canal tour."}],
                            "title": [{"language": "en", "primary": True, "value": "Loved it"}],
                        }
                    ],
                    "pagination": {"page": 1, "size": 1},
                }
            )
        if url.rstrip("/").endswith("/10433089") or "/locations/10433089" in url:
            return _FakeResponse(
                {
                    "id": 10433089,
                    "names": [{"language": "en", "primary": True, "value": "Trigger Tours"}],
                    "descriptions": [
                        {"language": "en", "value": "Guided tours through Amsterdam canals."}
                    ],
                    "traveler_ratings": {"overall": {"rating": 4.8, "count": 50}},
                    "addresses": [{"formatted": "Amsterdam, Netherlands"}],
                    "urls": {"tripadvisor": {"main": "https://www.tripadvisor.com/10433089"}},
                }
            )
        return _FakeResponse({}, status_code=404)

    monkeypatch.setattr(tripadvisor, "search_attractions", fake_nearby)
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _Client(handler, *a, **kw))

    results = await tripadvisor.recommend_places("museums", "Amsterdam", limit=3)
    assert len(results) == 1
    assert results[0]["name"] == "Trigger Tours"
    assert results[0]["description"]
    assert results[0]["why"] == ["Great canal tour."]
    assert results[0]["source"] == "tripadvisor"