"""TripAdvisor Terra Partner API — activities / POIs / ratings.

Uses GET /locations/nearby (full payload + optional photo). Falls back to
/catalog/locations/nearby when the allowlist-scoped endpoint returns nothing.

Auth: X-API-Key header (TRIPADVISOR_API_KEY).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

from app.schemas.inventory import InventoryItem
from app.adapters.deep_link_builder import build_redirect_url

# Visit-length codes from TripAdvisor location details.
_VISIT_LENGTH = {
    1: "under 1h",
    2: "1–2h",
    3: "2–3h",
    4: "over 3h",
}

logger = logging.getLogger(__name__)

TRIPADVISOR_API_KEY = os.environ.get("TRIPADVISOR_API_KEY", "").strip()
TRIPADVISOR_API_BASE = os.environ.get(
    "TRIPADVISOR_API_BASE",
    "https://terra.tripadvisor.com/api",
).rstrip("/")

# Common destinations used by Travlplanr demos (lat, lon).
_CITY_COORDS: dict[str, tuple[float, float]] = {
    "amsterdam": (52.3676, 4.9041),
    "paris": (48.8566, 2.3522),
    "london": (51.5074, -0.1278),
    "rome": (41.9028, 12.4964),
    "barcelona": (41.3874, 2.1686),
    "madrid": (40.4168, -3.7038),
    "berlin": (52.5200, 13.4050),
    "brussels": (50.8503, 4.3517),
    "dubai": (25.2048, 55.2708),
    "tokyo": (35.6762, 139.6503),
    "new york": (40.7128, -74.0060),
    "singapore": (1.3521, 103.8198),
    "bangkok": (13.7563, 100.5018),
    "sydney": (-33.8688, 151.2093),
    "bali": (-8.4095, 115.1889),
    "chennai": (13.0827, 80.2707),
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
    "istanbul": (41.0082, 28.9784),
}


def has_tripadvisor_credentials() -> bool:
    return bool(TRIPADVISOR_API_KEY)


def _headers() -> dict[str, str]:
    return {
        "accept": "application/json",
        "X-API-Key": TRIPADVISOR_API_KEY,
    }


def _city_key(location: str) -> str:
    return location.strip().lower().split(",")[0].strip()


async def resolve_coordinates(location: Optional[str]) -> Optional[tuple[float, float]]:
    """Map a free-text city to (lat, lon)."""
    if not location:
        return None
    key = _city_key(location)
    if key in _CITY_COORDS:
        return _CITY_COORDS[key]

    # Nominatim geocode (no key) — best-effort for other cities.
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": location, "format": "json", "limit": 1},
                headers={"User-Agent": "travlplanr-affiliate/1.0"},
                timeout=8.0,
            )
            resp.raise_for_status()
            rows = resp.json()
            if rows:
                return float(rows[0]["lat"]), float(rows[0]["lon"])
    except Exception as exc:
        logger.warning("Geocode failed for %s: %s", location, exc)
    return None


def _primary_name(names: Any) -> str:
    if isinstance(names, str):
        return names
    if not isinstance(names, list):
        return ""
    primary = None
    for row in names:
        if not isinstance(row, dict):
            continue
        if row.get("primary"):
            return str(row.get("value") or "")
        if primary is None and row.get("value"):
            primary = str(row["value"])
    return primary or ""


_TA_MEDIA_CDN = "https://dynamic-media.tacdn.com/media/"


def _tripadvisor_url(loc: dict[str, Any], location_id: Any) -> Optional[str]:
    urls = loc.get("urls") or {}
    ta = urls.get("tripadvisor") if isinstance(urls, dict) else None
    if isinstance(ta, dict) and ta.get("main"):
        return str(ta["main"])
    if isinstance(urls, dict) and urls.get("official"):
        return str(urls["official"])
    if location_id is not None:
        return f"https://www.tripadvisor.com/{location_id}"
    return None


def _cdn_url_from_photo_info(info: dict[str, Any]) -> Optional[str]:
    """Resolve a usable image URL from TripAdvisor photo payloads.

    Nearby search often returns a photo ``key`` without ``original_size_url``;
    the CDN path is still deterministic from that key.
    """
    if not isinstance(info, dict):
        return None
    for field in ("original_size_url", "url", "large_url", "medium_url"):
        val = info.get(field)
        if isinstance(val, str) and val.startswith("http"):
            return val
    key = info.get("key")
    if isinstance(key, str) and key.strip():
        # Keys look like "photo-o/26/a9/17/5e/trigger-tours.jpg"
        return f"{_TA_MEDIA_CDN}{key.lstrip('/')}"
    return None


def _photo_url(row: dict[str, Any], loc: dict[str, Any]) -> Optional[str]:
    photo = row.get("photo") or {}
    if isinstance(photo, dict):
        nested = photo.get("photo") if isinstance(photo.get("photo"), dict) else photo
        url = _cdn_url_from_photo_info(nested)
        if url:
            return url
    photos = loc.get("photos") or {}
    if isinstance(photos, dict):
        # Aggregate count only — need /locations/{id}/photos for URLs.
        return None
    return None


async def _fetch_photo_url(location_id: Any) -> Optional[str]:
    if location_id is None:
        return None
    try:
        payload = await _get_json(f"/locations/{location_id}/photos", {"size": 1})
    except Exception:
        return None
    for row in payload.get("data") or []:
        if not isinstance(row, dict):
            continue
        info = row.get("photo") if isinstance(row.get("photo"), dict) else row
        url = _cdn_url_from_photo_info(info if isinstance(info, dict) else {})
        if url:
            return url
    return None


def _rating(loc: dict[str, Any]) -> Optional[float]:
    ratings = loc.get("traveler_ratings") or {}
    overall = ratings.get("overall") if isinstance(ratings, dict) else None
    if isinstance(overall, dict) and overall.get("rating") is not None:
        try:
            return float(overall["rating"])
        except (TypeError, ValueError):
            return None
    # Catalog responses sometimes expose overall_rating directly.
    if loc.get("overall_rating") is not None:
        try:
            return float(loc["overall_rating"])
        except (TypeError, ValueError):
            return None
    return None


def _review_count(loc: dict[str, Any]) -> Optional[int]:
    ratings = loc.get("traveler_ratings") or {}
    overall = ratings.get("overall") if isinstance(ratings, dict) else None
    if isinstance(overall, dict) and overall.get("count") is not None:
        try:
            return int(overall["count"])
        except (TypeError, ValueError):
            return None
    return None


def _address(loc: dict[str, Any]) -> Optional[str]:
    addresses = loc.get("addresses") or []
    if not addresses:
        return None
    first = addresses[0] if isinstance(addresses, list) else None
    if isinstance(first, dict):
        return first.get("formatted") or first.get("city")
    return None


def _category_label(loc: dict[str, Any]) -> str:
    categories = loc.get("categories") or []
    if isinstance(categories, list) and categories:
        first = categories[0]
        if isinstance(first, dict):
            return str(first.get("display_name") or first.get("id") or "Attraction")
    top = loc.get("top_level_category")
    if top:
        return str(top)
    return "Attraction"


def _ranking_text(loc: dict[str, Any]) -> Optional[str]:
    rankings = loc.get("rankings") or []
    if not isinstance(rankings, list) or not rankings:
        return None
    first = rankings[0]
    if not isinstance(first, dict):
        return None
    if first.get("display_text"):
        return str(first["display_text"])
    rank = first.get("rank")
    total = first.get("total")
    geo = first.get("geo") or ""
    category = first.get("category") or "attractions"
    if rank is not None and total is not None:
        return f"#{rank} of {total} {category} in {geo}".strip()
    return None


def _description(loc: dict[str, Any]) -> Optional[str]:
    descriptions = loc.get("descriptions") or []
    if not isinstance(descriptions, list):
        return None
    for row in descriptions:
        if isinstance(row, dict) and row.get("value"):
            return str(row["value"])[:500]
    return None


def _visit_duration(loc: dict[str, Any]) -> Optional[str]:
    code = loc.get("recommended_visit_length")
    try:
        return _VISIT_LENGTH.get(int(code)) if code is not None else None
    except (TypeError, ValueError):
        return None


def _map_row(
    row: dict[str, Any],
    *,
    location: Optional[str],
    budget: Optional[str] = None,
) -> Optional[InventoryItem]:
    del budget  # Content API has no bookable prices.
    loc = row.get("location") if isinstance(row.get("location"), dict) else row
    if not isinstance(loc, dict):
        return None
    location_id = loc.get("id")
    title = _primary_name(loc.get("names")) or f"Attraction {location_id}"
    url = _tripadvisor_url(loc, location_id)
    if not url:
        return None

    rating = _rating(loc)
    photo = _photo_url(row, loc)
    distance = row.get("distance_kilometers") or row.get("distance_miles")
    distance_label = None
    if distance is not None:
        try:
            distance_label = f"{float(distance):.1f} km from center"
        except (TypeError, ValueError):
            distance_label = None

    details: dict[str, Any] = {
        "location": location,
        "address": _address(loc) or location,
        "rating": rating,
        "number_of_reviews": _review_count(loc),
        "photo": photo,
        "attraction_type": _category_label(loc),
        "tripadvisor_id": location_id,
        "geo": loc.get("geo"),
        "distance": distance_label,
        "ranking": _ranking_text(loc),
        "description": _description(loc),
        "content_only": True,
        "bookable": False,
        "free_cancellation": False,
    }

    return InventoryItem(
        id=str(location_id or title),
        type="activity",
        provider="tripadvisor",
        title=title,
        # TripAdvisor Content is discovery/trust data — not a booking catalog.
        price=0.0,
        currency="USD",
        deep_link=build_redirect_url("tripadvisor", url),
        image_url=photo,
        duration=_visit_duration(loc) or "2h",
        details=details,
    )


def _map_recommendation_result(result: dict[str, Any], *, location: str) -> Optional[dict[str, Any]]:
    """Map an Agentic Search result into a research-friendly dict."""
    result_type = result.get("type") or "location"
    loc = result.get("location") if result_type == "location" else result.get("experience")
    if not isinstance(loc, dict):
        return None

    location_id = loc.get("id")
    name = _primary_name(loc.get("names")) or f"Place {location_id}"
    url = _tripadvisor_url(loc, location_id)
    rating = _rating(loc)
    if rating is None:
        overall = loc.get("overall_traveller_ratings") or {}
        if isinstance(overall, dict) and overall.get("bubble_rating") is not None:
            try:
                rating = float(overall["bubble_rating"])
            except (TypeError, ValueError):
                rating = None

    review_count = _review_count(loc)
    if review_count is None:
        overall = loc.get("overall_traveller_ratings") or {}
        if isinstance(overall, dict) and overall.get("total_review_count") is not None:
            try:
                review_count = int(overall["total_review_count"])
            except (TypeError, ValueError):
                review_count = None

    why: list[str] = []
    for src in result.get("review_sources") or []:
        if isinstance(src, dict) and src.get("snippet"):
            why.append(str(src["snippet"]).strip()[:280])

    categories = loc.get("categories") or []
    types: list[str] = []
    if isinstance(categories, list):
        for cat in categories[:3]:
            if isinstance(cat, dict) and cat.get("display_name"):
                types.append(str(cat["display_name"]))
    if not types and result_type == "experience":
        types = list(loc.get("tags") or [])[:3] or ["Experience"]
    if not types:
        types = [_category_label(loc)]

    return {
        "name": name,
        "address": _address(loc) or location,
        "rating": rating,
        "number_of_reviews": review_count,
        "types": types,
        "tripadvisor_id": location_id,
        "ranking": _ranking_text(loc),
        "description": _description(loc),
        "why": why[:3],
        "tripadvisor_url": url,
        "deep_link": build_redirect_url("tripadvisor", url) if url else None,
        "result_type": result_type,
        "source": "tripadvisor",
    }


async def _get_json(path: str, params: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{TRIPADVISOR_API_BASE}{path}",
            params=params,
            headers=_headers(),
            timeout=12.0,
        )
        if resp.status_code >= 400:
            logger.error(
                "TripAdvisor %s HTTP %s: %s",
                path,
                resp.status_code,
                resp.text[:400],
            )
        resp.raise_for_status()
        return resp.json()


async def _post_json(path: str, body: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{TRIPADVISOR_API_BASE}{path}",
            json=body,
            headers={**_headers(), "Content-Type": "application/json"},
            timeout=20.0,
        )
        if resp.status_code >= 400:
            logger.error(
                "TripAdvisor %s HTTP %s: %s",
                path,
                resp.status_code,
                resp.text[:400],
            )
        resp.raise_for_status()
        return resp.json()


async def recommend_places(
    query: str,
    location: str,
    *,
    categories: Optional[list[str]] = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Ranked TripAdvisor places for itinerary grounding.

    Prefers Agentic Search (`POST /recommendations/search`) when the API key
    is entitled; otherwise falls back to nearby attractions enriched with
    location details + a short review snippet.
    """
    if not has_tripadvisor_credentials() or not location:
        return []

    q = (query or f"top attractions and things to do in {location}").strip()
    agentic = await _recommend_via_agentic(q, location, categories=categories, limit=limit)
    if agentic:
        return agentic
    return await _recommend_via_nearby(location, limit=limit)


