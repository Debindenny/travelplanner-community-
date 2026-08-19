"""Backend geocoding proxy — GET /api/v1/geocode?q=... (T3.5).

Proxies Nominatim (OpenStreetMap) so the browser never calls it directly
(respects Nominatim's User-Agent policy, hides credentials, and adds caching).

Features:
- Redis cache with configurable TTL (default 24 h) keyed by normalised query
- Simple Redis-based rate limiter so we don't hammer Nominatim (~1 req/s limit)
- Returns the top result in a compact shape (name, lat, lon, display_name)

Do NOT call Nominatim from the browser — use this endpoint instead.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from shared.rate_limit import rate_limiter

logger = logging.getLogger(__name__)
router = APIRouter()

NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
NOMINATIM_UA = os.environ.get(
    "NOMINATIM_USER_AGENT",
    "travlplanr/1.0 (travel planner; contact@travlplanr.com)",
)
GEOCODE_CACHE_TTL = int(os.environ.get("GEOCODE_CACHE_TTL_SECONDS", str(24 * 3600)))
GEOCODE_TIMEOUT = float(os.environ.get("GEOCODE_TIMEOUT_SECONDS", "5"))
# Nominatim asks for max ~1 req/s from any single IP.
_NOMINATIM_RATE_KEY = "geocode:nominatim:last_call"
_NOMINATIM_MIN_INTERVAL = 1.1  # seconds between real Nominatim requests


def _cache_key(q: str) -> str:
    normalised = q.strip().lower()
    digest = hashlib.sha256(normalised.encode()).hexdigest()[:16]
    return f"geocode:{digest}"


async def _nominatim_rate_ok(redis) -> bool:
    """Returns True and records the call timestamp if we're allowed to proceed."""
    if redis is None:
        return True
    now = time.time()
    last_raw = await redis.get(_NOMINATIM_RATE_KEY)
    if last_raw:
        last = float(last_raw)
        if (now - last) < _NOMINATIM_MIN_INTERVAL:
            return False
    await redis.set(_NOMINATIM_RATE_KEY, now, ex=10)
    return True


@router.get("/geocode", dependencies=[Depends(rate_limiter("geocode", 30, 60))])
async def geocode_query(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200),
):
    """Proxy Nominatim geocoding with Redis cache and rate limiting.

    Returns a one-element array (Angular GeocodingService expects an array)::

        [{"name": str, "display_name": str, "lat": float, "lon": float}]

    or 404 when no results are found.
    """
    redis = getattr(request.app.state, "redis", None)
    cache_key = _cache_key(q)

    # Cache hit
    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                # Back-compat: older cache entries were a single object.
                return data if isinstance(data, list) else [data]
        except Exception as exc:
            logger.debug("geocode cache read failed: %s", exc)

    # Rate-limit check before hitting Nominatim
    if not await _nominatim_rate_ok(redis):
        raise HTTPException(
            status_code=429,
            detail="Geocoding rate limit — please retry in a moment.",
        )

    try:
        async with httpx.AsyncClient(timeout=GEOCODE_TIMEOUT) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"q": q, "format": "json", "limit": 1, "addressdetails": 0},
                headers={"User-Agent": NOMINATIM_UA, "Accept-Language": "en"},
            )
            resp.raise_for_status()
            results = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Geocoding service timed out")
    except Exception as exc:
        logger.warning("Nominatim request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Geocoding service unavailable")

    if not results:
        raise HTTPException(status_code=404, detail="No geocoding result found")

    top = results[0]
    payload = {
        "name": top.get("name") or top.get("display_name", "").split(",")[0].strip(),
        "display_name": top.get("display_name", ""),
        "lat": float(top["lat"]),
        "lon": float(top["lon"]),
    }
    response = [payload]

    if redis is not None:
        try:
            await redis.set(cache_key, json.dumps(response), ex=GEOCODE_CACHE_TTL)
        except Exception as exc:
            logger.debug("geocode cache write failed: %s", exc)

    return response
