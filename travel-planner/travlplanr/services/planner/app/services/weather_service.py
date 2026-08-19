"""Fetch live weather via Open-Meteo (no API key required)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Approximate coordinates for supported destinations
DESTINATION_COORDS: dict[str, tuple[float, float]] = {
    "dubai": (25.2048, 55.2708),
    "bali": (-8.3405, 115.092),
    "paris": (48.8566, 2.3522),
    "barcelona": (41.3874, 2.1686),
    "singapore": (1.3521, 103.8198),
    "thailand": (13.7563, 100.5018),
    "bangkok": (13.7563, 100.5018),
    "japan": (35.6762, 139.6503),
    "tokyo": (35.6762, 139.6503),
    "maldives": (3.2028, 73.2207),
    "switzerland": (46.8182, 8.2275),
    "greece": (37.9838, 23.7275),
    "italy": (41.9028, 12.4964),
    "rome": (41.9028, 12.4964),
    "spain": (40.4168, -3.7038),
    "madrid": (40.4168, -3.7038),
    "london": (51.5074, -0.1278),
    "australia": (-33.8688, 151.2093),
    "sydney": (-33.8688, 151.2093),
    "malaysia": (3.139, 101.6869),
    "morocco": (33.5731, -7.5898),
    "egypt": (30.0444, 31.2357),
    "kenya": (-1.2921, 36.8219),
    "fiji": (-17.7134, 178.065),
    "seychelles": (-4.6796, 55.492),
    "goa": (15.2993, 74.124),
    "india": (28.6139, 77.209),
    "europe": (48.8566, 2.3522),
    "france": (48.8566, 2.3522),
    "new york": (40.7128, -74.006),
    "orlando": (28.5383, -81.3792),
    "qatar": (25.2854, 51.531),
    "doha": (25.2854, 51.531),
}


def _coords_for_destination(destination: str | None) -> tuple[float, float] | None:
    if not destination:
        return None
    key = destination.lower().strip()
    if key in DESTINATION_COORDS:
        return DESTINATION_COORDS[key]
    for name, coords in DESTINATION_COORDS.items():
        if name in key or key in name:
            return coords
    return None


async def fetch_weather_summary(destination: str | None) -> dict[str, Any] | None:
    """Return a short weather summary for chat enrichment."""
    coords = _coords_for_destination(destination)
    if not coords:
        return None
    lat, lon = coords
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code"
        "&timezone=auto&forecast_days=7"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url)
            res.raise_for_status()
            data = res.json()
    except Exception:
        logger.warning("weather fetch failed for %s", destination, exc_info=True)
        return None

    current = data.get("current", {})
    daily = data.get("daily", {})
    codes = daily.get("weather_code", [])
    temps_max = daily.get("temperature_2m_max", [])
    temps_min = daily.get("temperature_2m_min", [])
    precip = daily.get("precipitation_probability_max", [])

    return {
        "destination": destination,
        "currentTempC": current.get("temperature_2m"),
        "currentHumidity": current.get("relative_humidity_2m"),
        "currentCode": current.get("weather_code"),
        "forecast": [
            {
                "day": i + 1,
                "tempMaxC": temps_max[i] if i < len(temps_max) else None,
                "tempMinC": temps_min[i] if i < len(temps_min) else None,
                "precipChance": precip[i] if i < len(precip) else None,
                "weatherCode": codes[i] if i < len(codes) else None,
            }
            for i in range(min(7, len(codes)))
        ],
    }


def format_weather_for_reply(summary: dict[str, Any] | None) -> str:
    if not summary:
        return ""
    dest = summary.get("destination", "the destination")
    temp = summary.get("currentTempC")
    forecast = summary.get("forecast") or []
    parts: list[str] = []
    if temp is not None:
        parts.append(f"Right now in {dest} it's about {temp:.0f}°C")
    if forecast:
        highs = [f["tempMaxC"] for f in forecast[:3] if f.get("tempMaxC") is not None]
        lows = [f["tempMinC"] for f in forecast[:3] if f.get("tempMinC") is not None]
        if highs and lows:
            parts.append(
                f"the next few days look like {min(lows):.0f}–{max(highs):.0f}°C"
            )
        rainy = [f for f in forecast if (f.get("precipChance") or 0) > 50]
        if rainy:
            parts.append(f"rain is likely on {len(rainy)} of the next 7 days — pack accordingly")
        elif forecast:
            parts.append("conditions look mostly dry over the next week")
    if not parts:
        return ""
    return " ".join(parts) + "."
