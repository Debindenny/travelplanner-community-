"""Enrich same-day activity segments with Google Routes travel times."""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

AFFILIATE_URL = os.environ.get("AFFILIATE_URL", "http://affiliate:8000").rstrip("/")
ROUTES_TIMEOUT = float(os.environ.get("TRAVEL_TIME_TIMEOUT_SECONDS", "20"))


async def enrich_segments_with_travel_times(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """For consecutive activities on the same day with lat/lng, attach travelMinutes."""
    if not segments:
        return segments

    # Group activity indices by day
    by_day: dict[int, list[int]] = {}
    for idx, seg in enumerate(segments):
        if str(seg.get("type") or "").lower() != "activity":
            continue
        day = int(seg.get("day") or 1)
        by_day.setdefault(day, []).append(idx)

    out = [dict(s) for s in segments]
    try:
        async with httpx.AsyncClient(timeout=ROUTES_TIMEOUT) as client:
            for _day, indices in by_day.items():
                for a, b in zip(indices, indices[1:]):
                    origin = out[a]
                    dest = out[b]
                    o_lat, o_lng = _coords(origin)
                    d_lat, d_lng = _coords(dest)
                    if None in (o_lat, o_lng, d_lat, d_lng):
                        continue
                    if dest.get("travelMinutes") or dest.get("travel_duration"):
                        continue
                    try:
                        resp = await client.post(
                            f"{AFFILIATE_URL}/api/v1/inventory/routes/compute",
                            json={
                                "origin_lat": o_lat,
                                "origin_lng": o_lng,
                                "dest_lat": d_lat,
                                "dest_lng": d_lng,
                                "travel_mode": "DRIVE",
                            },
                        )
                        if resp.status_code != 200:
                            continue
                        route = resp.json()
                        if not isinstance(route, dict):
                            continue
                        seconds = int(route.get("duration_seconds") or 0)
                        minutes = max(1, round(seconds / 60)) if seconds else None
                        if minutes is None:
                            continue
                        out[b]["travelMinutes"] = minutes
                        out[b]["travelDuration"] = route.get("duration") or f"{minutes}m"
                        out[b]["travelDistanceKm"] = route.get("distance_km")
                        out[b]["travelMode"] = route.get("travel_mode") or "DRIVE"
                        out[b]["travelFrom"] = origin.get("title") or origin.get("name")
                    except Exception as exc:
                        logger.debug("Route enrich failed: %s", exc)
    except Exception as exc:
        logger.warning("Travel time enrichment skipped: %s", exc)

    return out


def _coords(seg: dict[str, Any]) -> tuple[float | None, float | None]:
    lat = seg.get("lat")
    lng = seg.get("lng")
    if lat is None:
        lat = (seg.get("details") or {}).get("lat") if isinstance(seg.get("details"), dict) else None
    if lng is None:
        lng = (seg.get("details") or {}).get("lng") if isinstance(seg.get("details"), dict) else None
    try:
        return (float(lat) if lat is not None else None, float(lng) if lng is not None else None)
    except (TypeError, ValueError):
        return None, None
