"""TravelNext Activities (activitiesv2-test) API adapter.

Covers activity search, activity details, booking, booking lookup, and
inventory mapping for `/inventory/search?type=activity`.
"""

from __future__ import annotations

import asyncio
import logging
import os
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
from shared.airports import airport_code_for_place
from app.adapters.providers.tripadvisor import resolve_coordinates
from app.schemas.inventory import InventoryItem

logger = logging.getLogger(__name__)

TRAVELNEXT_ACTIVITIES_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_ACTIVITIES_API_BASE_URL")
    or "https://travelnext.works/api/activitiesv2-test"
).rstrip("/")

_travelnext_activities_breaker = CircuitBreaker(
    name="travelnext_activities",
    failure_threshold=5,
    recovery_timeout=60.0,
)


def has_travelnext_activities_credentials() -> bool:
    return has_travelnext_credentials()


def _auth_block() -> dict[str, Any]:
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


async def _post(path: str, body: dict[str, Any], *, timeout: float = 20.0) -> Any:
    if not has_travelnext_activities_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_ACTIVITIES_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext Activities {path}",
            )
            if response.status_code >= 400:
                logger.error(
                    "TravelNext Activities %s returned %s: %s",
                    path,
                    response.status_code,
                    response.text[:500],
                )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(f"TravelNext Activities {path} error: {data['error']}")
            return data

    return await _travelnext_activities_breaker.call(_call)


def _default_window(date: Optional[str]) -> tuple[str, str]:
    if date:
        try:
            start = datetime.strptime(date[:10], "%Y-%m-%d").date()
        except ValueError:
            start = datetime.now(timezone.utc).date() + timedelta(days=1)
    else:
        start = datetime.now(timezone.utc).date() + timedelta(days=1)
    end = start + timedelta(days=2)
    return start.isoformat(), end.isoformat()


