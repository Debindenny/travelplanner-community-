"""Google Routes API + Time Zone API helpers for itinerary travel times."""
from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Optional

import httpx

from app.schemas.inventory import InventoryItem

logger = logging.getLogger(__name__)

GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "").strip()
ROUTES_TIMEOUT = float(os.environ.get("GOOGLE_ROUTES_TIMEOUT_SECONDS", "12"))
_geocode_cache: dict[str, tuple[float, float]] = {}


def _format_duration(seconds: float | int | None) -> str:
    if seconds is None:
        return ""
    total = max(int(seconds), 0)
    hours, rem = divmod(total, 3600)
    minutes = rem // 60
    if hours and minutes:
        return f"{hours}h {minutes:02d}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


async def compute_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    *,
    travel_mode: str = "DRIVE",
) -> dict[str, Any] | None:
    """Compute travel duration/distance between two lat/lng points via Routes API."""
    if not GOOGLE_PLACES_API_KEY:
        return None
    mode = (travel_mode or "DRIVE").upper()
    if mode not in {"DRIVE", "WALK", "BICYCLE", "TRANSIT", "TWO_WHEELER"}:
        mode = "DRIVE"

    body = {
        "origin": {
            "location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}
        },
        "destination": {
            "location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}
        },
        "travelMode": mode,
        "computeAlternativeRoutes": False,
        "languageCode": "en-US",
        "units": "METRIC",
    }
    # routingPreference is invalid for TRANSIT mode.
    if mode != "TRANSIT":
        body["routingPreference"] = (
            os.environ.get("GOOGLE_ROUTES_ROUTING_PREFERENCE", "TRAFFIC_AWARE_OPTIMAL").strip()
            or "TRAFFIC_AWARE_OPTIMAL"
        )
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    }
    try:
        async with httpx.AsyncClient(timeout=ROUTES_TIMEOUT) as client:
            resp = await client.post(
                "https://routes.googleapis.com/directions/v2:computeRoutes",
                headers=headers,
                json=body,
            )
            if resp.status_code in {400, 422} and mode != "TRANSIT" and body.get("routingPreference") != "TRAFFIC_UNAWARE":
                fallback_body = dict(body)
                fallback_body["routingPreference"] = "TRAFFIC_UNAWARE"
                resp = await client.post(
                    "https://routes.googleapis.com/directions/v2:computeRoutes",
                    headers=headers,
                    json=fallback_body,
                )
            if resp.status_code != 200:
                logger.warning("Routes API HTTP %s: %s", resp.status_code, resp.text[:300])
                return None
            routes = (resp.json() or {}).get("routes") or []
            if not routes:
                return None
            route = routes[0]
            duration_raw = route.get("duration") or "0s"
            # duration is like "1234s"
            seconds = 0
            if isinstance(duration_raw, str) and duration_raw.endswith("s"):
                try:
                    seconds = int(float(duration_raw[:-1]))
                except ValueError:
                    seconds = 0
            distance_m = int(route.get("distanceMeters") or 0)
            return {
                "travel_mode": mode,
                "duration_seconds": seconds,
                "duration": _format_duration(seconds),
                "distance_meters": distance_m,
                "distance_km": round(distance_m / 1000, 1) if distance_m else 0,
                "polyline": ((route.get("polyline") or {}).get("encodedPolyline")),
                "source": "google_routes",
            }
    except Exception as exc:
        logger.warning("Routes API failed: %s", exc)
        return None


async def geocode_place(query: str) -> tuple[float, float] | None:
    """Resolve a city/station name to lat/lng via Places Text Search."""
    if not GOOGLE_PLACES_API_KEY or not (query or "").strip():
        return None
    key = query.strip().lower()
    if key in _geocode_cache:
        return _geocode_cache[key]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={"query": query, "key": GOOGLE_PLACES_API_KEY},
            )
            if resp.status_code != 200:
                return None
            results = (resp.json() or {}).get("results") or []
            if not results:
                return None
            loc = ((results[0].get("geometry") or {}).get("location")) or {}
            lat, lng = loc.get("lat"), loc.get("lng")
            if lat is None or lng is None:
                return None
            point = (float(lat), float(lng))
            _geocode_cache[key] = point
            return point
    except Exception as exc:
        logger.warning("Geocode failed for %s: %s", query, exc)
        return None


