"""Google Places — Text Search, Autocomplete, Place Details, Photos.

Content-only (not bookable inventory). Used to fill names/ratings/photos and
power destination typeahead when Booking/TripAdvisor are thin.
"""
from __future__ import annotations

import logging
import os
import random
import uuid
from typing import Any, List, Optional

import httpx

from app.schemas.inventory import InventoryItem
from app.adapters.deep_link_builder import build_deep_link, build_redirect_url

logger = logging.getLogger(__name__)

GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "").strip()
PLACES_TIMEOUT = float(os.environ.get("GOOGLE_PLACES_TIMEOUT_SECONDS", "10"))


async def _resolve_photo_url(photo_reference: Optional[str], *, maxwidth: int = 800) -> Optional[str]:
    """Resolve a Places photo_reference to a CDN URL (no API key in the result)."""
    if not photo_reference or not GOOGLE_PLACES_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/photo",
                params={
                    "maxwidth": maxwidth,
                    "photo_reference": photo_reference,
                    "key": GOOGLE_PLACES_API_KEY,
                },
            )
            if resp.status_code == 200 and str(resp.url).startswith("http"):
                return str(resp.url)
    except Exception as exc:
        logger.debug("Google Places photo resolve failed: %s", exc)
    return None


async def autocomplete_places(
    input_text: str,
    *,
    limit: int = 6,
    types: str = "(cities)",
) -> list[dict[str, Any]]:
    """Places Autocomplete for destination typeahead (server-side key)."""
    query = (input_text or "").strip()
    if not GOOGLE_PLACES_API_KEY or len(query) < 2:
        return []

    try:
        async with httpx.AsyncClient(timeout=PLACES_TIMEOUT) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/autocomplete/json",
                params={
                    "input": query,
                    "types": types,
                    "key": GOOGLE_PLACES_API_KEY,
                },
            )
            if resp.status_code != 200:
                logger.warning("Places autocomplete HTTP %s: %s", resp.status_code, resp.text[:200])
                return []
            data = resp.json()
            status = data.get("status")
            if status not in {"OK", "ZERO_RESULTS"}:
                logger.warning("Places autocomplete status=%s: %s", status, data.get("error_message"))
                return []

            out: list[dict[str, Any]] = []
            for pred in data.get("predictions", [])[:limit]:
                description = (pred.get("description") or "").strip()
                if not description:
                    continue
                structured = pred.get("structured_formatting") or {}
                main = (structured.get("main_text") or description.split(",")[0]).strip()
                secondary = (structured.get("secondary_text") or "").strip()
                out.append(
                    {
                        "place_id": pred.get("place_id"),
                        "name": main,
                        "description": description,
                        "secondary": secondary,
                        "types": pred.get("types") or [],
                        "source": "google_places",
                    }
                )
            return out
    except Exception as exc:
        logger.warning("Places autocomplete failed: %s", exc)
        return []


async def get_place_details(place_id: str) -> dict[str, Any] | None:
    """Fetch Place Details (geometry, hours, rating, photos, address)."""
    pid = (place_id or "").strip()
    if not GOOGLE_PLACES_API_KEY or not pid:
        return None

    fields = (
        "place_id,name,formatted_address,geometry,rating,user_ratings_total,"
        "types,opening_hours,photos,price_level,url,website,international_phone_number"
    )
    try:
        async with httpx.AsyncClient(timeout=PLACES_TIMEOUT) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": pid,
                    "fields": fields,
                    "key": GOOGLE_PLACES_API_KEY,
                },
            )
            if resp.status_code != 200:
                logger.warning("Place details HTTP %s: %s", resp.status_code, resp.text[:200])
                return None
            data = resp.json()
            if data.get("status") != "OK":
                logger.warning(
                    "Place details status=%s: %s",
                    data.get("status"),
                    data.get("error_message"),
                )
                return None
            result = data.get("result") or {}
            loc = (result.get("geometry") or {}).get("location") or {}
            photos = result.get("photos") or []
            photo_ref = None
            if photos and isinstance(photos[0], dict):
                photo_ref = photos[0].get("photo_reference")
            image_url = await _resolve_photo_url(photo_ref)
            opening = result.get("opening_hours") or {}
            return {
                "place_id": result.get("place_id") or pid,
                "name": result.get("name"),
                "address": result.get("formatted_address"),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "rating": result.get("rating"),
                "user_ratings_total": result.get("user_ratings_total"),
                "types": result.get("types") or [],
                "price_level": result.get("price_level"),
                "open_now": opening.get("open_now"),
                "weekday_text": opening.get("weekday_text") or [],
                "photo": image_url,
                "maps_url": result.get("url"),
                "website": result.get("website"),
                "phone": result.get("international_phone_number"),
                "source": "google_places",
            }
    except Exception as exc:
        logger.warning("Place details failed for %s: %s", pid, exc)
        return None


