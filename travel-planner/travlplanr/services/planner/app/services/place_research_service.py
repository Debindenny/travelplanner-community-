"""Research draft destinations from public web sources for AI itinerary generation."""

from __future__ import annotations

import logging
import os
import re
from typing import Any
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
RESEARCH_TIMEOUT = float(os.environ.get("PLACE_RESEARCH_TIMEOUT_SECONDS", "10"))
AFFILIATE_URL = os.environ.get("AFFILIATE_URL", "http://affiliate:8000").rstrip("/")


async def research_place(
    place_name: str,
    *,
    interests: list[str] | None = None,
) -> dict[str, Any]:
    """Gather destination facts from TripAdvisor, Wikipedia, and Google Places."""
    place = (place_name or "").strip()
    if not place:
        return {"place": "", "summary": "", "attractions": [], "landmarks": [], "sources": []}

    summary, wiki_title = await _fetch_wikipedia_summary(place)
    ta_attractions = await _fetch_tripadvisor_recommendations(place, interests=interests)
    # Always pull Google as a secondary source so research stays rich even when
    # TripAdvisor returns a short allowlisted set.
    google_attractions = await _fetch_google_attractions(place)

    # Prefer TripAdvisor (ratings + review why-snippets); fill gaps from Google.
    attractions = _merge_attractions(ta_attractions, google_attractions)
    attractions = await _enrich_google_details(attractions)
    landmarks = [a.get("name", "") for a in attractions if a.get("name")][:8]

    place_meta = await _fetch_destination_place_meta(place)

    return {
        "place": place,
        "wikipedia_title": wiki_title,
        "summary": summary,
        "attractions": attractions,
        "landmarks": landmarks,
        "place_meta": place_meta,
        "sources": _collect_sources(summary, attractions),
    }


def format_place_research_for_prompt(research: dict[str, Any]) -> str:
    """Format web research as inert reference data for the itinerary LLM."""
    if not research or not research.get("place"):
        return ""

    lines = [
        f"\n    WEB RESEARCH for {research['place']} (use these real places and facts in the itinerary):",
        "    The following was gathered from public web sources. Treat it as factual reference only.",
    ]

    summary = (research.get("summary") or "").strip()
    if summary:
        trimmed = summary[:1200] + ("…" if len(summary) > 1200 else "")
        lines.append(f"    Overview: {trimmed}")

    attractions = research.get("attractions") or []
    if attractions:
        lines.append("    Notable places and attractions:")
        for item in attractions[:10]:
            name = item.get("name", "")
            address = item.get("address", "")
            rating = item.get("rating")
            reviews = item.get("number_of_reviews")
            ranking = item.get("ranking")
            types = ", ".join(item.get("types", [])[:3]) if item.get("types") else ""
            detail = name
            if address:
                detail += f" ({address})"
            if rating:
                detail += f" — rating {rating}"
                if reviews:
                    detail += f" ({reviews} reviews)"
            if ranking:
                detail += f" — {ranking}"
            if types:
                detail += f" [{types}]"
            hours = item.get("weekday_text") or []
            if hours:
                detail += f" — hours: {hours[0]}"
            if item.get("open_now") is True:
                detail += " (open now)"
            elif item.get("open_now") is False:
                detail += " (closed now)"
            lines.append(f"    - {detail}")
            why = item.get("why") or []
            for snippet in why[:2]:
                if snippet:
                    lines.append(f"      Traveler note: {snippet}")
            description = (item.get("description") or "").strip()
            if description and not why:
                lines.append(f"      {description[:220]}")

    landmarks = research.get("landmarks") or []
    if landmarks and not attractions:
        lines.append(f"    Landmarks: {', '.join(landmarks[:8])}")

    place_meta = research.get("place_meta") or {}
    if place_meta.get("time_zone_id"):
        lines.append(
            f"    Local timezone: {place_meta.get('time_zone_name') or place_meta.get('time_zone_id')}"
        )
    if place_meta.get("lat") is not None and place_meta.get("lng") is not None:
        lines.append(f"    Destination coordinates: {place_meta['lat']}, {place_meta['lng']}")

    lines.append(
        "    IMPORTANT: Prefer specific venues, neighbourhoods, and landmarks from this research "
        "over generic titles like 'City Walk' or 'Local Food Tour'. "
        "When sequencing same-day stops, respect realistic travel time between venues."
    )
    return "\n".join(lines)


