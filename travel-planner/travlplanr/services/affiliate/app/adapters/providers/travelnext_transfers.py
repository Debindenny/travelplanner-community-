"""TravelNext Transfers (transfersv2) API adapter.

Covers the documented surface: destination auto-search, availability search
(airport legs, accommodation-to-accommodation legs, and geo-code search, all
dispatched through the single `search` endpoint), booking, cancel, and
booking details lookup. Every endpoint requires the full `user_id`/
`user_password`/`access`/`ip_address` block. Same sandbox account as the
flight API (`travelnext.py`) — only the product base URL differs — so
credentials are read from the same `TRAVELNEXT_*` env vars.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Optional

import httpx
from shared.circuit_breaker import CircuitBreaker

from app.adapters.providers.travelnext import (
    TRAVELNEXT_ACCESS,
    TRAVELNEXT_USER_ID,
    TRAVELNEXT_USER_PASSWORD,
    get_travelnext_ip,
    has_travelnext_credentials,
)
from app.schemas.inventory import InventoryItem

logger = logging.getLogger(__name__)

TRAVELNEXT_TRANSFERS_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_TRANSFERS_API_BASE_URL")
    or "https://travelnext.works/api/transfersv2-test"
).rstrip("/")

_travelnext_transfers_breaker = CircuitBreaker(name="travelnext_transfers", failure_threshold=5, recovery_timeout=60.0)


def has_travelnext_transfers_credentials() -> bool:
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
    if not has_travelnext_transfers_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_TRANSFERS_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext Transfers {path}",
            )
            if response.status_code >= 400:
                logger.error(
                    "TravelNext Transfers %s returned %s: %s", path, response.status_code, response.text[:500]
                )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(f"TravelNext Transfers {path} error: {data['error']}")
            return data

    return await _travelnext_transfers_breaker.call(_call)


# --------------------------------------------------------------------------
# Destinations
# --------------------------------------------------------------------------

async def search_destinations(destination: str) -> list[dict]:
    body = {**_auth_block(), "destination": destination}
    data = await _post("destinations_auto", body)
    return data if isinstance(data, list) else data.get("destinations", []) if isinstance(data, dict) else []


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------

async def search_transfers(
    journey_type: str,
    pickup_location: str,
    dropoff_location: str,
    adults: int,
    *,
    search_currency: str = "USD",
    children: int = 0,
    infants: int = 0,
    arrival_date: Optional[str] = None,
    arrival_time: Optional[str] = None,
    departure_date: Optional[str] = None,
    departure_time: Optional[str] = None,
    pickup_date: Optional[str] = None,
    pickup_time: Optional[str] = None,
    return_pickup_date: Optional[str] = None,
    return_pickup_time: Optional[str] = None,
    pickup_location_code: Optional[str] = None,
    pickup_location_type: Optional[str] = None,
    dropoff_location_code: Optional[str] = None,
    dropoff_location_type: Optional[str] = None,
    sorting: Optional[str] = None,
) -> dict:
    body: dict[str, Any] = {
        **_auth_block(),
        "search_currency": search_currency,
        "journey_type": journey_type,
        "pickup_location": pickup_location,
        "dropoff_location": dropoff_location,
        "adults": adults,
        "children": children,
        "infants": infants,
    }
    optional: dict[str, Any] = {
        "arrival_date": arrival_date,
        "arrival_time": arrival_time,
        "departure_date": departure_date,
        "departure_time": departure_time,
        "pickup_date": pickup_date,
        "pickup_time": pickup_time,
        "return_pickup_date": return_pickup_date,
        "return_pickup_time": return_pickup_time,
        "pickup_location_code": pickup_location_code,
        "pickup_location_type": pickup_location_type,
        "dropoff_location_code": dropoff_location_code,
        "dropoff_location_type": dropoff_location_type,
        "sorting": sorting,
    }
    body.update({k: v for k, v in optional.items() if v is not None})
    return await _post("search", body, timeout=30.0)


# --------------------------------------------------------------------------
# Booking
# --------------------------------------------------------------------------

async def book_transfer(
    session_id: str,
    product_id: str,
    booking_type_id: str,
    pax_details: dict,
    accomodation_details: dict,
    *,
    client_reference: Optional[str] = None,
    payment_details: Optional[dict] = None,
    departure_airline: Optional[dict] = None,
    arrival_airline: Optional[dict] = None,
    extras: Optional[list[dict]] = None,
    remark: Optional[str] = None,
) -> dict:
    body: dict[str, Any] = {
        **_auth_block(),
        "session_id": session_id,
        "product_id": product_id,
        "booking_type_id": booking_type_id,
        "pax_details": pax_details,
        "accomodation_details": accomodation_details,
    }
    if client_reference:
        body["client_reference"] = client_reference
    if payment_details:
        body["payment_details"] = payment_details
    if departure_airline:
        body["departure_airline"] = departure_airline
    if arrival_airline:
        body["arrival_airline"] = arrival_airline
    if extras:
        body["extras"] = extras
    if remark:
        body["remark"] = remark
    return await _post("transfer_booking", body, timeout=60.0)


# --------------------------------------------------------------------------
# Post-booking
# --------------------------------------------------------------------------

async def cancel_transfer(confirmation_id: str) -> dict:
    return await _post("cancel", {**_auth_block(), "confirmation_id": confirmation_id})


async def get_booking_details(confirmation_id: str) -> dict:
    return await _post("booking_details", {**_auth_block(), "confirmation_id": confirmation_id})


# --------------------------------------------------------------------------
# Inventory mapping for /inventory/search?type=transfer
# --------------------------------------------------------------------------

def _transfer_price(row: dict) -> float | None:
    for key in ("price", "total_price", "TotalPrice", "fromPrice", "amount"):
        raw = row.get(key)
        if raw is None:
            continue
        try:
            return float(raw)
        except (TypeError, ValueError):
            continue
    price_obj = row.get("price_detail") or row.get("PriceDetail")
    if isinstance(price_obj, dict):
        for key in ("total", "amount", "price"):
            try:
                if price_obj.get(key) is not None:
                    return float(price_obj[key])
            except (TypeError, ValueError):
                continue
    return None


def _transfer_rows(response: Any) -> list[dict]:
    if isinstance(response, list):
        return [r for r in response if isinstance(r, dict)]
    if not isinstance(response, dict):
        return []
    for key in ("products", "transfers", "results", "data", "Vehicles", "vehicles"):
        rows = response.get(key)
        if isinstance(rows, list):
            return [r for r in rows if isinstance(r, dict)]
    return []


async def search_transfers_inventory(
    location: Optional[str],
    dep: Optional[str],
    arr: Optional[str],
    budget: Optional[str],
    *,
    date: Optional[str] = None,
) -> list[InventoryItem]:
    """Map TravelNext transfer search into InventoryItem rows."""
    if not has_travelnext_transfers_credentials():
        return []

    pickup = (dep or location or "").strip()
    dropoff = (arr or location or "").strip()
    if not pickup or not dropoff:
        return []

    # Same-city private transfer: airport → city center (or reverse).
    if pickup.lower() == dropoff.lower() and location:
        pickup = f"{location} Airport"
        dropoff = f"{location} City Center"

    pickup_date = (date or "")[:10] or None
    pickup_time = "10:00"

    try:
        response = await search_transfers(
            journey_type="oneway",
            pickup_location=pickup,
            dropoff_location=dropoff,
            adults=2,
            search_currency="USD",
            pickup_date=pickup_date,
            pickup_time=pickup_time,
        )
    except Exception as exc:
        logger.error("TravelNext Transfers inventory search failed: %s", exc)
        return []

    session_id = None
    if isinstance(response, dict):
        session_id = response.get("session_id") or response.get("sessionId")

    results: list[InventoryItem] = []
    for row in _transfer_rows(response):
        transfer_id = str(
            row.get("product_id")
            or row.get("productId")
            or row.get("id")
            or row.get("VehicleId")
            or ""
        )
        if not transfer_id:
            continue
        price = _transfer_price(row)
        if price is None:
            continue
        title = str(
            row.get("vehicle_name")
            or row.get("VehicleName")
            or row.get("title")
            or row.get("name")
            or "Private Transfer"
        ).strip()
        image = row.get("image") or row.get("imageUrl") or row.get("vehicle_image")
        results.append(
            InventoryItem(
                id=transfer_id,
                type="transfer",
                provider="travelnext",
                title=title,
                price=float(price),
                currency=str(row.get("currency") or row.get("Currency") or "USD"),
                deep_link="",
                duration=str(row.get("duration") or row.get("travel_time") or "") or None,
                image_url=str(image) if image else None,
                details={
                    "sessionId": session_id,
                    "product_id": transfer_id,
                    "booking_type_id": row.get("booking_type_id") or row.get("bookingTypeId"),
                    "from": pickup,
                    "to": dropoff,
                    "location": f"{pickup} → {dropoff}",
                    "vehicle_class": row.get("vehicle_class") or row.get("class") or row.get("category"),
                    "passengers": row.get("max_passengers") or row.get("passengers") or 3,
                    "bags": row.get("max_bags") or row.get("bags") or 2,
                    "bookable": True,
                },
            )
        )

    results.sort(key=lambda item: item.price)
    return results[:20]