async def _recommend_via_agentic(
    query: str,
    location: str,
    *,
    categories: Optional[list[str]] = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    body: dict[str, Any] = {
        "query": query,
        "geo": {"name": location.strip()},
        "limit": min(20, max(1, limit)),
        "response_preference": "quality",
    }
    if categories:
        body["top_level_categories"] = categories

    try:
        payload = await _post_json("/recommendations/search", body)
    except Exception as exc:
        logger.info(
            "TripAdvisor Agentic Search unavailable (%s) — using nearby fallback",
            exc,
        )
        return []

    results: list[dict[str, Any]] = []
    for row in payload.get("search_results") or []:
        if not isinstance(row, dict):
            continue
        mapped = _map_recommendation_result(row, location=location)
        if mapped:
            results.append(mapped)
    return results


async def _fetch_review_snippets(location_id: Any, *, size: int = 2) -> list[str]:
    if location_id is None:
        return []
    for params in (
        {"size": size, "language": "en"},
        {"size": size, "sort_by": "MOST_RECENT", "language": "en"},
        {"size": size},
    ):
        try:
            payload = await _get_json(f"/locations/{location_id}/reviews", params)
        except Exception:
            continue
        snippets: list[str] = []
        for review in payload.get("data") or []:
            if not isinstance(review, dict):
                continue
            text_rows = review.get("text") or []
            title_rows = review.get("title") or []
            body = ""
            if isinstance(text_rows, list):
                for row in text_rows:
                    if isinstance(row, dict) and row.get("value"):
                        body = str(row["value"]).strip()
                        break
            title = ""
            if isinstance(title_rows, list):
                for row in title_rows:
                    if isinstance(row, dict) and row.get("value"):
                        title = str(row["value"]).strip()
                        break
            snippet = body or title
            if snippet:
                snippets.append(snippet[:280])
        if snippets:
            return snippets
    return []


async def _enrich_location(location_id: Any) -> dict[str, Any]:
    if location_id is None:
        return {}
    try:
        return await _get_json(f"/locations/{location_id}", {})
    except Exception as exc:
        logger.debug("TripAdvisor location %s details failed: %s", location_id, exc)
        return {}


async def _recommend_via_nearby(location: str, *, limit: int = 8) -> list[dict[str, Any]]:
    """Nearby attractions + details/reviews — works on standard Content API keys."""
    items = await search_attractions(location, size=min(20, max(limit, 8)))
    if not items:
        return []

    results: list[dict[str, Any]] = []
    for item in items[:limit]:
        details = dict(item.details or {})
        location_id = details.get("tripadvisor_id") or item.id
        enriched = await _enrich_location(location_id)
        if enriched:
            details["description"] = _description(enriched) or details.get("description")
            details["ranking"] = _ranking_text(enriched) or details.get("ranking")
            details["attraction_type"] = _category_label(enriched) or details.get(
                "attraction_type"
            )
            if _rating(enriched) is not None:
                details["rating"] = _rating(enriched)
            if _review_count(enriched) is not None:
                details["number_of_reviews"] = _review_count(enriched)
            if _visit_duration(enriched):
                details["duration"] = _visit_duration(enriched)
            addr = _address(enriched)
            if addr:
                details["address"] = addr

        why = await _fetch_review_snippets(location_id, size=2)
        results.append(
            {
                "name": item.title,
                "address": details.get("address") or location,
                "rating": details.get("rating"),
                "number_of_reviews": details.get("number_of_reviews"),
                "types": [details.get("attraction_type") or "Attraction"],
                "tripadvisor_id": location_id,
                "ranking": details.get("ranking"),
                "description": details.get("description"),
                "why": why,
                "tripadvisor_url": None,
                "deep_link": item.deep_link,
                "result_type": "location",
                "source": "tripadvisor",
            }
        )
    return results


async def _search_rows_by_query(
    location: str,
    *,
    lat: float,
    lon: float,
    size: int,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "searchQuery": location,
        "category": "ATTRACTION",
        "lat": lat,
        "lon": lon,
        "size": min(20, max(1, size)),
    }
    for path in ("/locations/search", "/catalog/locations/search"):
        try:
            payload = await _get_json(path, params)
        except Exception as exc:
            logger.info("TripAdvisor %s fallback failed: %s", path, exc)
            continue
        rows = payload.get("data") or payload.get("results") or []
        if isinstance(rows, list) and rows:
            return [row for row in rows if isinstance(row, dict)]
    return []


async def search_attractions(
    location: Optional[str],
    budget: Optional[str] = None,
    *,
    radius_km: float = 8.0,
    size: int = 10,
) -> list[InventoryItem]:
    """Search nearby attractions for a city/location name."""
    if not has_tripadvisor_credentials() or not location:
        return []

    coords = await resolve_coordinates(location)
    if coords is None:
        logger.info("No coordinates for location=%s — skipping TripAdvisor search", location)
        return []

    lat, lon = coords
    params: dict[str, Any] = {
        "lat": lat,
        "lon": lon,
        "radius": radius_km,
        "unit": "KM",
        "category": "ATTRACTION",
        "include_photo": "true",
        "size": min(20, max(1, size)),
        "sort": "rating,desc",
    }

    rows: list[dict[str, Any]] = []
    try:
        payload = await _get_json("/locations/nearby", params)
        rows = list(payload.get("data") or [])
    except Exception as exc:
        logger.warning("TripAdvisor /locations/nearby failed: %s", exc)

    if not rows:
        # Catalog nearby ignores allowlist — useful when production list is empty.
        try:
            catalog_params = {
                "lat": lat,
                "lon": lon,
                "radius": radius_km,
                "unit": "KM",
                "category": "ATTRACTION",
                "size": min(20, max(1, size)),
            }
            payload = await _get_json("/catalog/locations/nearby", catalog_params)
            rows = list(payload.get("data") or [])
        except Exception as exc:
            logger.error("TripAdvisor catalog nearby failed: %s", exc)
            return []

    if len(rows) < min(size, 4):
        try:
            extra_rows = await _search_rows_by_query(location, lat=lat, lon=lon, size=size)
        except Exception as exc:
            logger.info("TripAdvisor search fallback failed: %s", exc)
            extra_rows = []
        if extra_rows:
            merged: list[dict[str, Any]] = []
            seen_ids: set[str] = set()
            for row in [*rows, *extra_rows]:
                loc = row.get("location") if isinstance(row.get("location"), dict) else row
                if not isinstance(loc, dict):
                    continue
                loc_id = str(loc.get("id") or "")
                if loc_id and loc_id in seen_ids:
                    continue
                if loc_id:
                    seen_ids.add(loc_id)
                merged.append(row)
            rows = merged

    results: list[InventoryItem] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        item = _map_row(row, location=location, budget=budget)
        if not item:
            continue
        if not item.image_url:
            photo = await _fetch_photo_url(item.details.get("tripadvisor_id") if item.details else item.id)
            if photo:
                item.image_url = photo
                if item.details is not None:
                    item.details["photo"] = photo
        results.append(item)
    return results