async def search_transit_inventory(
    type_of_transit: str,
    dep: Optional[str],
    arr: Optional[str],
    budget: Optional[str],
) -> list[InventoryItem]:
    """Build train/bus inventory options from Google Routes TRANSIT mode.

    Not a ticket vendor — returns realistic duration/distance for the corridor
    when Places + Routes are available; callers may fall back to mocks.
    """
    if not (GOOGLE_PLACES_API_KEY and dep and arr):
        return []

    # Prefer plain city geocodes — appending "station" can resolve to
    # unrelated towns (e.g. "Paris station" → Paris, Tennessee).
    origin = await geocode_place(dep)
    dest = await geocode_place(arr)
    if not (origin and dest):
        return []

    route = await compute_route(
        origin[0],
        origin[1],
        dest[0],
        dest[1],
        travel_mode="TRANSIT",
    )
    if not route or not route.get("duration_seconds"):
        # Transit coverage can be sparse — DRIVE duration is a usable planning estimate.
        route = await compute_route(origin[0], origin[1], dest[0], dest[1], travel_mode="DRIVE")
        if not route or not route.get("duration_seconds"):
            return []
        mode_label = "Road transfer"
    else:
        mode_label = "Transit"

    seconds = int(route["duration_seconds"])
    base = 45 if budget == "economy" else (90 if budget == "luxury" else 70)
    # Rough fare estimate from distance when no ticket API is configured.
    distance_km = float(route.get("distance_km") or 0)
    price = round(max(base, distance_km * (0.12 if type_of_transit == "train" else 0.08)), 2)
    duration = route.get("duration") or ""
    carrier = "Rail Europe" if type_of_transit == "train" else "FlixBus"
    maps_url = (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin[0]},{origin[1]}&destination={dest[0]},{dest[1]}"
        "&travelmode=transit"
    )

    return [
        InventoryItem(
            id=str(uuid.uuid4()),
            type=type_of_transit,
            provider="google_routes",
            title=f"{carrier} {dep} → {arr}",
            price=price,
            currency="USD",
            deep_link=maps_url,
            start_time="08:00",
            end_time=None,
            duration=duration,
            details={
                "carrier": carrier,
                "depLocation": dep,
                "arrLocation": arr,
                "stops": "See route",
                "class": "Standard",
                "distance_km": distance_km,
                "duration_seconds": seconds,
                "travel_mode": route.get("travel_mode"),
                "mode_label": mode_label,
                "bookable": False,
                "content_only": False,
            },
        )
    ]


async def get_timezone(
    lat: float,
    lng: float,
    *,
    timestamp: Optional[int] = None,
) -> dict[str, Any] | None:
    """Resolve IANA timezone for a lat/lng via Time Zone API."""
    if not GOOGLE_PLACES_API_KEY:
        return None
    import time

    ts = timestamp if timestamp is not None else int(time.time())
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/timezone/json",
                params={
                    "location": f"{lat},{lng}",
                    "timestamp": ts,
                    "key": GOOGLE_PLACES_API_KEY,
                },
            )
            if resp.status_code != 200:
                logger.warning("Time Zone API HTTP %s: %s", resp.status_code, resp.text[:200])
                return None
            data = resp.json()
            if data.get("status") != "OK":
                logger.warning("Time Zone status=%s: %s", data.get("status"), data.get("errorMessage"))
                return None
            return {
                "time_zone_id": data.get("timeZoneId"),
                "time_zone_name": data.get("timeZoneName"),
                "raw_offset": data.get("rawOffset"),
                "dst_offset": data.get("dstOffset"),
                "source": "google_timezone",
            }
    except Exception as exc:
        logger.warning("Time Zone API failed: %s", exc)
        return None
