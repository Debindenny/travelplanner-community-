"""Resolve relevant images for AI-generated itineraries."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from app.services.image_search_service import search_images_async

GENERIC_ASSET_MARKERS = (
    "/landing/",
    "/packages/",
    "/figma/",
    "/trips/",
    "journey-thailand",
    "hero-main",
    "hero-extra",
)

TRANSPORT_TYPES = {"flight", "train", "bus", "car"}


def _is_generic_image(url: str | None) -> bool:
    if not url:
        return True
    text = url.strip().lower()
    if not text:
        return True
    if text.startswith("http://") or text.startswith("https://"):
        return False
    return any(marker in text for marker in GENERIC_ASSET_MARKERS)


def _image_identity(url: str | None) -> str:
    """Normalize URL so the same Unsplash photo with different query params counts once."""
    if not url:
        return ""
    text = str(url).strip()
    if not text:
        return ""
    try:
        parsed = urlparse(text)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")
    except Exception:
        pass
    return text


def _clean_text(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"\b(morning|afternoon|evening|night|fullday|halfday)\b", " ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip(" -–—")
    return text


def _primary_destination(destination: str | None) -> str:
    text = _clean_text(destination)
    return text.split(",")[0].strip() if text else "travel destination"


def _segment_location(segment: dict[str, Any], fallback: str) -> str:
    for key in ("location", "arrLocation", "depLocation"):
        value = _clean_text(segment.get(key))
        if value:
            return value
    route = _clean_text(segment.get("route"))
    if route:
        return route
    return fallback


def _cover_query(trip: Any) -> str:
    destination = _primary_destination(getattr(trip, "destination", None))
    interests = getattr(trip, "interests", None) or []
    interest_text = " ".join(str(i) for i in interests[:3])
    return f"{destination} travel landscape landmarks {interest_text}".strip()


def _cover_queries(trip: Any) -> list[tuple[str, bool]]:
    destination = _primary_destination(getattr(trip, "destination", None))
    base = _cover_query(trip)
    return [
        (base, True),
        (f"{destination} tourism landmarks nature", True),
        (f"{destination} travel landscape", False),
    ]


def _segment_queries(segment: dict[str, Any], destination: str) -> list[tuple[str, bool]]:
    seg_type = str(segment.get("type") or "activity").lower()
    location = _segment_location(segment, destination)
    if seg_type == "hotel":
        name = _clean_text(segment.get("name") or segment.get("title") or "hotel")
        return [
            (f"{location} {name} hotel exterior travel stay", False),
            (f"{location} resort hotel exterior", False),
            (f"{destination} hotel resort stay", False),
        ]
    if seg_type == "activity":
        title = _clean_text(segment.get("title") or segment.get("name") or "travel attraction")
        return [
            (f"{location} {title} travel attraction", True),
            (f"{destination} {title} tourism attraction", True),
            (f"{title} {destination} landmark sightseeing", False),
            (f"{location} travel attraction landmarks", False),
            (f"{destination} city landmarks tourism", False),
        ]
    return []


def _image_field(segment: dict[str, Any]) -> str:
    return "image" if str(segment.get("type") or "activity").lower() == "activity" else "imageUrl"


def _apply_image(segment: dict[str, Any], image: dict[str, Any]) -> None:
    field = _image_field(segment)
    segment[field] = image["url"]
    if image.get("alt"):
        segment[f"{field}Alt"] = image["alt"]
    if image.get("source"):
        segment["imageSource"] = image["source"]
    if image.get("photographer"):
        segment["imageCredit"] = image["photographer"]
    if image.get("photographer_url"):
        segment["imageCreditUrl"] = image["photographer_url"]


def _pick_unused(images: list[dict[str, Any]], used_urls: set[str]) -> dict[str, Any] | None:
    for image in images:
        url = image.get("url")
        if not isinstance(url, str) or not url:
            continue
        identity = _image_identity(url)
        if identity and identity not in used_urls:
            used_urls.add(identity)
            return image
    return None


async def _find_image(
    redis: Any,
    queries: list[tuple[str, bool]],
    destination: str,
    used_urls: set[str],
) -> dict[str, Any] | None:
    """Pick a unique image, preferring provider results over curated stock.

    Curated URLs are NOT burned into ``used_urls`` until chosen as the final
    fallback — otherwise a cover query that only returns curated would exhaust
    the pool and leave every activity on the same journey-thailand placeholder.
    """
    fallback_image: dict[str, Any] | None = None
    for query, exact_place in queries:
        images = await search_images_async(
            query,
            destination,
            8,
            redis=redis,
            exact_place=exact_place,
        )
        for image in images:
            url = image.get("url")
            if not isinstance(url, str) or not url:
                continue
            identity = _image_identity(url)
            if not identity or identity in used_urls:
                continue
            if image.get("source") == "curated":
                if fallback_image is None:
                    fallback_image = image
                continue
            used_urls.add(identity)
            return image
    if fallback_image and fallback_image.get("url"):
        used_urls.add(_image_identity(str(fallback_image["url"])))
        return fallback_image
    return None


async def enrich_itinerary_images(redis: Any, trip: Any, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fill trip and segment image fields with relevant internet images.

    This function is best-effort by design. It never raises for image provider
    failures; ``search_images_async`` handles provider fallback, and this layer
    leaves existing provider images untouched unless they are known generic
    local placeholders.
    """
    destination = _primary_destination(getattr(trip, "destination", None))
    used_urls: set[str] = set()

    if not _is_generic_image(getattr(trip, "image", None)):
        used_urls.add(_image_identity(str(trip.image)))
    else:
        cover = await _find_image(redis, _cover_queries(trip), destination, used_urls)
        if cover:
            trip.image = cover["url"]
            # Store optional credit metadata in customizations without changing
            # the public Trip schema.
            custom = dict(getattr(trip, "customizations", None) or {})
            custom["coverImage"] = {
                "alt": cover.get("alt"),
                "source": cover.get("source"),
                "photographer": cover.get("photographer"),
                "photographerUrl": cover.get("photographer_url"),
            }
            trip.customizations = custom

    for segment in segments:
        seg_type = str(segment.get("type") or "activity").lower()
        field = _image_field(segment)
        current = segment.get(field) or segment.get("image") or segment.get("imageUrl")

        if seg_type in TRANSPORT_TYPES:
            # Transport cards have better local operator/type fallbacks than a
            # repeated city photo. Remove generic backfills so the frontend can
            # select its train/bus/car artwork.
            if seg_type != "flight" and _is_generic_image(str(current or "")):
                segment.pop("imageUrl", None)
                segment.pop("image", None)
            continue

        current_url = str(current or "").strip()
        current_id = _image_identity(current_url)
        # Keep unique external photos. Re-fetch when the URL is a known local
        # placeholder OR when the same photo was already used (e.g. package
        # builders stamp the trip cover onto every activity, or Unsplash
        # returns the same photo-id with different query strings).
        if current_url and not _is_generic_image(current_url) and current_id not in used_urls:
            used_urls.add(current_id)
            continue

        queries = _segment_queries(segment, destination)
        if not queries:
            continue

        image = await _find_image(redis, queries, destination, used_urls)
        if image:
            _apply_image(segment, image)

    return segments