def _rows(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [row for row in response if isinstance(row, dict)]
    if not isinstance(response, dict):
        return []
    for key in ("data", "results", "activities", "ActivitySearchResult"):
        value = response.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            nested = value.get("activities") or value.get("data") or value.get("results")
            if isinstance(nested, list):
                return [row for row in nested if isinstance(row, dict)]
    return []


def _price(value: Any) -> Optional[float]:
    if isinstance(value, dict):
        for key in ("Amount", "amount", "price", "value", "adultPrice", "AdultPrice"):
            if key in value:
                return _price(value.get(key))
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount >= 0 else None


def _activity_price(row: dict[str, Any]) -> Optional[float]:
    for key in ("price", "amount", "adultPrice", "startingPrice", "minPrice", "fromPrice"):
        price = _price(row.get(key))
        if price is not None:
            return price
    if isinstance(row.get("pricing"), dict):
        price = _price(row["pricing"])
        if price is not None:
            return price
    # Live Activity V2 shape: options[].rates[].totalFares.amount
    options = row.get("options")
    if isinstance(options, list):
        best: Optional[float] = None
        for option in options:
            if not isinstance(option, dict):
                continue
            rates = option.get("rates")
            if not isinstance(rates, list):
                continue
            for rate in rates:
                if not isinstance(rate, dict):
                    continue
                amount = _price(rate.get("totalFares") or rate.get("amount") or rate.get("price"))
                if amount is None:
                    continue
                best = amount if best is None else min(best, amount)
        if best is not None:
            return best
    return None


def _activity_option_code(row: dict[str, Any]) -> str:
    if row.get("optionCode") or row.get("OptionCode"):
        return str(row.get("optionCode") or row.get("OptionCode") or "")
    options = row.get("options")
    if isinstance(options, list) and options and isinstance(options[0], dict):
        return str(options[0].get("code") or options[0].get("optionCode") or "")
    return ""


def _activity_image(row: dict[str, Any]) -> Optional[str]:
    image = row.get("image") or row.get("imageUrl") or row.get("thumbnail")
    if isinstance(image, str) and image:
        return image
    content = row.get("content")
    if isinstance(content, dict):
        media = content.get("media")
        if isinstance(media, dict):
            images = media.get("images")
            if isinstance(images, list) and images:
                first = images[0]
                if isinstance(first, str) and first:
                    return first
                if isinstance(first, dict):
                    for key in ("url", "image", "src"):
                        if isinstance(first.get(key), str) and first.get(key):
                            return str(first[key])
    return None


def _activity_currency(row: dict[str, Any]) -> str:
    for key in ("currency", "currencyCode"):
        if isinstance(row.get(key), str) and row.get(key):
            return str(row[key])
    options = row.get("options")
    if isinstance(options, list):
        for option in options:
            if not isinstance(option, dict):
                continue
            rates = option.get("rates")
            if not isinstance(rates, list):
                continue
            for rate in rates:
                if not isinstance(rate, dict):
                    continue
                fares = rate.get("totalFares")
                if isinstance(fares, dict) and isinstance(fares.get("currency"), str):
                    return str(fares["currency"])
                if isinstance(rate.get("currency"), str):
                    return str(rate["currency"])
    return "USD"


def _time_hhmm(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value:
        return None
    text = value.split("T", 1)[1] if "T" in value else value
    text = text[:5]
    return text if len(text) == 5 else None


def _session_id(response: Any) -> Optional[str]:
    if not isinstance(response, dict):
        return None
    for key in ("session_id", "sessionId", "SessionId"):
        if response.get(key):
            return str(response[key])
    return None


def _budget_match(price: float, budget: Optional[str]) -> bool:
    if not budget:
        return True
    key = budget.strip().lower()
    if key in {"low", "budget"}:
        return price <= 75
    if key in {"mid", "medium"}:
        return 40 <= price <= 200
    if key in {"high", "luxury"}:
        return price >= 120
    return True


async def search_activities(
    *,
    city_code: Optional[str] = None,
    hotel_code: Optional[str] = None,
    geo_code: Optional[dict[str, str]] = None,
    adults: int = 2,
    children: int = 0,
    child_ages: Optional[list[int]] = None,
    currency: str = "USD",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    language: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
) -> dict:
    """TravelNext Activities search.

    Live sandbox quirks (verified 2026-07-21):
    - location: ``city_code`` / ``hotel_code`` / ``geo_code`` (snake_case)
    - passengers: nested ``paxes{{adults,children,child_ages}}`` (not top-level Adults)
    - money: lowercase ``currency`` (PascalCase ``Currency`` is rejected as invalid)
    - dates: ``from_date`` / ``to_date`` (snake_case, yyyy-mm-dd)
    """
    body: dict[str, Any] = {
        **_auth_block(),
        "paxes": {
            "adults": int(adults),
            "children": int(children),
            "child_ages": child_ages or [],
        },
        "currency": currency,
    }
    if city_code:
        body["city_code"] = city_code
    if hotel_code:
        body["hotel_code"] = hotel_code
    if geo_code:
        body["geo_code"] = geo_code
    if from_date:
        body["from_date"] = from_date
    if to_date:
        body["to_date"] = to_date
    if language:
        body["Language"] = language
    if price_min is not None:
        body["price_min"] = price_min
    if price_max is not None:
        body["price_max"] = price_max
    return await _post("search", body, timeout=30.0)


async def get_activity_details(session_id: str, activity_code: str, option_code: str) -> dict:
    return await _post(
        "details",
        {
            "sessionId": session_id,
            "activityCode": activity_code,
            "optionCode": option_code,
        },
        timeout=30.0,
    )


async def create_booking(
    session_id: str,
    client_reference: str,
    lead_passenger: dict[str, Any],
    activities: list[dict[str, Any]],
) -> dict:
    return await _post(
        "bookings",
        {
            "sessionId": session_id,
            "clientReference": client_reference,
            "leadPassenger": lead_passenger,
            "activities": activities,
        },
        timeout=60.0,
    )


async def get_booking_details(confirmation_id: str) -> dict:
    return await _post("bookings/details", {**_auth_block(), "confirmationId": confirmation_id}, timeout=30.0)


async def search_activities_inventory(
    location: Optional[str],
    budget: Optional[str],
    *,
    date: Optional[str] = None,
) -> list[InventoryItem]:
    if not (has_travelnext_activities_credentials() and location):
        return []

    from_date, to_date = _default_window(date)
    # TravelNext Activities expects a city/hotel/geo *code* — lat/lng alone is
    # rejected ("Invalid code is supplied"). Prefer IATA city codes (Dubai→DXB).
    city_code = airport_code_for_place(location.split(",")[0].strip())
    geo_code: Optional[dict[str, str]] = None
    if not city_code:
        coords = await resolve_coordinates(location)
        if coords is None:
            return []
        geo_code = {"latitude": str(coords[0]), "longitude": str(coords[1])}

    try:
        response = await search_activities(
            city_code=city_code,
            geo_code=geo_code,
            adults=2,
            from_date=from_date,
            to_date=to_date,
        )
    except CircuitBreakerOpen:
        logger.warning("TravelNext Activities search skipped — circuit breaker open")
        return []
    except Exception as exc:
        # Retry once with geo if city-code search was rejected as invalid.
        if city_code:
            coords = await resolve_coordinates(location)
            if coords is not None:
                try:
                    response = await search_activities(
                        geo_code={"latitude": str(coords[0]), "longitude": str(coords[1])},
                        adults=2,
                        from_date=from_date,
                        to_date=to_date,
                    )
                except Exception as geo_exc:
                    logger.error("TravelNext Activities search failed: %s", geo_exc)
                    return []
            else:
                logger.error("TravelNext Activities search failed: %s", exc)
                return []
        else:
            logger.error("TravelNext Activities search failed: %s", exc)
            return []

    session_id = _session_id(response)
    results: list[InventoryItem] = []
    for row in _rows(response):
        try:
            activity_id = str(
                row.get("activityCode")
                or row.get("id")
                or row.get("code")
                or row.get("ActivityCode")
                or ""
            )
            option_code = _activity_option_code(row)
            if not activity_id:
                continue
            price = _activity_price(row)
            if price is None or not _budget_match(price, budget):
                continue

            title = str(
                row.get("activityName")
                or row.get("title")
                or row.get("name")
                or row.get("ActivityName")
                or "Activity"
            ).strip()
            image = _activity_image(row)

            results.append(
                InventoryItem(
                    id=activity_id,
                    type="activity",
                    provider="travelnext",
                    title=title,
                    price=price,
                    currency=_activity_currency(row),
                    deep_link="",
                    start_time=_time_hhmm(row.get("startTime") or row.get("activityTime")),
                    duration=str(row.get("duration")) if row.get("duration") else None,
                    image_url=str(image) if image else None,
                    details={
                        "sessionId": session_id,
                        "activityCode": activity_id,
                        "optionCode": option_code or None,
                        "location": row.get("location") or location,
                        "address": row.get("address") or location,
                        "description": row.get("description") or row.get("shortDescription"),
                        "rating": row.get("rating"),
                        "category": row.get("category") or row.get("type"),
                        "bookable": True,
                    },
                )
            )
        except Exception as exc:
            logger.error("Error parsing TravelNext Activities result: %s", exc)
            continue

    results.sort(key=lambda item: item.price)
    return results[:20]
