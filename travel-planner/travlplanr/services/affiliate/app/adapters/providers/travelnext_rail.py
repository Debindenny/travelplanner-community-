"""TravelNext Rail (rail-testv2) API adapter.

Covers the surface needed by the new rail router plus `/inventory/search`:
availability search, session revalidation, fare rules, booking, ticketing,
trip details, and inventory mapping for train searches.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
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

TRAVELNEXT_RAIL_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_RAIL_API_BASE_URL")
    or "https://travelnext.works/api/rail-testv2"
).rstrip("/")

_travelnext_rail_breaker = CircuitBreaker(
    name="travelnext_rail",
    failure_threshold=5,
    recovery_timeout=60.0,
)


def has_travelnext_rail_credentials() -> bool:
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
    if not has_travelnext_rail_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_RAIL_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext Rail {path}",
            )
            if response.status_code >= 400:
                logger.error(
                    "TravelNext Rail %s returned %s: %s",
                    path,
                    response.status_code,
                    response.text[:500],
                )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                if data.get("error"):
                    raise RuntimeError(f"TravelNext Rail {path} error: {data['error']}")
                errors = data.get("Errors")
                if isinstance(errors, dict) and errors.get("ErrorMessage"):
                    msg = str(errors.get("ErrorMessage") or "")
                    # Empty catalog responses are normal for this sandbox.
                    if "No Result Found" in msg:
                        return {"TrainSearchResponse": {"TrainSearchResult": {"FareItineraries": []}}}
                    raise RuntimeError(
                        f"TravelNext Rail {path} error: {errors.get('ErrorCode')} {msg}"
                    )
            return data

    return await _travelnext_rail_breaker.call(_call)


_stations_cache: list[dict] | None = None


def _normalize_place(text: str) -> str:
    return "".join(ch for ch in (text or "").lower() if ch.isalnum())


async def get_stations(force_refresh: bool = False) -> list[dict]:
    global _stations_cache
    if _stations_cache is not None and not force_refresh:
        return _stations_cache
    data = await _post("destination", _auth_block(), timeout=30.0)
    if isinstance(data, list):
        _stations_cache = [row for row in data if isinstance(row, dict)]
    elif isinstance(data, dict):
        _stations_cache = [
            row for row in (data.get("destinations") or data.get("stations") or data.get("data") or []) if isinstance(row, dict)
        ]
    else:
        _stations_cache = []
    return _stations_cache


async def resolve_station_code(place: Optional[str]) -> Optional[str]:
    if not place:
        return None
    raw = place.strip()
    if len(raw) <= 4 and raw.isalpha():
        return raw.upper()
    needle = _normalize_place(raw.split(",")[0])
    try:
        stations = await get_stations()
    except Exception as exc:
        logger.warning("TravelNext Rail stations unavailable: %s", exc)
        return raw.upper() if len(raw) <= 4 else None
    exact: Optional[str] = None
    partial: Optional[str] = None
    for row in stations:
        code = str(row.get("Code") or row.get("code") or "").upper()
        city = _normalize_place(str(row.get("City") or row.get("city") or row.get("name") or ""))
        if not code:
            continue
        if city == needle:
            exact = code
            break
        if needle and (needle in city or city in needle) and partial is None:
            partial = code
    return exact or partial


async def search_availability(
    origin_destination_info: list[dict[str, Any]],
    *,
    adults: int = 1,
    childs: int = 0,
    infants: int = 0,
    cabin_class: str = "Economy",
    required_currency: str = "EUR",
) -> dict:
    body = {
        **_auth_block(),
        "OriginDestinationInfo": origin_destination_info,
        "adults": adults,
        "childs": childs,
        "infants": infants,
        "class": cabin_class,
        "requiredCurrency": required_currency,
    }
    return await _post("availability", body, timeout=30.0)


async def revalidate(session_id: str, fare_source_code: str) -> dict:
    return await _post(
        "revalidate",
        {"session_id": session_id, "fare_source_code": fare_source_code},
        timeout=30.0,
    )


async def get_fare_rules(session_id: str, fare_source_code: str) -> dict:
    return await _post(
        "fare_rules",
        {"session_id": session_id, "fare_source_code": fare_source_code},
        timeout=30.0,
    )


async def create_booking(booking_info: dict[str, Any], pax_info: dict[str, Any]) -> dict:
    body = {
        "bookingInfo": booking_info,
        "paxInfo": pax_info,
    }
    return await _post("booking", body, timeout=60.0)


async def issue_ticket(unique_id: str) -> dict:
    return await _post("ticket_order", {**_auth_block(), "UniqueID": unique_id}, timeout=60.0)


async def get_trip_details(unique_id: str) -> dict:
    return await _post("trip_details", {**_auth_block(), "UniqueID": unique_id}, timeout=30.0)


def _default_departure_date(date: Optional[str]) -> str:
    if date:
        try:
            return datetime.strptime(date[:10], "%Y-%m-%d").date().isoformat()
        except ValueError:
            pass
    return (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()


def _price(value: Any) -> Optional[float]:
    if isinstance(value, dict):
        for key in ("Amount", "amount", "price", "value", "total", "totalAmount", "TotalFare"):
            if key in value:
                return _price(value.get(key))
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount >= 0 else None


def _train_rows(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [row for row in response if isinstance(row, dict)]
    if not isinstance(response, dict):
        return []

    # Common envelope: TrainSearchResponse.TrainSearchResult.FareItineraries[].FareItinerary
    root = response.get("TrainSearchResponse") if isinstance(response.get("TrainSearchResponse"), dict) else response
    result = root.get("TrainSearchResult") if isinstance(root.get("TrainSearchResult"), dict) else root
    fare_itineraries = result.get("FareItineraries") if isinstance(result, dict) else None
    if isinstance(fare_itineraries, list):
        rows: list[dict[str, Any]] = []
        for entry in fare_itineraries:
            if not isinstance(entry, dict):
                continue
            itinerary = entry.get("FareItinerary") if isinstance(entry.get("FareItinerary"), dict) else entry
            if isinstance(itinerary, dict):
                rows.append(itinerary)
        if rows:
            return rows

    for key in ("data", "results", "trains", "TrainResults", "RailSearchResult"):
        value = response.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            nested = value.get("trains") or value.get("data") or value.get("results")
            if isinstance(nested, list):
                return [row for row in nested if isinstance(row, dict)]
    return []


def _session_id(response: Any) -> Optional[str]:
    if not isinstance(response, dict):
        return None
    for key in ("session_id", "sessionId", "SessionId"):
        if response.get(key):
            return str(response[key])
    nested = response.get("TrainSearchResponse")
    if isinstance(nested, dict):
        for key in ("session_id", "sessionId", "SessionId"):
            if nested.get(key):
                return str(nested[key])
    return None


def _time_hhmm(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value:
        return None
    text = value.split("T", 1)[1] if "T" in value else value
    text = text[:5]
    return text if len(text) == 5 else None


def _format_duration(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        hours, mins = divmod(int(value), 60)
        return f"{hours}h {mins}m" if mins else f"{hours}h"
    return str(value)


def _budget_match(price: float, budget: Optional[str]) -> bool:
    if not budget:
        return True
    key = budget.strip().lower()
    if key in {"low", "budget"}:
        return price <= 100
    if key in {"mid", "medium"}:
        return 50 <= price <= 250
    if key in {"high", "luxury"}:
        return price >= 150
    return True


def _itinerary_price(row: dict[str, Any]) -> Optional[float]:
    fare_info = row.get("ItineraryFareInfo") or row.get("AirItineraryPricingInfo") or {}
    if isinstance(fare_info, dict):
        totals = fare_info.get("ItinTotalFares") or fare_info.get("ItinTotalFare") or {}
        if isinstance(totals, dict):
            for key in ("TotalFare", "EquivFare", "BaseFare"):
                price = _price(totals.get(key))
                if price is not None:
                    return price
        price = _price(fare_info.get("TotalFare") or fare_info.get("total"))
        if price is not None:
            return price
    for key in ("price", "amount", "total", "totalFare", "fare", "minPrice"):
        price = _price(row.get(key))
        if price is not None:
            return price
    if isinstance(row.get("pricing"), dict):
        return _price(row["pricing"])
    return None


def _fare_source_code(row: dict[str, Any]) -> Optional[str]:
    fare_info = row.get("ItineraryFareInfo")
    if isinstance(fare_info, dict) and fare_info.get("FareSourceCode"):
        return str(fare_info["FareSourceCode"])
    return str(row.get("fareSourceCode") or row.get("FareSourceCode") or row.get("referenceId") or "") or None


async def search_trains(
    dep: Optional[str],
    arr: Optional[str],
    date: Optional[str],
    budget: Optional[str],
) -> list[InventoryItem]:
    if not (has_travelnext_rail_credentials() and dep and arr):
        return []

    origin = await resolve_station_code(dep)
    destination = await resolve_station_code(arr)
    if not origin or not destination:
        logger.info("TravelNext Rail: could not resolve stations for %s → %s", dep, arr)
        return []

    try:
        response = await search_availability(
            [
                {
                    "departureDate": _default_departure_date(date),
                    "originCode": origin,
                    "destinationCode": destination,
                }
            ]
        )
    except CircuitBreakerOpen:
        logger.warning("TravelNext Rail search skipped — circuit breaker open")
        return []
    except Exception as exc:
        # "No Result Found" is a normal empty response from the sandbox catalog.
        if "No Result Found" in str(exc):
            return []
        logger.error("TravelNext Rail search failed: %s", exc)
        return []

    session_id = _session_id(response)
    results: list[InventoryItem] = []
    for row in _train_rows(response):
        try:
            fare_source = _fare_source_code(row)
            train_id = str(
                fare_source
                or row.get("id")
                or row.get("trainId")
                or row.get("referenceId")
                or uuid.uuid4()
            )
            price = _itinerary_price(row)
            if price is None or not _budget_match(price, budget):
                continue

            carrier = str(
                row.get("operatorName")
                or row.get("carrier")
                or row.get("trainName")
                or row.get("ValidatingAirlineCode")
                or row.get("providerName")
                or "Train"
            ).strip()
            train_no = str(row.get("trainNumber") or row.get("number") or "").strip()
            title = f"{carrier} {train_no} {origin} → {destination}".strip()

            results.append(
                InventoryItem(
                    id=train_id,
                    type="train",
                    provider="travelnext",
                    title=title,
                    price=price,
                    currency=str(
                        (
                            (
                                (row.get("ItineraryFareInfo") or {}).get("ItinTotalFares") or {}
                            ).get("TotalFare")
                            or {}
                        ).get("CurrencyCode")
                        or row.get("currency")
                        or row.get("currencyCode")
                        or (response.get("currency") if isinstance(response, dict) else None)
                        or "EUR"
                    ),
                    deep_link="",
                    start_time=_time_hhmm(
                        row.get("departureTime")
                        or row.get("DepartureDateTime")
                        or row.get("depart_at")
                    ),
                    end_time=_time_hhmm(
                        row.get("arrivalTime")
                        or row.get("ArrivalDateTime")
                        or row.get("arrive_at")
                    ),
                    duration=_format_duration(row.get("duration") or row.get("journeyDuration")),
                    image_url=row.get("image") or row.get("imageUrl"),
                    details={
                        "sessionId": session_id,
                        "fareSourceCode": fare_source,
                        "operator": carrier,
                        "train_number": train_no or None,
                        "origin": origin,
                        "destination": destination,
                        "departure_date": row.get("departureDate") or _default_departure_date(date),
                        "bookingInfo": row.get("bookingInfo"),
                        "class": row.get("class") or row.get("cabinClass") or "Economy",
                        "bookable": True,
                    },
                )
            )
        except Exception as exc:
            logger.error("Error parsing TravelNext Rail result: %s", exc)
            continue

    results.sort(key=lambda item: item.price)
    return results[:20]