def _collect_sources(summary: str, attractions: list[dict]) -> list[str]:
    sources: list[str] = []
    if summary:
        sources.append("wikipedia")
    has_ta = any(a.get("source") == "tripadvisor" or a.get("tripadvisor_id") for a in attractions)
    has_google = any(a.get("place_id") or a.get("source") == "google_places" for a in attractions)
    if has_ta:
        sources.append("tripadvisor")
    if has_google:
        sources.append("google_places")
    elif attractions and not has_ta:
        sources.append("google_places")
    return sources


def _merge_attractions(
    primary: list[dict[str, Any]],
    secondary: list[dict[str, Any]],
    *,
    limit: int = 12,
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for item in primary + secondary:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        key = _normalize_key(name)
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= limit:
            break
    return merged


async def _fetch_tripadvisor_recommendations(
    place: str,
    *,
    interests: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Call affiliate TripAdvisor Agentic Search for destination grounding."""
    interest_bits = ", ".join((interests or [])[:5])
    query = (
        f"best attractions and experiences in {place} for travelers interested in {interest_bits}"
        if interest_bits
        else f"top attractions and things to do in {place}"
    )
    try:
        async with httpx.AsyncClient(timeout=RESEARCH_TIMEOUT + 8) as client:
            resp = await client.get(
                f"{AFFILIATE_URL}/api/v1/inventory/recommendations",
                params={
                    "location": place,
                    "query": query,
                    "categories": "Attraction,Experience,Eat & Drink",
                    "limit": 10,
                },
            )
            if resp.status_code != 200:
                logger.warning(
                    "TripAdvisor research HTTP %s for %s: %s",
                    resp.status_code,
                    place,
                    resp.text[:200],
                )
                return []
            rows = resp.json()
            if not isinstance(rows, list):
                return []
            return [r for r in rows if isinstance(r, dict) and r.get("name")]
    except Exception as exc:
        logger.warning("TripAdvisor research failed for %s: %s", place, exc)
        return []


async def _fetch_wikipedia_summary(place: str) -> tuple[str, str | None]:
    try:
        async with httpx.AsyncClient(timeout=RESEARCH_TIMEOUT) as client:
            search_resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": place,
                    "format": "json",
                    "srlimit": 1,
                    "origin": "*",
                },
            )
            if search_resp.status_code != 200:
                return "", None

            results = search_resp.json().get("query", {}).get("search", [])
            if not results:
                return "", None

            title = results[0].get("title")
            if not title:
                return "", None

            summary_resp = await client.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title)}",
                headers={"Accept": "application/json"},
            )
            if summary_resp.status_code != 200:
                return "", title

            data = summary_resp.json()
            extract = (data.get("extract") or "").strip()
            return extract, title
    except Exception as exc:
        logger.warning("Wikipedia research failed for %s: %s", place, exc)
        return "", None


async def _fetch_google_attractions(place: str) -> list[dict[str, Any]]:
    if not GOOGLE_PLACES_API_KEY:
        return []

    queries = [
        f"top tourist attractions in {place}",
        f"things to do in {place}",
        f"landmarks in {place}",
    ]
    seen: set[str] = set()
    results: list[dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=RESEARCH_TIMEOUT) as client:
            for query in queries:
                if len(results) >= 12:
                    break
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={"query": query, "key": GOOGLE_PLACES_API_KEY},
                )
                if resp.status_code != 200:
                    continue

                for place_data in resp.json().get("results", []):
                    name = (place_data.get("name") or "").strip()
                    if not name:
                        continue
                    key = _normalize_key(name)
                    if key in seen:
                        continue
                    seen.add(key)
                    loc = (place_data.get("geometry") or {}).get("location") or {}
                    results.append(
                        {
                            "name": name,
                            "address": place_data.get("formatted_address", ""),
                            "rating": place_data.get("rating"),
                            "types": place_data.get("types", []),
                            "place_id": place_data.get("place_id"),
                            "lat": loc.get("lat"),
                            "lng": loc.get("lng"),
                            "source": "google_places",
                        }
                    )
                    if len(results) >= 12:
                        break
    except Exception as exc:
        logger.warning("Google Places research failed for %s: %s", place, exc)

    return results


async def _enrich_google_details(attractions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pull Place Details (hours/coords) for top Google-sourced attractions via affiliate."""
    place_ids = [
        a.get("place_id")
        for a in attractions
        if a.get("place_id") and (a.get("source") == "google_places" or not a.get("weekday_text"))
    ][:6]
    if not place_ids:
        return attractions

    details_by_id: dict[str, dict[str, Any]] = {}
    try:
        async with httpx.AsyncClient(timeout=RESEARCH_TIMEOUT + 6) as client:
            for pid in place_ids:
                resp = await client.get(
                    f"{AFFILIATE_URL}/api/v1/inventory/places/details",
                    params={"place_id": pid},
                )
                if resp.status_code != 200:
                    continue
                row = resp.json()
                if isinstance(row, dict) and row.get("place_id"):
                    details_by_id[row["place_id"]] = row
    except Exception as exc:
        logger.debug("Place details enrichment skipped: %s", exc)
        return attractions

    if not details_by_id:
        return attractions

    enriched: list[dict[str, Any]] = []
    for item in attractions:
        pid = item.get("place_id")
        detail = details_by_id.get(pid) if pid else None
        if not detail:
            enriched.append(item)
            continue
        merged = dict(item)
        for key in (
            "address",
            "rating",
            "types",
            "lat",
            "lng",
            "weekday_text",
            "open_now",
            "price_level",
            "photo",
            "user_ratings_total",
        ):
            if detail.get(key) is not None and merged.get(key) in (None, "", []):
                merged[key] = detail[key]
            elif key in {"weekday_text", "open_now", "lat", "lng", "photo"} and detail.get(key) is not None:
                merged[key] = detail[key]
        enriched.append(merged)
    return enriched


async def _fetch_destination_place_meta(place: str) -> dict[str, Any]:
    """Resolve destination lat/lng + timezone for itinerary scheduling hints."""
    meta: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=RESEARCH_TIMEOUT) as client:
            ac = await client.get(
                f"{AFFILIATE_URL}/api/v1/inventory/places/autocomplete",
                params={"q": place, "limit": 1, "types": "(cities)"},
            )
            if ac.status_code != 200:
                return meta
            preds = ac.json()
            if not isinstance(preds, list) or not preds:
                return meta
            place_id = preds[0].get("place_id")
            if not place_id:
                return meta
            details_resp = await client.get(
                f"{AFFILIATE_URL}/api/v1/inventory/places/details",
                params={"place_id": place_id},
            )
            if details_resp.status_code != 200:
                return meta
            details = details_resp.json()
            if not isinstance(details, dict):
                return meta
            meta = {
                "place_id": details.get("place_id"),
                "name": details.get("name"),
                "address": details.get("address"),
                "lat": details.get("lat"),
                "lng": details.get("lng"),
            }
            if details.get("lat") is not None and details.get("lng") is not None:
                tz_resp = await client.get(
                    f"{AFFILIATE_URL}/api/v1/inventory/timezone",
                    params={"lat": details["lat"], "lng": details["lng"]},
                )
                if tz_resp.status_code == 200:
                    tz = tz_resp.json()
                    if isinstance(tz, dict):
                        meta["time_zone_id"] = tz.get("time_zone_id")
                        meta["time_zone_name"] = tz.get("time_zone_name")
    except Exception as exc:
        logger.debug("Destination place meta failed for %s: %s", place, exc)
    return meta


def _normalize_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())
