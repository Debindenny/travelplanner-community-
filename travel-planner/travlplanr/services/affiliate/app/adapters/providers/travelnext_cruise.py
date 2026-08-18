"""TravelNext Cruise (cruisev2) API adapter.

Covers cruise sailing search, sailing details, auth-backed reference data, and
inventory mapping for `/inventory/search?type=cruise`.
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

TRAVELNEXT_CRUISE_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_CRUISE_API_BASE_URL")
    or "https://travelnext.works/api/cruisev2"
).rstrip("/")

_travelnext_cruise_breaker = CircuitBreaker(
    name="travelnext_cruise",
    failure_threshold=5,
    recovery_timeout=60.0,
)

_destinations_cache: list[dict] | None = None
_cruise_lines_cache: list[dict] | None = None
_ships_cache: list[dict] | None = None
_markets_cache: list[dict] | None = None
_vendors_cache: list[dict] | None = None


def has_travelnext_cruise_credentials() -> bool:
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
    if not has_travelnext_cruise_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_CRUISE_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext Cruise {path}",
            )
            if response.status_code >= 400:
                logger.error(
                    "TravelNext Cruise %s returned %s: %s",
                    path,
                    response.status_code,
                    response.text[:500],
                )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                if data.get("error"):
                    raise RuntimeError(f"TravelNext Cruise {path} error: {data['error']}")
                errors = data.get("Errors")
                if isinstance(errors, dict) and errors.get("ErrorMessage"):
                    msg = str(errors.get("ErrorMessage") or "")
                    # Empty inventory is a normal business response — do not trip the breaker.
                    if "No cruises are available" in msg:
                        return {"data": [], "Errors": errors}
                    raise RuntimeError(
                        f"TravelNext Cruise {path} error: {errors.get('ErrorCode')} {msg}"
                    )
            return data

    return await _travelnext_cruise_breaker.call(_call)


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def _price(value: Any) -> Optional[float]:
    if isinstance(value, dict):
        for key in ("Amount", "amount", "price", "value", "AdultFare", "adultFare"):
            if key in value:
                return _price(value.get(key))
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount >= 0 else None


def _default_window(date: Optional[str]) -> tuple[str, str]:
    if date:
        try:
            start = datetime.strptime(date[:10], "%Y-%m-%d").date()
        except ValueError:
            start = datetime.now(timezone.utc).date() + timedelta(days=30)
    else:
        start = datetime.now(timezone.utc).date() + timedelta(days=30)
    end = start + timedelta(days=180)
    return start.isoformat(), end.isoformat()


def _sailing_parts(reference_id: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Parse destination ``referenceid`` → (cruiseLineId, shipId)."""
    if not reference_id or "__" not in reference_id:
        return None, None
    parts = reference_id.split("__")
    line = parts[0] if parts else None
    ship = parts[1] if len(parts) > 1 else None
    return line, ship


async def _match_destinations(location: str) -> list[dict]:
    destinations = await get_destinations()
    needle = _normalize(location.split(",")[0])
    matches: list[dict] = []
    for row in destinations:
        name = _normalize(
            str(row.get("portName") or row.get("Name") or row.get("destination") or row.get("name") or "")
        )
        if name == needle or (needle and needle in name):
            matches.append(row)
    return matches[:5]


