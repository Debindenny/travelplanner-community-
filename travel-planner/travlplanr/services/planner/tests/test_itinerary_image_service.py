from __future__ import annotations

import pytest

from app.services import itinerary_image_service


class DummyTrip:
    destination = "Chalakudy"
    image = "assets/images/landing/journey-thailand.jpg"
    interests = ["nature", "waterfalls"]
    customizations = {}


@pytest.mark.asyncio
async def test_enrich_itinerary_images_sets_cover_and_segment_images(monkeypatch):
    async def fake_search(query, destination=None, limit=4, *, redis=None, exact_place=False):
        base = query.lower().replace(" ", "-")[:30]
        return [
            {
                "url": f"https://images.unsplash.com/{base}-{idx}.jpg",
                "alt": f"{query} {idx}",
                "source": "unsplash",
                "photographer": "Tester",
                "photographer_url": "https://example.com/tester",
            }
            for idx in range(limit)
        ]

    monkeypatch.setattr(itinerary_image_service, "search_images_async", fake_search)
    trip = DummyTrip()
    segments = [
        {
            "type": "activity",
            "title": "Athirappilly Waterfalls Visit",
            "location": "Chalakudy",
            "image": "assets/images/landing/journey-thailand.jpg",
        },
        {
            "type": "hotel",
            "name": "Hotel Chalakudy Central",
            "location": "Chalakudy",
            "imageUrl": "assets/images/packages/hero-main.png",
        },
        {
            "type": "bus",
            "carrier": "Airport Express Shuttle",
            "imageUrl": "assets/images/landing/journey-thailand.jpg",
        },
    ]

    enriched = await itinerary_image_service.enrich_itinerary_images(None, trip, segments)

    urls = [trip.image, enriched[0]["image"], enriched[1]["imageUrl"]]
    assert all(url.startswith("https://images.unsplash.com/") for url in urls)
    assert len(set(urls)) == len(urls)
    assert enriched[0]["imageSource"] == "unsplash"
    assert enriched[1]["imageCredit"] == "Tester"
    assert "imageUrl" not in enriched[2]


@pytest.mark.asyncio
async def test_enrich_itinerary_images_keeps_existing_external_images(monkeypatch):
    async def fail_search(*args, **kwargs):
        raise AssertionError("provider should not be called for existing external images")

    monkeypatch.setattr(itinerary_image_service, "search_images_async", fail_search)
    trip = DummyTrip()
    trip.image = "https://cdn.example.com/cover.jpg"
    segment = {
        "type": "activity",
        "title": "Existing image activity",
        "image": "https://cdn.example.com/activity.jpg",
    }

    enriched = await itinerary_image_service.enrich_itinerary_images(None, trip, [segment])

    assert trip.image == "https://cdn.example.com/cover.jpg"
    assert enriched[0]["image"] == "https://cdn.example.com/activity.jpg"


@pytest.mark.asyncio
async def test_enrich_skips_same_unsplash_photo_with_different_query(monkeypatch):
    async def fake_search(query, destination=None, limit=4, *, redis=None, exact_place=False):
        # Same photo id, different query strings — must not reuse across activities.
        if "Hidden" in query or "hidden" in query.lower():
            return [
                {
                    "url": "https://images.unsplash.com/photo-aaa?ixid=1",
                    "source": "unsplash",
                },
                {
                    "url": "https://images.unsplash.com/photo-bbb?ixid=2",
                    "source": "unsplash",
                },
            ]
        return [
            {
                "url": "https://images.unsplash.com/photo-aaa?ixid=cover",
                "source": "unsplash",
            }
        ]

    monkeypatch.setattr(itinerary_image_service, "search_images_async", fake_search)
    trip = DummyTrip()
    trip.image = "https://images.unsplash.com/photo-aaa?ixid=trip-cover"
    segments = [
        {
            "type": "activity",
            "title": "Hidden Gems Tour",
            "location": "Mumbai",
            "image": "assets/images/landing/journey-thailand.jpg",
        },
    ]

    enriched = await itinerary_image_service.enrich_itinerary_images(None, trip, segments)

    assert enriched[0]["image"].startswith("https://images.unsplash.com/photo-bbb")


@pytest.mark.asyncio
async def test_enrich_replaces_duplicate_cover_on_activities(monkeypatch):
    """Package/wizard builders used to stamp the trip cover on every activity."""
    async def fake_search(query, destination=None, limit=4, *, redis=None, exact_place=False):
        base = query.lower().replace(" ", "-")[:30]
        return [
            {
                "url": f"https://images.unsplash.com/{base}-{idx}.jpg",
                "alt": query,
                "source": "unsplash",
            }
            for idx in range(limit)
        ]

    monkeypatch.setattr(itinerary_image_service, "search_images_async", fake_search)
    trip = DummyTrip()
    cover = "https://cdn.example.com/cover.jpg"
    trip.image = cover
    segments = [
        {"type": "activity", "title": "Gateway of India", "location": "Mumbai", "image": cover},
        {"type": "activity", "title": "Marine Drive Walk", "location": "Mumbai", "image": cover},
    ]

    enriched = await itinerary_image_service.enrich_itinerary_images(None, trip, segments)

    assert trip.image == cover
    assert enriched[0]["image"] != cover
    assert enriched[1]["image"] != cover
    assert enriched[0]["image"] != enriched[1]["image"]
    assert all(u.startswith("https://images.unsplash.com/") for u in (enriched[0]["image"], enriched[1]["image"]))


@pytest.mark.asyncio
async def test_enrich_itinerary_images_retries_beyond_curated_fallback(monkeypatch):
    calls: list[str] = []

    async def fake_search(query, destination=None, limit=4, *, redis=None, exact_place=False):
        calls.append(query)
        if len(calls) == 1:
            return [{"url": "https://images.unsplash.com/curated.jpg", "source": "curated"}]
        return [{"url": "https://images.unsplash.com/provider.jpg", "source": "unsplash"}]

    monkeypatch.setattr(itinerary_image_service, "search_images_async", fake_search)
    trip = DummyTrip()
    trip.image = "assets/images/landing/journey-thailand.jpg"

    await itinerary_image_service.enrich_itinerary_images(None, trip, [])

    assert trip.image == "https://images.unsplash.com/provider.jpg"
    assert len(calls) == 2
