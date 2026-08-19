"""Nearest-airport resolution backed by a bundled OurAirports dataset.

Single source of truth for city → IATA lookups. Replaces the hard-coded
dictionaries that previously drifted apart across planner modules
(trip_route.NEAREST_AIRPORT_CITY, package_plan_builder.CITY_AIRPORT,
inventory_search.CITY_AIRPORT_CODES).

Resolution order for a free-text place:
1. Alias table — towns with no airport of their own (Chalakudy → COK),
   spelling variants (Bengaluru/Bangalore), and multi-airport cities pinned
   to their primary hub (London → LHR, not LGW).
2. Municipality match against the bundled dataset (3,270 airports with
   scheduled service worldwide).
3. Optional geocode (Nominatim) + haversine nearest-airport for places the
   name lookups don't know — async callers only.

Dataset row format: [iata, airport_name, municipality, iso_country, lat, lng, is_large].
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).parent / "data" / "airports.json"

NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
NOMINATIM_UA = os.environ.get(
    "NOMINATIM_USER_AGENT",
    "travlplanr/1.0 (travel planner; contact@travlplanr.com)",
)
GEOCODE_TIMEOUT = float(os.environ.get("GEOCODE_TIMEOUT_SECONDS", "5"))

# Towns without their own scheduled-service airport, spelling variants, and
# multi-airport cities pinned to the hub the product has always used.
PLACE_TO_IATA: dict[str, str] = {
    # Kerala towns → their gateway airports
    "chalakudy": "COK",
    "chalakudi": "COK",
    "alleppey": "COK",
    "alappuzha": "COK",
    "munnar": "COK",
    "thekkady": "COK",
    "kumarakom": "COK",
    "varkala": "TRV",
    "kovalam": "TRV",
    # NCR towns → Delhi
    "agra": "DEL",
    "gurgaon": "DEL",
    "gurugram": "DEL",
    "noida": "DEL",
    "faridabad": "DEL",
    # Indian city variants
    "bangalore": "BLR",
    "bengaluru": "BLR",
    "bombay": "BOM",
    "madras": "MAA",
    "calcutta": "CCU",
    "cochin": "COK",
    "delhi": "DEL",
    "new delhi": "DEL",
    # Multi-airport cities pinned to their primary hub
    "london": "LHR",
    "paris": "CDG",
    "tokyo": "HND",
    "dubai": "DXB",
    "new york": "JFK",
    "rome": "FCO",
    "milan": "MXP",
    "moscow": "SVO",
    "istanbul": "IST",
    "bangkok": "BKK",
    "sao paulo": "GRU",
    "buenos aires": "EZE",
    "shanghai": "PVG",
    "beijing": "PEK",
    "berlin": "BER",
    "chicago": "ORD",
    "los angeles": "LAX",
    "washington": "IAD",
    "seoul": "ICN",
    "osaka": "KIX",
    "jakarta": "CGK",
    "toronto": "YYZ",
    "montreal": "YUL",
    # Region/island labels used across the product
    "bali": "DPS",
    "maldives": "MLE",
    "goa": "GOI",
}


@lru_cache(maxsize=1)
def _airports() -> list[list]:
    with open(_DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.strip().lower())


@lru_cache(maxsize=1)
def _city_index() -> dict[str, str]:
    """Municipality → IATA, preferring large airports when a city has several."""
    index: dict[str, tuple[str, int]] = {}
    for iata, _name, city, _country, _lat, _lng, large in _airports():
        # "Paris (Roissy-en-France, Val-d'Oise)" also indexes as "paris"
        for key in {_norm(city), _norm(city.split("(")[0])}:
            if not key:
                continue
            existing = index.get(key)
            if existing is None or (large and not existing[1]):
                index[key] = (iata, large)
    return {key: pair[0] for key, pair in index.items()}


@lru_cache(maxsize=1)
def _by_code() -> dict[str, list]:
    return {row[0]: row for row in _airports()}


def airport_code_for_place(place: str | None) -> str | None:
    """Resolve a city/town name to an IATA code by name lookup (no network)."""
    key = _norm(place or "")
    if not key:
        return None
    alias = PLACE_TO_IATA.get(key)
    if alias:
        return alias
    code = _city_index().get(key)
    if code:
        return code
    # Already an IATA code (only when it isn't also a city name, e.g. "goa")
    if len(key) == 3 and key.upper() in _by_code():
        return key.upper()
    return None


def airport_city_for_place(place: str | None) -> str | None:
    """Resolve a place to the city of its nearest known airport (display label)."""
    code = airport_code_for_place(place)
    if not code:
        return None
    row = _by_code().get(code)
    if not row:
        return None
    return str(row[2]).split("(")[0].strip() or None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rad = math.radians
    dlat = rad(lat2 - lat1)
    dlng = rad(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def nearest_airport_by_coords(lat: float, lng: float) -> dict | None:
    """Nearest scheduled-service airport to a coordinate.

    Large hubs get a distance discount so a major international airport a bit
    further out wins over a small regional strip next door — the flight search
    behind this needs airports carriers actually serve well.
    """
    best: list | None = None
    best_score = float("inf")
    for row in _airports():
        dist = _haversine_km(lat, lng, row[4], row[5])
        if dist > 500:
            continue
        score = dist if row[6] else dist * 1.5
        if score < best_score:
            best_score = score
            best = row
    if not best:
        return None
    return {
        "iata": best[0],
        "name": best[1],
        "city": str(best[2]).split("(")[0].strip(),
        "country": best[3],
        "distance_km": round(_haversine_km(lat, lng, best[4], best[5]), 1),
    }


async def geocode_place(place: str) -> tuple[float, float] | None:
    """Best-effort Nominatim geocode. Returns (lat, lng) or None — never raises."""
    query = (place or "").strip()
    if len(query) < 2:
        return None
    try:
        import httpx

        async with httpx.AsyncClient(timeout=GEOCODE_TIMEOUT) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": 1, "addressdetails": 0},
                headers={"User-Agent": NOMINATIM_UA, "Accept-Language": "en"},
            )
            resp.raise_for_status()
            results = resp.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as exc:
        logger.warning("geocode failed for %r: %s", place, exc)
    return None


async def resolve_airport_code(place: str | None, *, allow_geocode: bool = True) -> str | None:
    """Full resolution: alias/dataset name match, then geocode + nearest airport."""
    code = airport_code_for_place(place)
    if code or not allow_geocode:
        return code
    coords = await geocode_place(place or "")
    if not coords:
        return None
    nearest = nearest_airport_by_coords(*coords)
    return nearest["iata"] if nearest else None
