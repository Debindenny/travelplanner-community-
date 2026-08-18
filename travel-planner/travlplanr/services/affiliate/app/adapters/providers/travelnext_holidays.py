"""TravelNext Holidays API adapter.

Covers the documented surface: country search, travel-style search, package
details, booking, booking details, and the two reference-data lists
(countries, travel styles). Every endpoint requires the full
`user_id`/`user_password`/`access`/`ip_address` block. Same sandbox account as
the flight API (`travelnext.py`) — only the product base URL differs — so
credentials are read from the same `TRAVELNEXT_*` env vars.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from shared.circuit_breaker import CircuitBreaker, CircuitBreakerOpen

from app.adapters.providers.travelnext import (
    TRAVELNEXT_ACCESS,
    TRAVELNEXT_USER_ID,
    TRAVELNEXT_USER_PASSWORD,
    get_travelnext_ip,
    has_travelnext_credentials,
)
from app.schemas.inventory import InventoryItem

logger = logging.getLogger(__name__)

TRAVELNEXT_HOLIDAY_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_HOLIDAY_API_BASE_URL") or "https://travelnext.works/api"
).rstrip("/")

_travelnext_holidays_breaker = CircuitBreaker(name="travelnext_holidays", failure_threshold=5, recovery_timeout=60.0)

_countries_cache: list[dict] | None = None
_travel_styles_cache: list[str] | None = None


def has_travelnext_holidays_credentials() -> bool:
    return has_travelnext_credentials()


def _auth_block() -> dict:
    return {
        "user_id": TRAVELNEXT_USER_ID,
        "user_password": TRAVELNEXT_USER_PASSWORD,
        "access": TRAVELNEXT_ACCESS,
        "ip_address": get_travelnext_ip(),
    }


async def _request_with_retry(request_fn, *, label: str, retries: int = 3) -> httpx.Response:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            return await request_fn()
        except (httpx.HTTPError, asyncio.TimeoutError) as exc:
            last_error = exc
            if attempt == retries - 1:
                logger.error("%s failed after %s attempts: %s", label, retries, exc)
                raise
            await asyncio.sleep(0.5 * (2 ** attempt))
    raise last_error  # type: ignore[misc]


async def _post(path: str, body: dict, *, timeout: float = 15.0) -> Any:
    if not has_travelnext_holidays_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_HOLIDAY_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext Holidays {path}",
            )
            if response.status_code >= 400:
                logger.error("TravelNext Holidays %s returned %s: %s", path, response.status_code, response.text[:500])
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(f"TravelNext Holidays {path} error: {data['error']}")
            return data

    return await _travelnext_holidays_breaker.call(_call)


# --------------------------------------------------------------------------
# Reference data
# --------------------------------------------------------------------------

async def get_countries(force_refresh: bool = False) -> list[dict]:
    global _countries_cache
    if _countries_cache is not None and not force_refresh:
        return _countries_cache
    data = await _post("holiday-countries", _auth_block())
    _countries_cache = data if isinstance(data, list) else data.get("country_det", [])
    return _countries_cache


async def get_travel_styles(force_refresh: bool = False) -> list[str]:
    global _travel_styles_cache
    if _travel_styles_cache is not None and not force_refresh:
        return _travel_styles_cache
    data = await _post("travel-styles", _auth_block())
    _travel_styles_cache = data if isinstance(data, list) else data.get("travel_styles", [])
    return _travel_styles_cache


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------

async def search_by_country(
    country: str,
    from_date: str,
    to_date: str,
    *,
    required_currency: str = "USD",
) -> dict:
    body = {
        **_auth_block(),
        "country": country,
        "from_date": from_date,
        "to_date": to_date,
        "requiredCurrency": required_currency,
    }
    return await _post("holiday-search", body, timeout=30.0)


async def search_by_travel_style(
    travel_style: str,
    from_date: str,
    to_date: str,
    *,
    required_currency: str = "USD",
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
) -> dict:
    body: dict[str, Any] = {
        **_auth_block(),
        "travel_style": travel_style,
        "from_date": from_date,
        "to_date": to_date,
        "requiredCurrency": required_currency,
    }
    if min_price is not None:
        body["minPrice"] = min_price
    if max_price is not None:
        body["maxPrice"] = max_price
    return await _post("holidays-travel-style-search", body, timeout=30.0)


# --------------------------------------------------------------------------
# Details
# --------------------------------------------------------------------------

async def get_holiday_details(holiday_code: str, *, required_currency: str = "USD") -> dict:
    body = {
        **_auth_block(),
        "holiday_code": holiday_code,
        "requiredCurrency": required_currency,
    }
    return await _post("holday-details", body, timeout=30.0)


# --------------------------------------------------------------------------
# Booking
# --------------------------------------------------------------------------

async def create_booking(reference_code: str, lead_passenger: dict) -> dict:
    body = {
        **_auth_block(),
        "ReferenceCode": reference_code,
        "leadPassanger": lead_passenger,
    }
    return await _post("holiday-booking", body, timeout=60.0)


async def get_booking_details(reference_code: str) -> dict:
    body = {**_auth_block(), "ReferenceCode": reference_code}
    return await _post("booking-details", body)


# --------------------------------------------------------------------------
# Inventory mapping (unified /inventory/search)
# --------------------------------------------------------------------------

_CITY_TO_COUNTRY = {
    "amsterdam": "Netherlands",
    "rotterdam": "Netherlands",
    "paris": "France",
    "lyon": "France",
    "nice": "France",
    "london": "United Kingdom",
    "manchester": "United Kingdom",
    "edinburgh": "United Kingdom",
    "rome": "Italy",
    "milan": "Italy",
    "florence": "Italy",
    "venice": "Italy",
    "madrid": "Spain",
    "barcelona": "Spain",
    "berlin": "Germany",
    "munich": "Germany",
    "frankfurt": "Germany",
    "vienna": "Austria",
    "prague": "Czech Republic",
    "lisbon": "Portugal",
    "porto": "Portugal",
    "athens": "Greece",
    "dublin": "Ireland",
    "brussels": "Belgium",
    "zurich": "Switzerland",
    "geneva": "Switzerland",
    "copenhagen": "Denmark",
    "stockholm": "Sweden",
    "oslo": "Norway",
    "helsinki": "Finland",
    "budapest": "Hungary",
    "warsaw": "Poland",
    "istanbul": "Turkey",
    "dubai": "United Arab Emirates",
    "bangkok": "Thailand",
    "phuket": "Thailand",
    "singapore": "Singapore",
    "tokyo": "Japan",
    "osaka": "Japan",
    "seoul": "South Korea",
    "sydney": "Australia",
    "melbourne": "Australia",
    "auckland": "New Zealand",
    "new york": "United States",
    "los angeles": "United States",
    "san francisco": "United States",
    "chicago": "United States",
    "miami": "United States",
    "toronto": "Canada",
    "vancouver": "Canada",
    "mexico city": "Mexico",
    "cancun": "Mexico",
    "delhi": "India",
    "new delhi": "India",
    "mumbai": "India",
    "bangalore": "India",
    "bengaluru": "India",
    "chennai": "India",
    "kolkata": "India",
    "jaipur": "India",
    "goa": "India",
    "kathmandu": "Nepal",
    "pokhara": "Nepal",
    "colombo": "Sri Lanka",
    "male": "Maldives",
    "cairo": "Egypt",
    "marrakech": "Morocco",
    "cape town": "South Africa",
    "nairobi": "Kenya",
    "rio de janeiro": "Brazil",
    "sao paulo": "Brazil",
    "buenos aires": "Argentina",
    "lima": "Peru",
    "cusco": "Peru",
}

_REGION_TO_COUNTRY = {
    "europe": "France",
    "asia": "Thailand",
    "southeast asia": "Thailand",
    "south asia": "India",
    "india": "India",
    "middle east": "United Arab Emirates",
    "africa": "Morocco",
    "north america": "United States",
    "south america": "Brazil",
    "oceania": "Australia",
    "australia": "Australia",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "usa": "United States",
    "united states": "United States",
    "uae": "United Arab Emirates",
}


def _normalize_place(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def resolve_holiday_country(location: Optional[str]) -> Optional[str]:
    """Map a trip city/region string to a TravelNext Holidays country name."""
    if not location:
        return None
    raw = location.strip()
    if not raw:
        return None

    # "Amsterdam, Netherlands" → prefer the country segment.
    if "," in raw:
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if len(parts) >= 2:
            country_guess = parts[-1]
            if _normalize_place(country_guess) in _REGION_TO_COUNTRY or len(country_guess) > 3:
                return _REGION_TO_COUNTRY.get(_normalize_place(country_guess), country_guess)
            raw = parts[0]

    key = _normalize_place(raw)
    if key in _CITY_TO_COUNTRY:
        return _CITY_TO_COUNTRY[key]
    if key in _REGION_TO_COUNTRY:
        return _REGION_TO_COUNTRY[key]
    # Already a country name (or best-effort pass-through).
    return raw.title() if raw.islower() else raw


def _default_holiday_dates(date: Optional[str]) -> tuple[str, str]:
    if date:
        try:
            start = datetime.strptime(date[:10], "%Y-%m-%d").date()
        except ValueError:
            start = datetime.now(timezone.utc).date() + timedelta(days=1)
    else:
        start = datetime.now(timezone.utc).date() + timedelta(days=1)
    end = start + timedelta(days=14)
    return start.isoformat(), end.isoformat()


def _price(value: Any) -> Optional[float]:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount > 0 else None


async def search_holidays(
    location: Optional[str], budget: Optional[str], date: Optional[str] = None
) -> list[InventoryItem]:
    """Inventory-shaped holiday packages for /inventory/search?type=holiday."""
    del budget  # TravelNext Holidays has no budget tier filter on search.
    if not (has_travelnext_holidays_credentials() and location):
        return []

    country = resolve_holiday_country(location)
    if not country:
        return []

    from_date, to_date = _default_holiday_dates(date)
    try:
        response = await search_by_country(country, from_date, to_date)
    except CircuitBreakerOpen:
        logger.warning("TravelNext Holidays search skipped — circuit breaker open")
        return []
    except Exception as exc:
        logger.error("TravelNext Holidays search failed: %s", exc)
        return []

    holidays = response.get("holidays") if isinstance(response, dict) else None
    if not isinstance(holidays, list):
        return []

    results: list[InventoryItem] = []
    for row in holidays:
        if not isinstance(row, dict):
            continue
        price = _price(row.get("total_price")) or _price(row.get("pricePerDay"))
        if price is None:
            continue
        holiday_id = str(row.get("id") or row.get("holiday_code") or "")
        if not holiday_id:
            continue
        title = str(row.get("package_name") or row.get("title") or "Holiday package").strip()
        title = re.sub(r"\s*:\s*$", "", title)
        duration = str(row.get("duration") or "").strip() or None
        image = row.get("main_img") or row.get("dwn_main_img") or row.get("map_img")
        rating_raw = row.get("rating")
        try:
            rating = float(rating_raw) if rating_raw not in (None, "") else None
        except (TypeError, ValueError):
            rating = None

        results.append(
            InventoryItem(
                id=holiday_id,
                type="holiday",
                provider="travelnext",
                title=title,
                price=price,
                currency="USD",
                deep_link="",
                duration=duration,
                image_url=str(image) if image else None,
                details={
                    "holiday_code": holiday_id,
                    "destinations": row.get("destinations"),
                    "start_end": row.get("start_end"),
                    "travel_style": row.get("travel_style"),
                    "operator": row.get("operator"),
                    "accommodation": row.get("accommodation"),
                    "transport": row.get("transport"),
                    "age_range": row.get("age_range"),
                    "special_label": row.get("specialTour_lable"),
                    "price_per_day": _price(row.get("pricePerDay")),
                    "saving_price": _price(row.get("saving_price")),
                    "from_date": row.get("from_date"),
                    "to_date": row.get("to_date"),
                    "country": country,
                    "search_from": from_date,
                    "search_to": to_date,
                    "rating": rating,
                    "bookable": True,
                },
            )
        )

    results.sort(key=lambda item: item.price)
    return results[:20]