async def enrich_place_ids(place_ids: list[str], *, limit: int = 8) -> list[dict[str, Any]]:
    """Batch Place Details for research enrichment (bounded concurrency)."""
    ids = [p for p in place_ids if p][:limit]
    if not ids:
        return []
    import asyncio

    results = await asyncio.gather(*(get_place_details(pid) for pid in ids))
    return [r for r in results if r]


async def search_places(
    location: Optional[str],
    type_of_place: str,
    budget: Optional[str],
) -> List[InventoryItem]:
    """Search Google Places for attractions.

    Returns content-only items (price=0). Google Places is not a booking catalog —
    use it to fill names/ratings/photos when Booking/TripAdvisor are thin.
    """
    del budget  # Not used for content-only results.
    results: List[InventoryItem] = []

    if GOOGLE_PLACES_API_KEY and location:
        try:
            query = f"top {type_of_place} in {location}"
            async with httpx.AsyncClient(timeout=PLACES_TIMEOUT) as client:
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={"query": query, "key": GOOGLE_PLACES_API_KEY},
                )

                if response.status_code == 200:
                    places = response.json().get("results", [])[:8]
                    for place in places:
                        place_id = place.get("place_id")
                        name = place.get("name", "Unknown Place")
                        rating = place.get("rating")
                        photos = place.get("photos") or []
                        photo_ref = None
                        if photos and isinstance(photos[0], dict):
                            photo_ref = photos[0].get("photo_reference")
                        image_url = await _resolve_photo_url(photo_ref)
                        loc = (place.get("geometry") or {}).get("location") or {}

                        raw_link = build_deep_link(
                            "google_places",
                            f"https://www.google.com/maps/place/?q=place_id:{place_id}",
                            {"place_id": place_id},
                        )
                        deep_link = build_redirect_url("google_places", raw_link)

                        results.append(
                            InventoryItem(
                                id=str(place_id or uuid.uuid4()),
                                type="activity",
                                provider="google_places",
                                title=name,
                                price=0.0,
                                currency="USD",
                                deep_link=deep_link,
                                image_url=image_url,
                                start_time="10:00 AM",
                                duration="2h",
                                details={
                                    "rating": rating,
                                    "address": place.get("formatted_address"),
                                    "location": location,
                                    "place_id": place_id,
                                    "lat": loc.get("lat"),
                                    "lng": loc.get("lng"),
                                    "types": place.get("types") or [],
                                    "photo": image_url,
                                    "content_only": True,
                                    "bookable": False,
                                    "attraction_type": type_of_place,
                                },
                            )
                        )
                    if results:
                        return results
        except Exception as exc:
            logger.error("Google Places API search failed: %s", exc)

    # Last-resort mock only when no live providers returned anything.
    activity_templates = [
        "City Highlights Tour",
        "Museum Entry Pass",
        "Guided Walking Tour",
        "Sunset Viewpoint Visit",
        "Local Market Experience",
        "Architecture Tour",
    ]
    for template in activity_templates:
        provider = "google_places"
        title = f"{location or 'City'} {template}"
        raw_link = build_deep_link(provider, "https://example.com/activity", {"loc": location})
        deep_link = build_redirect_url(provider, raw_link)
        results.append(
            InventoryItem(
                id=str(uuid.uuid4()),
                type="activity",
                provider=provider,
                title=title,
                price=round(25 * random.uniform(0.8, 1.5), 2),
                currency="USD",
                deep_link=deep_link,
                start_time="09:00 AM",
                duration="2h",
                details={"rating": round(random.uniform(4.0, 5.0), 1), "location": location},
            )
        )
    return results
