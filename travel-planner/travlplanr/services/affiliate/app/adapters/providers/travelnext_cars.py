"""TravelNext Cars (carsv3) API adapter.

Covers the full documented surface: languages, destinations (reference data,
cached in-process), availability search, rental conditions & details, car
insurance, booking, cancel, and booking details.

`rental_condition_details`, `car_insurance`, and `car_book` are session/
reference-scoped (`session_id`/`reference_id`, no auth block) — the rest
(`languages`, `destinations`, `search`, `cancel_booking`, `booking_details`)
require the full `user_id`/`user_password`/`access`/`ip_address` block,
confirmed against the provider's own API console examples. Same sandbox
account as the flight API (`travelnext.py`) — only the product base URL
differs — so credentials are read from the same `TRAVELNEXT_*` env vars.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from shared.circuit_breaker import CircuitBreaker, CircuitBreakerOpen

from app.schemas.inventory import InventoryItem
from app.adapters.providers.travelnext import (
    TRAVELNEXT_ACCESS,
    TRAVELNEXT_USER_ID,
    TRAVELNEXT_USER_PASSWORD,
    get_travelnext_ip,
    has_travelnext_credentials,
)

logger = logging.getLogger(__name__)

TRAVELNEXT_CARS_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_CARS_API_BASE_URL") or "https://travelnext.works/api/carsv3-test"
).rstrip("/")

_travelnext_cars_breaker = CircuitBreaker(name="travelnext_cars", failure_threshold=5, recovery_timeout=60.0)

_destinations_cache: list[dict] | None = None


def has_travelnext_cars_credentials() -> bool:
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
    if not has_travelnext_cars_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_CARS_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext Cars {path}",
            )
            if response.status_code >= 400:
                logger.error("TravelNext Cars %s returned %s: %s", path, response.status_code, response.text[:500])
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(f"TravelNext Cars {path} error: {data['error']}")
            return data

    return await _travelnext_cars_breaker.call(_call)


def _default_rental_dates(pickup_date: Optional[str]) -> tuple[str, str]:
    """Default a 2-day rental starting tomorrow (or the given pickup_date) when no dropoff is specified."""
    if pickup_date:
        try:
            pickup = datetime.strptime(pickup_date, "%Y-%m-%d").date()
        except ValueError:
            pickup = datetime.utcnow().date() + timedelta(days=1)
    else:
        pickup = datetime.utcnow().date() + timedelta(days=1)
    dropoff = pickup + timedelta(days=2)
    return pickup.isoformat(), dropoff.isoformat()


# --------------------------------------------------------------------------
# Reference data
# --------------------------------------------------------------------------

async def get_languages() -> list[dict]:
    data = await _post("languages", _auth_block())
    return data if isinstance(data, list) else data.get("languages", [])


async def get_destinations(force_refresh: bool = False) -> list[dict]:
    global _destinations_cache
    if _destinations_cache is not None and not force_refresh:
        return _destinations_cache
    data = await _post("destinations", _auth_block(), timeout=90.0)
    _destinations_cache = data if isinstance(data, list) else data.get("destinations", [])
    return _destinations_cache


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


# Prefer primary international hubs when several airports share a city name
# (e.g. "London" must not resolve to London, Ontario YXU over Heathrow LHR).
_MAJOR_AIRPORT_RANK = {
    "LHR": 100,
    "LGW": 95,
    "STN": 90,
    "LTN": 85,
    "LCY": 80,
    "AMS": 100,
    "CDG": 100,
    "ORY": 90,
    "JFK": 100,
    "EWR": 95,
    "LGA": 90,
    "LAX": 100,
    "SFO": 95,
    "ORD": 100,
    "FRA": 100,
    "MUC": 95,
    "MAD": 100,
    "BCN": 95,
    "FCO": 100,
    "MXP": 90,
    "DXB": 100,
    "DOH": 95,
    "SIN": 100,
    "HKG": 100,
    "NRT": 100,
    "HND": 95,
    "ICN": 100,
    "SYD": 100,
    "YYZ": 100,
    "YVR": 90,
    "ZRH": 95,
    "VIE": 90,
    "CPH": 90,
    "OSL": 90,
    "ARN": 90,
    "DUB": 90,
    "BRU": 90,
    "LIS": 90,
    "ATH": 90,
    "IST": 95,
    "BKK": 90,
}


def _is_airport(dest: dict) -> bool:
    return str(dest.get("isairport") or "") in ("1", "true", "True")


def _rank_airport(dest: dict) -> tuple:
    code = str(dest.get("airport_code") or "").upper()
    name = (dest.get("location_name") or "").lower()
    major = _MAJOR_AIRPORT_RANK.get(code, 0)
    has_airport_word = 1 if "airport" in name else 0
    # Stable tie-break: shorter location names tend to be the main airport row.
    return (major, has_airport_word, -(len(name)))


def _prefer_dominant_country(candidates: list[dict]) -> list[dict]:
    """When the same city name exists in multiple countries, keep the country
    with the most airport rows (London GB ≫ London CA)."""
    airports = [d for d in candidates if _is_airport(d) and d.get("country_code")]
    if not airports:
        return candidates
    counts: dict[str, int] = {}
    for dest in airports:
        cc = str(dest.get("country_code") or "").upper()
        counts[cc] = counts.get(cc, 0) + 1
    best_cc = max(counts, key=counts.get)  # type: ignore[arg-type]
    filtered = [d for d in candidates if str(d.get("country_code") or "").upper() == best_cc]
    return filtered or candidates


async def resolve_destination(location: str) -> Optional[dict]:
    """Best-effort city / IATA / location-name match against the destinations list.

    Prefers airport rows when the query is a city name so car pickup lands at
    the main airport (e.g. Amsterdam → Schiphol AMS, London → Heathrow LHR).
    """
    if not location:
        return None
    raw = location.strip()
    needle = _normalize(raw)
    if not needle:
        return None
    destinations = await get_destinations()

    # Exact IATA / airport_code match first (AMS, LHR, …).
    if len(raw) == 3 and raw.isalpha():
        code = raw.upper()
        for dest in destinations:
            if str(dest.get("airport_code") or "").upper() == code:
                return dest

    # Prefer airports whose display name starts with the query
    # ("London - Airport - Heathrow") over city-field collisions (CA YXU).
    name_prefix = [
        d
        for d in destinations
        if _normalize(d.get("location_name", "")).startswith(needle)
    ]
    if name_prefix:
        scoped = _prefer_dominant_country(name_prefix)
        airports = [d for d in scoped if _is_airport(d)]
        if airports:
            return max(airports, key=_rank_airport)
        return scoped[0]

    city_exact = [d for d in destinations if _normalize(d.get("city", "")) == needle]
    if city_exact:
        scoped = _prefer_dominant_country(city_exact)
        airports = [d for d in scoped if _is_airport(d)]
        if airports:
            return max(airports, key=_rank_airport)
        return scoped[0]

    for dest in destinations:
        city = _normalize(dest.get("city", ""))
        name = _normalize(dest.get("location_name", ""))
        code = _normalize(dest.get("airport_code", ""))
        if needle in city or needle in name or needle == code:
            return dest
    return None


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------

async def search_availability(
    pickup_id: str,
    dropoff_id: str,
    pickup_date: str,
    dropoff_date: str,
    *,
    pickup_time: str = "10:00",
    dropoff_time: str = "10:00",
    driver_age: int = 30,
    country_res: str = "US",
    currency: str = "USD",
    pickup_location: Optional[str] = None,
    dropoff_location: Optional[str] = None,
    sorting: Optional[str] = None,
    language: Optional[str] = None,
) -> dict:
    body: dict[str, Any] = {
        **_auth_block(),
        "pickup_id": pickup_id,
        "dropoff_id": dropoff_id,
        "pickup_date": pickup_date,
        "pickup_time": pickup_time,
        "dropoff_date": dropoff_date,
        "dropoff_time": dropoff_time,
        "driver_age": driver_age,
        "country_res": country_res,
        "currency": currency,
    }
    if pickup_location:
        body["pickup_location"] = pickup_location
    if dropoff_location:
        body["dropoff_location"] = dropoff_location
    if sorting:
        body["sorting"] = sorting
    if language:
        body["language"] = language
    return await _post("search", body, timeout=30.0)


def _fee_amount(fees: dict, key: str) -> Optional[float]:
    try:
        return float(fees.get(key))
    except (TypeError, ValueError):
        return None


async def search_cars(location: Optional[str], budget: Optional[str], date: Optional[str] = None) -> list[InventoryItem]:
    """Inventory-shaped car search for /inventory/search?type=car."""
    if not (has_travelnext_cars_credentials() and location):
        return []

    try:
        dest = await resolve_destination(location)
        if not dest:
            return []
        pickup_date, dropoff_date = _default_rental_dates(date)
        response = await search_availability(
            dest["id"], dest["id"], pickup_date, dropoff_date,
            pickup_location=f"{dest['latitude']},{dest['longitude']}" if dest.get("latitude") else None,
            dropoff_location=f"{dest['latitude']},{dest['longitude']}" if dest.get("latitude") else None,
        )
    except CircuitBreakerOpen:
        logger.warning("TravelNext car search skipped — circuit breaker open")
        return []
    except Exception as exc:
        logger.error("TravelNext car search failed: %s", exc)
        return []

    results: list[InventoryItem] = []
    session_id = response.get("sessionId") or response.get("session_id")
    for row in response.get("data", []) or []:
        try:
            fees = row.get("fees") or {}
            price = _fee_amount(fees, "rateTotalAmount")
            if price is None:
                continue
            car = row.get("carDetails") or {}
            vendor = row.get("vendor") or {}
            pickup = row.get("pickup") or {}
            dropoff = row.get("dropoff") or {}
            seats = car.get("passengerQuantity")
            bags = car.get("baggageQuantity")
            try:
                seats_n = int(seats) if seats is not None else 4
            except (TypeError, ValueError):
                seats_n = 4
            try:
                bags_n = int(bags) if bags is not None else 2
            except (TypeError, ValueError):
                bags_n = 2
            vendor_name = vendor.get("name") or "Supplier"
            model = car.get("carModel") or "Car"
            category = car.get("sizeName") or "Car"
            pickup_label = pickup.get("locationName") or dest.get("location_name") or location
            results.append(InventoryItem(
                id=str(row.get("referenceId") or uuid.uuid4()),
                type="car",
                provider="travelnext",
                title=f"{model} — {vendor_name}".strip(" —"),
                price=price,
                currency=fees.get("currencyCode", "USD"),
                # Booking is session/reference based via TravelNext Cars API.
                deep_link="",
                start_time=pickup.get("time") or "10:00",
                end_time=dropoff.get("time") or "10:00",
                duration=f"{row.get('duration')} day(s)" if row.get("duration") else None,
                image_url=car.get("carImageHD") or car.get("carImage"),
                details={
                    "vendor": vendor_name,
                    "supplier_name": vendor_name,
                    "sizeName": category,
                    "category": category,
                    "make": model.split(" ")[0] if model else None,
                    "model": model,
                    "transmission": car.get("transmissionType") or "Automatic",
                    "fuel": (car.get("fuelType") or "Gasoline"),
                    "passengers": seats_n,
                    "bags": bags_n,
                    "capacity": {"seats": seats_n, "bags": {"large": bags_n}},
                    "pickup": pickup_label,
                    "location": pickup_label,
                    "pickup_address": pickup.get("address"),
                    "dropoff": dropoff.get("locationName"),
                    "pickup_date": pickup.get("date") or pickup_date,
                    "dropoff_date": dropoff.get("date") or dropoff_date,
                    "sessionId": session_id,
                    "referenceId": row.get("referenceId"),
                    "bookable": True,
                    "policies": {
                        "fuel": (car.get("fuelPolicy") or {}).get("description"),
                        "mileage": (car.get("rateDistance") or {}).get("vehiclePeriodUnitName") or "Unlimited",
                    },
                },
            ))
        except Exception as exc:
            logger.error("Error parsing TravelNext car result: %s", exc)
            continue

    results.sort(key=lambda item: item.price)
    return results[:20]


# --------------------------------------------------------------------------
# Pre-booking (session-scoped, no auth block)
# --------------------------------------------------------------------------

async def get_rental_condition_details(session_id: str, reference_id: str) -> dict:
    return await _post("rental_condition_details", {"session_id": session_id, "reference_id": reference_id})


async def get_car_insurance(session_id: str, reference_id: str, first_name: str, last_name: str) -> dict:
    return await _post(
        "car_insurance",
        {"session_id": session_id, "reference_id": reference_id, "first_name": first_name, "last_name": last_name},
    )


# --------------------------------------------------------------------------
# Booking
# --------------------------------------------------------------------------

async def book_car(
    session_id: str,
    reference_id: str,
    no_of_passenger: str,
    pax_details: dict,
    payment_details: dict,
    *,
    client_reference: Optional[str] = None,
    remark: Optional[str] = None,
    insurance_plan_id: Optional[str] = None,
    extra_services: Optional[list[dict]] = None,
    airline_details: Optional[dict] = None,
) -> dict:
    body: dict[str, Any] = {
        "session_id": session_id,
        "reference_id": reference_id,
        "no_of_passenger": no_of_passenger,
        "pax_details": pax_details,
        "payment_details": payment_details,
    }
    if client_reference:
        body["client_reference"] = client_reference
    if remark:
        body["remark"] = remark
    if insurance_plan_id:
        body["insurance_plan_id"] = insurance_plan_id
    if extra_services:
        body["extra_services"] = extra_services
    if airline_details:
        body["airline_details"] = airline_details
    return await _post("car_book", body, timeout=60.0)


# --------------------------------------------------------------------------
# Post-booking
# --------------------------------------------------------------------------

async def cancel_booking(confirmation_id: str) -> dict:
    return await _post("cancel_booking", {**_auth_block(), "confirmation_id": confirmation_id})


async def get_booking_details(confirmation_id: str) -> dict:
    return await _post("booking_details", {**_auth_block(), "confirmation_id": confirmation_id})
