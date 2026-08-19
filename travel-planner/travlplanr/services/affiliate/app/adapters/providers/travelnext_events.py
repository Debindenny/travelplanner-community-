"""TravelNext Events (sports/concert tickets) API adapter.

Covers the documented surface: event search (by location, competitor, or
tournament — all dispatched through the single `search_events` endpoint via
`searchMethod`), per-event ticket search (`ticket_details` — its own
endpoint, confirmed against the provider's API console, not a reuse of
`search_events`), order creation, order lookup, and the 11 static reference
lists (`static_data`, also dispatched via `searchMethod`).

Every endpoint requires the full `user_id`/`user_password`/`access`/
`ip_address` block. Same sandbox account as the flight API
(`travelnext.py`) — only the product base URL differs — so credentials are
read from the same `TRAVELNEXT_*` env vars.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime
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

TRAVELNEXT_EVENTS_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_EVENTS_API_BASE_URL") or "https://travelnext.works/api/event-api"
).rstrip("/")

_travelnext_events_breaker = CircuitBreaker(name="travelnext_events", failure_threshold=5, recovery_timeout=60.0)

# Static reference data rarely changes (provider recommends monthly refresh)
# — cached per (searchMethod, id-param value) so parameterized lookups
# (cities-by-country, stadiums-by-city, ...) don't collide with each other.
_static_cache: dict[str, Any] = {}


def has_travelnext_events_credentials() -> bool:
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
    if not has_travelnext_events_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_EVENTS_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext Events {path}",
            )
            if response.status_code >= 400:
                logger.error("TravelNext Events %s returned %s: %s", path, response.status_code, response.text[:500])
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                if data.get("error"):
                    raise RuntimeError(f"TravelNext Events {path} error: {data['error']}")
                errors = data.get("Errors")
                if isinstance(errors, dict) and errors.get("ErrorMessage"):
                    code = str(errors.get("ErrorCode") or "")
                    msg = str(errors.get("ErrorMessage") or "")
                    # FLERAUTH006 with a matching egress IP means this sandbox
                    # account is not entitled for the Events product (flights/
                    # cars/hotels work with the same credentials).
                    if code == "FLERAUTH006":
                        logger.warning(
                            "TravelNext Events auth rejected (%s): %s — "
                            "Events product may not be enabled on this account",
                            code,
                            msg,
                        )
                        return {"data": [], "Errors": errors}
                    raise RuntimeError(f"TravelNext Events {path} error: {code} {msg}")
            return data

    return await _travelnext_events_breaker.call(_call)


# --------------------------------------------------------------------------
# Event search — one endpoint, dispatched by searchMethod
# --------------------------------------------------------------------------

async def search_events(
    search_method: str,
    *,
    currency: str = "USD",
    per_page: str = "20",
    current_page: str = "1",
    **extra: Any,
) -> dict:
    body: dict[str, Any] = {
        **_auth_block(),
        "searchMethod": search_method,
        "currency": currency,
        "perPage": per_page,
        "currentPage": current_page,
    }
    body.update({k: v for k, v in extra.items() if v is not None})
    return await _post("search_events", body, timeout=30.0)


async def search_by_country(
    country_id: str, country_name: str, *, currency: str = "USD", per_page: str = "20", current_page: str = "1"
) -> dict:
    return await search_events(
        "countryName",
        currency=currency,
        per_page=per_page,
        current_page=current_page,
        countryId=country_id,
        countryName=country_name,
    )


async def search_by_city(
    city_id: str, city_name: str, *, currency: str = "USD", per_page: str = "20", current_page: str = "1"
) -> dict:
    return await search_events(
        "cityName",
        currency=currency,
        per_page=per_page,
        current_page=current_page,
        cityId=city_id,
        cityName=city_name,
    )


async def search_top_teams(
    team_id: str, *, currency: str = "USD", per_page: str = "20", current_page: str = "1"
) -> dict:
    return await search_events(
        "getTopTeams", currency=currency, per_page=per_page, current_page=current_page, teamId=team_id
    )


async def search_top_football(
    tournament_id: str, *, currency: str = "USD", per_page: str = "20", current_page: str = "1"
) -> dict:
    return await search_events(
        "getTopFootball",
        currency=currency,
        per_page=per_page,
        current_page=current_page,
        tournamentId=tournament_id,
    )


async def search_usa_events(
    team_id: str, *, currency: str = "USD", per_page: str = "20", current_page: str = "1"
) -> dict:
    return await search_events(
        "getUsaEvents", currency=currency, per_page=per_page, current_page=current_page, teamId=team_id
    )


async def search_top_cities(
    city_id: str, *, currency: str = "USD", per_page: str = "20", current_page: str = "1"
) -> dict:
    return await search_events(
        "getTopCities", currency=currency, per_page=per_page, current_page=current_page, cityId=city_id
    )


async def search_music_and_shows(
    artist_id: str, *, currency: str = "USD", per_page: str = "20", current_page: str = "1"
) -> dict:
    return await search_events(
        "getMusicAndShows",
        currency=currency,
        per_page=per_page,
        current_page=current_page,
        artistId=artist_id,
    )


async def search_tournament(
    tournament_id: str,
    *,
    currency: str = "USD",
    per_page: str = "20",
    current_page: str = "1",
    from_date: Optional[str] = None,
    until_date: Optional[str] = None,
) -> dict:
    return await search_events(
        "getTournaments",
        currency=currency,
        per_page=per_page,
        current_page=current_page,
        tournamentId=tournament_id,
        **({"from": from_date} if from_date else {}),
        **({"until": until_date} if until_date else {}),
    )


# --------------------------------------------------------------------------
# Ticket search — its own endpoint (not search_events)
# --------------------------------------------------------------------------

async def get_ticket_details(event_id: str, session_id: str, *, currency: str = "USD") -> dict:
    body = {
        **_auth_block(),
        "eventId": event_id,
        "session_id": session_id,
        "currency": currency,
    }
    return await _post("ticket_details", body, timeout=30.0)


# --------------------------------------------------------------------------
# Booking
# --------------------------------------------------------------------------

async def create_order(
    session_id: str,
    email: str,
    phone: str,
    shipping_address: str,
    ticket_id: str,
    ticket_qty: str,
    event_id: str,
    prov_ship_id: str,
    attendee_details: list[dict],
) -> dict:
    body = {
        **_auth_block(),
        "session_id": session_id,
        "email": email,
        "phone": phone,
        "shippingAddress": shipping_address,
        "ticketId": ticket_id,
        "ticketQty": ticket_qty,
        "eventId": event_id,
        "provShipid": prov_ship_id,
        "attendeeDetails": attendee_details,
    }
    return await _post("create_order", body, timeout=60.0)


async def get_booking_details(confirmation_num: str, reference_num: str) -> dict:
    body = {
        **_auth_block(),
        "ConfirmationNum": confirmation_num,
        "referenceNum": reference_num,
    }
    return await _post("booking_details", body)


# --------------------------------------------------------------------------
# Static reference data
# --------------------------------------------------------------------------

async def _get_static(
    search_method: str,
    *,
    id_param: Optional[str] = None,
    id_value: Optional[str] = None,
    response_key: str,
    force_refresh: bool = False,
) -> Any:
    cache_key = f"{search_method}:{id_value or ''}"
    if not force_refresh and cache_key in _static_cache:
        return _static_cache[cache_key]

    body = {**_auth_block(), "searchMethod": search_method}
    if id_param and id_value is not None:
        body[id_param] = id_value

    data = await _post("static_data", body)
    result = data.get(response_key, data) if isinstance(data, dict) else data
    _static_cache[cache_key] = result
    return result


async def get_countries(force_refresh: bool = False) -> list[dict]:
    return await _get_static("getCountries", response_key="countries", force_refresh=force_refresh)


async def get_sports(force_refresh: bool = False) -> list[dict]:
    return await _get_static("getSports", response_key="sportTypes", force_refresh=force_refresh)


async def get_cities(country_id: str, force_refresh: bool = False) -> list[dict]:
    return await _get_static(
        "getCities", id_param="countryId", id_value=country_id, response_key="cities", force_refresh=force_refresh
    )


async def get_stadiums(city_id: str, force_refresh: bool = False) -> list[dict]:
    return await _get_static(
        "getStadiums", id_param="cityId", id_value=city_id, response_key="stadiums", force_refresh=force_refresh
    )


async def get_tournaments(sport_type_id: str, force_refresh: bool = False) -> list[dict]:
    return await _get_static(
        "getTournaments",
        id_param="sportTypeId",
        id_value=sport_type_id,
        response_key="tournaments",
        force_refresh=force_refresh,
    )


async def get_competitors(sport_type_id: str, force_refresh: bool = False) -> list[dict]:
    return await _get_static(
        "getCompetitors",
        id_param="sportTypeId",
        id_value=sport_type_id,
        response_key="competitors",
        force_refresh=force_refresh,
    )


async def get_top_teams(force_refresh: bool = False) -> list[dict]:
    return await _get_static("getTopTeams", response_key="topTeams", force_refresh=force_refresh)


async def get_top_football(force_refresh: bool = False) -> list[dict]:
    return await _get_static("getTopFootball", response_key="topFootball", force_refresh=force_refresh)


async def get_top_cities(force_refresh: bool = False) -> list[dict]:
    return await _get_static("getTopCities", response_key="top_cities", force_refresh=force_refresh)


async def get_usa_events_static(force_refresh: bool = False) -> list[dict]:
    return await _get_static("getUsaEvents", response_key="topUsaEvents", force_refresh=force_refresh)


async def get_music_and_shows_static(force_refresh: bool = False) -> list[dict]:
    return await _get_static("getMusicAndShows", response_key="topMusicShows", force_refresh=force_refresh)


# --------------------------------------------------------------------------
# Inventory mapping (unified /inventory/search)
# --------------------------------------------------------------------------

_CITY_ALIASES = {
    "new york": ("new york", "nyc"),
    "nyc": ("new york", "nyc"),
    "los angeles": ("los angeles", "la"),
    "london": ("london",),
    "paris": ("paris",),
    "amsterdam": ("amsterdam",),
    "madrid": ("madrid",),
    "barcelona": ("barcelona",),
    "rome": ("rome", "roma"),
    "milan": ("milan", "milano"),
    "berlin": ("berlin",),
    "munich": ("munich", "muenchen", "münchen"),
    "dubai": ("dubai",),
    "tokyo": ("tokyo",),
    "singapore": ("singapore",),
    "bangkok": ("bangkok",),
    "delhi": ("delhi", "new delhi"),
    "mumbai": ("mumbai", "bombay"),
}


def _normalize_place(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def _event_rows(response: Any) -> list[dict]:
    if not isinstance(response, dict):
        return []
    if response.get("Errors"):
        logger.warning("TravelNext Events API error: %s", response.get("Errors"))
        return []
    data = response.get("data") or response.get("events") or response.get("results") or []
    return [row for row in data if isinstance(row, dict)] if isinstance(data, list) else []


def _price(value: Any) -> Optional[float]:
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount > 0 else None


async def resolve_event_city(location: str) -> Optional[dict]:
    """Best-effort match against TravelNext Events top cities / country cities."""
    if not location:
        return None
    needle = _normalize_place(location.split(",")[0])
    if not needle:
        return None
    aliases = {_normalize_place(a) for a in _CITY_ALIASES.get(location.split(",")[0].strip().lower(), ())}
    aliases.add(needle)

    try:
        top_cities = await get_top_cities()
    except Exception as exc:
        logger.warning("TravelNext Events top cities unavailable: %s", exc)
        top_cities = []

    candidates = top_cities if isinstance(top_cities, list) else []
    for city in candidates:
        if not isinstance(city, dict):
            continue
        name = _normalize_place(str(city.get("cityName") or city.get("name") or city.get("city") or ""))
        city_id = str(city.get("cityId") or city.get("id") or "")
        if name in aliases or any(a in name for a in aliases if len(a) >= 4):
            return {
                "cityId": city_id,
                "cityName": city.get("cityName") or city.get("name") or city.get("city") or location,
            }

    # Fall back to country → cities scan for a few common countries.
    country_guesses = [
        ("1002", "Spain"),
        ("1033", "United Kingdom"),
        ("1081", "United States"),
        ("1075", "France"),
        ("1054", "Italy"),
        ("1039", "Netherlands"),
        ("1042", "Germany"),
        ("1055", "India"),
    ]
    for country_id, country_name in country_guesses:
        try:
            cities = await get_cities(country_id)
        except Exception:
            continue
        if not isinstance(cities, list):
            continue
        for city in cities:
            if not isinstance(city, dict):
                continue
            name = _normalize_place(str(city.get("cityName") or city.get("name") or city.get("city") or ""))
            if name in aliases or any(a in name for a in aliases if len(a) >= 4):
                return {
                    "cityId": str(city.get("cityId") or city.get("id") or ""),
                    "cityName": city.get("cityName") or city.get("name") or city.get("city") or location,
                    "countryId": country_id,
                    "countryName": country_name,
                }
    return None


async def search_events_inventory(
    location: Optional[str], budget: Optional[str], date: Optional[str] = None
) -> list[InventoryItem]:
    """Inventory-shaped event tickets for /inventory/search?type=event."""
    del budget
    if not (has_travelnext_events_credentials() and location):
        return []

    city = await resolve_event_city(location)
    try:
        if city and city.get("cityId"):
            response = await search_by_city(str(city["cityId"]), str(city["cityName"]))
        else:
            # Last resort: country-level search when we can infer a country name.
            country = location.split(",")[-1].strip() if "," in location else location.strip()
            response = await search_by_country("", country)
    except CircuitBreakerOpen:
        logger.warning("TravelNext Events search skipped — circuit breaker open")
        return []
    except Exception as exc:
        logger.error("TravelNext Events search failed: %s", exc)
        return []

    rows = _event_rows(response)
    session_id = None
    if isinstance(response, dict):
        session_id = response.get("session_id") or response.get("sessionId") or (response.get("controll") or {}).get(
            "session_id"
        )

    # Optional date filter (YYYY-MM-DD) when the UI passes a trip day.
    want_date = None
    if date:
        try:
            want_date = datetime.strptime(date[:10], "%Y-%m-%d").date()
        except ValueError:
            want_date = None

    results: list[InventoryItem] = []
    for row in rows:
        event_id = str(row.get("eventId") or row.get("id") or "")
        if not event_id:
            continue
        title = str(
            row.get("eventName")
            or row.get("name")
            or row.get("title")
            or row.get("tournamentName")
            or "Event"
        ).strip()
        price = (
            _price(row.get("minPrice"))
            or _price(row.get("price"))
            or _price(row.get("ticketPrice"))
            or _price((row.get("priceRange") or {}).get("min") if isinstance(row.get("priceRange"), dict) else None)
            or 0.0
        )
        currency = str(row.get("currency") or row.get("currencyCode") or "USD")
        image = row.get("image") or row.get("imageUrl") or row.get("eventImage") or row.get("thumbnail")
        event_date = row.get("eventDate") or row.get("date") or row.get("startDate")
        event_time = row.get("eventTime") or row.get("time") or row.get("startTime")
        venue = row.get("venueName") or row.get("stadiumName") or row.get("venue") or row.get("location")

        if want_date and event_date:
            try:
                raw = str(event_date)[:10]
                parsed = datetime.strptime(raw, "%Y-%m-%d").date()
                # Keep events within ±14 days of the requested date.
                if abs((parsed - want_date).days) > 14:
                    continue
            except ValueError:
                pass

        results.append(
            InventoryItem(
                id=event_id,
                type="event",
                provider="travelnext",
                title=title,
                price=float(price),
                currency=currency,
                deep_link="",
                start_time=str(event_time)[:5] if event_time else None,
                image_url=str(image) if image else None,
                details={
                    "eventId": event_id,
                    "sessionId": session_id,
                    "venue": venue,
                    "location": venue or (city or {}).get("cityName") or location,
                    "event_date": event_date,
                    "event_time": event_time,
                    "category": row.get("category") or row.get("sportType") or row.get("eventType"),
                    "tournament": row.get("tournamentName") or row.get("tournament"),
                    "city": (city or {}).get("cityName") or location,
                    "bookable": True,
                    "attraction_type": "events",
                },
            )
        )

    results.sort(key=lambda item: item.price)
    return results[:20]
