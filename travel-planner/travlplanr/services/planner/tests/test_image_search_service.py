from __future__ import annotations

import pytest

from app.services import image_search_service


@pytest.mark.asyncio
async def test_search_images_async_missing_key_uses_curated_fallback(monkeypatch):
    monkeypatch.setattr(image_search_service, "UNSPLASH_ACCESS_KEY", "")

    images = await image_search_service.search_images_async(
        "waterfall forest",
        "Chalakudy",
        limit=2,
    )

    assert len(images) == 2
    assert all(img["url"].startswith("https://images.unsplash.com/") for img in images)
    assert all(img["source"] == "curated" for img in images)


@pytest.mark.asyncio
async def test_search_images_async_provider_failure_uses_fallback_and_cache(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            raise RuntimeError("quota exceeded")

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, *args, **kwargs):
            return FakeResponse()

    class FakeRedis:
        def __init__(self):
            self.values: dict[str, str] = {}
            self.ttls: dict[str, int] = {}

        async def get(self, key: str):
            return self.values.get(key)

        async def setex(self, key: str, ttl: int, value: str):
            self.values[key] = value
            self.ttls[key] = ttl

    redis = FakeRedis()
    monkeypatch.setattr(image_search_service, "UNSPLASH_ACCESS_KEY", "test-key")
    monkeypatch.setattr(image_search_service.httpx, "AsyncClient", FakeClient)

    images = await image_search_service.search_images_async(
        "hotel exterior",
        "Paris",
        limit=1,
        redis=redis,
    )

    assert len(images) == 1
    assert images[0]["source"] == "curated"
    assert redis.values
    assert set(redis.ttls.values()) == {image_search_service.IMAGE_FALLBACK_CACHE_TTL_SECONDS}


@pytest.mark.asyncio
async def test_search_images_async_exact_place_tries_wikipedia_before_unsplash(monkeypatch):
    async def fake_wikipedia(query: str, limit: int):
        return [
            {
                "url": "https://upload.wikimedia.org/example.jpg",
                "alt": "Athirappilly Falls",
                "source": "wikipedia",
            }
        ]

    async def fail_unsplash(*args, **kwargs):
        raise AssertionError("Unsplash should not be called when Wikipedia has an exact image")

    monkeypatch.setattr(image_search_service, "UNSPLASH_ACCESS_KEY", "test-key")
    monkeypatch.setattr(image_search_service, "_search_wikipedia_images", fake_wikipedia)
    monkeypatch.setattr(image_search_service.httpx, "AsyncClient", fail_unsplash)

    images = await image_search_service.search_images_async(
        "Athirappilly Falls",
        "Chalakudy",
        limit=1,
        exact_place=True,
    )

    assert images == [
        {
            "url": "https://upload.wikimedia.org/example.jpg",
            "alt": "Athirappilly Falls",
            "source": "wikipedia",
        }
    ]