def _rows(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [row for row in response if isinstance(row, dict)]
    if not isinstance(response, dict):
        return []
    for key in ("data", "results", "sailings", "cruises", "searchResult"):
        value = response.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            nested = value.get("data") or value.get("results") or value.get("sailings")
            if isinstance(nested, list):
                return [row for row in nested if isinstance(row, dict)]
    return []


def _session_id(response: Any) -> Optional[str]:
    if not isinstance(response, dict):
        return None
    for key in ("session_id", "sessionId", "SessionId"):
        if response.get(key):
            return str(response[key])
    return None


async def _cached_list(
    cache_name: str,
    path: str,
    response_keys: tuple[str, ...],
    *,
    force_refresh: bool = False,
) -> list[dict]:
    global _destinations_cache, _cruise_lines_cache, _ships_cache, _markets_cache, _vendors_cache
    cache_map = {
        "destinations": _destinations_cache,
        "cruise_lines": _cruise_lines_cache,
        "ships": _ships_cache,
        "markets": _markets_cache,
        "vendors": _vendors_cache,
    }
    if cache_map[cache_name] is not None and not force_refresh:
        return cache_map[cache_name] or []

    data = await _post(path, _auth_block(), timeout=60.0)
    rows: list[dict] = []
    if isinstance(data, list):
        rows = [row for row in data if isinstance(row, dict)]
    elif isinstance(data, dict):
        for key in response_keys:
            value = data.get(key)
            if isinstance(value, list):
                rows = [row for row in value if isinstance(row, dict)]
                break
    if cache_name == "destinations":
        _destinations_cache = rows
    elif cache_name == "cruise_lines":
        _cruise_lines_cache = rows
    elif cache_name == "ships":
        _ships_cache = rows
    elif cache_name == "markets":
        _markets_cache = rows
    else:
        _vendors_cache = rows
    return rows


async def get_destinations(force_refresh: bool = False) -> list[dict]:
    return await _cached_list(
        "destinations",
        "cruiseAllDestinations",
        ("destinations", "ports", "data"),
        force_refresh=force_refresh,
    )


async def get_cruise_lines(force_refresh: bool = False) -> list[dict]:
    return await _cached_list(
        "cruise_lines",
        "cruiseLines",
        ("cruiseLines", "cruise_lines", "data"),
        force_refresh=force_refresh,
    )


async def get_ships(force_refresh: bool = False) -> list[dict]:
    return await _cached_list("ships", "cruiseAllShips", ("ships", "data"), force_refresh=force_refresh)


async def get_markets(force_refresh: bool = False) -> list[dict]:
    return await _cached_list("markets", "cruiseMarkets", ("markets", "data"), force_refresh=force_refresh)


async def get_vendors(force_refresh: bool = False) -> list[dict]:
    return await _cached_list("vendors", "cruiseVendors", ("vendors", "data"), force_refresh=force_refresh)


async def search_cruises(
    start_date: str,
    end_date: str,
    to_nights: str,
    destination_port_ids: list[str],
    cruise_lines: list[str],
    cruise_ships_ids: list[str],
    embarkation_ports_ids: list[str],
    port_of_call_ids: list[str],
    number_of_cabin: str,
    search_type: str,
    *,
    from_nights: Optional[str] = None,
    marketing_code: Optional[str] = None,
    vendor_sailing_identifier: Optional[str] = None,
    from_price: Optional[str] = None,
    to_price: Optional[str] = None,
) -> dict:
    body: dict[str, Any] = {
        **_auth_block(),
        "startDate": start_date,
        "endDate": end_date,
        "toNights": to_nights,
        "destinationPortIds": destination_port_ids,
        "cruiseLines": cruise_lines,
        "cruiseShipsIds": cruise_ships_ids,
        "embarkationPortsIds": embarkation_ports_ids,
        "portOfCallIds": port_of_call_ids,
        "NumberOfCabin": number_of_cabin,
        "searchType": search_type,
    }
    optional = {
        "fromNights": from_nights,
        "marketingCode": marketing_code,
        "vendorSailingIdentifier": vendor_sailing_identifier,
        "fromPrice": from_price,
        "toPrice": to_price,
    }
    body.update({k: v for k, v in optional.items() if v not in (None, "", [])})
    return await _post("search", body, timeout=45.0)


async def get_cruise_details(session_id: str, id: str) -> dict:
    return await _post("details", {"session_id": session_id, "id": id}, timeout=45.0)


def _budget_match(price: float, budget: Optional[str]) -> bool:
    if not budget:
        return True
    key = budget.strip().lower()
    if key in {"low", "budget"}:
        return price <= 600
    if key in {"mid", "medium"}:
        return 400 <= price <= 1800
    if key in {"high", "luxury"}:
        return price >= 1200
    return True


async def search_cruises_inventory(
    location: Optional[str],
    budget: Optional[str],
    *,
    date: Optional[str] = None,
) -> list[InventoryItem]:
    if not (has_travelnext_cruise_credentials() and location):
        return []

    try:
        destinations = await _match_destinations(location)
        if not destinations:
            return []
        start_date, end_date = _default_window(date)
        # Cruise search requires non-empty cruiseLines / cruiseShipsIds /
        # embarkationPortsIds / portOfCallIds / destinationPortIds arrays.
        # Destination rows include a referenceid like
        # ``LineId__ShipId__SailingId`` we can reuse for those filters.
        dest = destinations[0]
        port_id = str(dest.get("portId") or dest.get("id") or dest.get("DestinationID") or "")
        if not port_id:
            return []
        line_id, ship_id = _sailing_parts(str(dest.get("referenceid") or ""))
        if not line_id or not ship_id:
            # Fall back to first catalog entries so the request is valid.
            lines = await get_cruise_lines()
            ships = await get_ships()
            line_id = str(
                (lines[0].get("referenceid") if lines else None)
                or (lines[0].get("cruise_sailing_name") if lines else None)
                or ""
            )
            ship_id = str((ships[0].get("ShipID") if ships else None) or "")
        if not line_id or not ship_id:
            return []

        response = await search_cruises(
            start_date,
            end_date,
            "14",
            [port_id],
            [line_id],
            [ship_id],
            [port_id],
            [port_id],
            "1",
            "1",
            from_nights="1",
            vendor_sailing_identifier=str(dest.get("referenceid") or "") or None,
        )
    except CircuitBreakerOpen:
        logger.warning("TravelNext Cruise search skipped — circuit breaker open")
        return []
    except Exception as exc:
        if "No cruises are available" in str(exc):
            return []
        logger.error("TravelNext Cruise search failed: %s", exc)
        return []

    session_id = _session_id(response)
    results: list[InventoryItem] = []
    for row in _rows(response):
        try:
            cruise_id = str(row.get("id") or row.get("SailingID") or row.get("PackageID") or "")
            if not cruise_id:
                continue

            price = None
            prices = row.get("sailing_prices")
            if isinstance(prices, list) and prices:
                first_price = prices[0]
                if isinstance(first_price, dict):
                    price = _price(first_price.get("AdultFare")) or _price(first_price)
            if price is None:
                price = _price(row.get("price") or row.get("fromPrice"))
            if price is None or not _budget_match(price, budget):
                continue

            title = str(
                row.get("title")
                or row.get("SailingName")
                or row.get("cruise_sailing_name")
                or row.get("ShipName")
                or "Cruise"
            ).strip()
            currency = "USD"
            if isinstance(prices, list) and prices:
                first_price = prices[0]
                if isinstance(first_price, dict):
                    currency = str(first_price.get("CurrencyCode") or "USD")
            image = row.get("image") or row.get("imageUrl")

            results.append(
                InventoryItem(
                    id=cruise_id,
                    type="cruise",
                    provider="travelnext",
                    title=title,
                    price=price,
                    currency=currency,
                    deep_link="",
                    start_time=None,
                    duration=f"{row.get('Duration')} night(s)" if row.get("Duration") else None,
                    image_url=str(image) if image else None,
                    details={
                        "session_id": row.get("session_id") or session_id,
                        "SailingID": row.get("SailingID"),
                        "ShipName": row.get("ShipName"),
                        "DepartureDate": row.get("DepartureDate"),
                        "DeparturePortCode": row.get("DeparturePortCode"),
                        "ReturnPortCode": row.get("ReturnPortCode"),
                        "ports": row.get("ports"),
                        "shipData": row.get("shipData"),
                        "location": location,
                        "bookable": True,
                    },
                )
            )
        except Exception as exc:
            logger.error("Error parsing TravelNext Cruise result: %s", exc)
            continue

    results.sort(key=lambda item: item.price)
    return results[:20]
