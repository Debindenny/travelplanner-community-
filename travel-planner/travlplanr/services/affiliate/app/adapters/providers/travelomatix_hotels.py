"""Travelomatix Hotel API v3 adapter (Accentria Solutions).

Pathway: Search → HotelDetails → RoomList → BlockRoom → CommitBooking
(+ UpdateHoldBooking / CancelBooking / CancellationRefundDetails).

Auth is header-based (x-Username / x-DomainKey / x-system / x-Password).
Search requires a numeric CityId — resolved from
`data/travelomatix_cities.json`, `TRAVELOMATIX_CITY_OVERRIDES`, or an
explicit `city_id:NNNN` / `City#NNNN` location token.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from shared.circuit_breaker import CircuitBreaker, CircuitBreakerOpen

from app.schemas.inventory import InventoryItem

logger = logging.getLogger(__name__)

TRAVELOMATIX_HOTELS_API_BASE_URL = (
    os.environ.get("TRAVELOMATIX_HOTELS_API_BASE_URL")
    or "http://test.services.travelomatix.com/webservices/index.php/hotel_v3/service"
).rstrip("/")

TRAVELOMATIX_USERNAME = os.environ.get("TRAVELOMATIX_USERNAME", "")
TRAVELOMATIX_PASSWORD = os.environ.get("TRAVELOMATIX_PASSWORD", "")
TRAVELOMATIX_DOMAIN_KEY = os.environ.get("TRAVELOMATIX_DOMAIN_KEY", "")
TRAVELOMATIX_SYSTEM = os.environ.get("TRAVELOMATIX_SYSTEM", "test")
TRAVELOMATIX_GUEST_NATIONALITY = os.environ.get("TRAVELOMATIX_GUEST_NATIONALITY", "IN")
TRAVELOMATIX_DEFAULT_CITY_ID = os.environ.get("TRAVELOMATIX_DEFAULT_CITY_ID", "")

_cities_path = Path(
    os.environ.get("TRAVELOMATIX_CITIES_PATH")
    or Path(__file__).resolve().parent / "data" / "travelomatix_cities.json"
)

_breaker = CircuitBreaker(name="travelomatix_hotels", failure_threshold=5, recovery_timeout=60.0)
_cities_cache: list[dict[str, Any]] | None = None
_api_cities_loaded = False

_COUNTRY_NAME_TO_CODE = {
    "india": "IN",
    "united arab emirates": "AE",
    "uae": "AE",
    "united kingdom": "GB",
    "uk": "GB",
    "great britain": "GB",
    "united states": "US",
    "usa": "US",
    "us": "US",
    "singapore": "SG",
    "thailand": "TH",
    "france": "FR",
    "italy": "IT",
    "netherlands": "NL",
    "germany": "DE",
    "spain": "ES",
    "australia": "AU",
    "malaysia": "MY",
    "indonesia": "ID",
    "sri lanka": "LK",
    "nepal": "NP",
    "maldives": "MV",
}


def has_travelomatix_hotels_credentials() -> bool:
    return bool(
        TRAVELOMATIX_USERNAME
        and TRAVELOMATIX_PASSWORD
        and TRAVELOMATIX_DOMAIN_KEY
        and TRAVELOMATIX_SYSTEM
    )


def _auth_headers() -> dict[str, str]:
    return {
        "x-Username": TRAVELOMATIX_USERNAME,
        "x-Password": TRAVELOMATIX_PASSWORD,
        "x-DomainKey": TRAVELOMATIX_DOMAIN_KEY,
        "x-system": TRAVELOMATIX_SYSTEM,
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
        "Accept": "application/json",
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
            await asyncio.sleep(0.5 * (2**attempt))
    raise last_error  # type: ignore[misc]


def _raise_if_error(path: str, data: Any) -> None:
    if not isinstance(data, dict):
        return
    status = data.get("Status")
    if status in (0, "0", False):
        message = data.get("Message") or data.get("message") or "request failed"
        raise RuntimeError(f"Travelomatix Hotels {path} error: {message}")
    if data.get("error"):
        raise RuntimeError(f"Travelomatix Hotels {path} error: {data['error']}")


async def _post(path: str, body: dict[str, Any], *, timeout: float = 45.0) -> Any:
    if not has_travelomatix_hotels_credentials():
        raise RuntimeError("Travelomatix Hotels credentials are not configured")

    url = f"{TRAVELOMATIX_HOTELS_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> Any:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, headers=_auth_headers(), timeout=timeout),
                label=f"Travelomatix Hotels {path}",
            )
            if response.status_code >= 400:
                logger.error(
                    "Travelomatix Hotels %s returned %s: %s",
                    path,
                    response.status_code,
                    response.text[:500],
                )
            response.raise_for_status()
            data = response.json()
            _raise_if_error(path, data)
            return data

    return await _breaker.call(_call)


def _normalize_place(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def _alias_tokens(city_name: str) -> list[str]:
    """Split 'Bombay/ Mumbai' / 'Madras/Chennai' style names into lookup tokens."""
    parts: list[str] = []
    for chunk in re.split(r"[/,|]", city_name or ""):
        token = chunk.strip()
        if token:
            parts.append(token)
    if city_name and city_name.strip() not in parts:
        parts.insert(0, city_name.strip())
    return parts


def _static_and_override_cities() -> list[dict[str, Any]]:
    cities: list[dict[str, Any]] = []
    try:
        if _cities_path.exists():
            raw = json.loads(_cities_path.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                cities.extend(row for row in raw if isinstance(row, dict))
    except Exception as exc:
        logger.warning("Failed to load Travelomatix city map %s: %s", _cities_path, exc)

    overrides_raw = os.environ.get("TRAVELOMATIX_CITY_OVERRIDES", "").strip()
    if overrides_raw:
        try:
            overrides = json.loads(overrides_raw)
            if isinstance(overrides, dict):
                for name, city_id in overrides.items():
                    cities.append(
                        {
                            "city_id": int(city_id),
                            "city_name": str(name),
                            "country_code": TRAVELOMATIX_GUEST_NATIONALITY or "IN",
                            "aliases": [str(name)],
                        }
                    )
            elif isinstance(overrides, list):
                cities.extend(row for row in overrides if isinstance(row, dict))
        except Exception as exc:
            logger.warning("Invalid TRAVELOMATIX_CITY_OVERRIDES: %s", exc)
    return cities


def get_cities(force_refresh: bool = False) -> list[dict[str, Any]]:
    """Return CityId catalog (API cache if loaded, else static seed + overrides)."""
    global _cities_cache
    if _cities_cache is not None and not force_refresh:
        return _cities_cache
    _cities_cache = _static_and_override_cities()
    return _cities_cache


def _normalize_city_row(row: dict[str, Any]) -> Optional[dict[str, Any]]:
    try:
        city_id = int(row.get("city_id") or row.get("city_code") or row.get("CityId") or 0)
    except (TypeError, ValueError):
        return None
    if city_id <= 0:
        return None
    city_name = str(row.get("city_name") or row.get("CityName") or "").strip()
    if not city_name:
        return None
    country_code = str(row.get("country_code") or row.get("CountryCode") or "").strip().upper()
    aliases = list(row.get("aliases") or [])
    aliases.extend(_alias_tokens(city_name))
    # de-dupe aliases preserving order
    seen: set[str] = set()
    uniq_aliases: list[str] = []
    for alias in aliases:
        key = alias.strip()
        if not key or key.lower() in seen:
            continue
        seen.add(key.lower())
        uniq_aliases.append(key)
    return {
        "city_id": city_id,
        "city_name": city_name,
        "country_code": country_code or (TRAVELOMATIX_GUEST_NATIONALITY or "IN"),
        "country_name": str(row.get("country_name") or row.get("CountryName") or ""),
        "aliases": uniq_aliases,
    }


async def fetch_hotel_city_list(*, force_refresh: bool = False) -> list[dict[str, Any]]:
    """Load full Travelomatix HotelCityList into the in-process city cache."""
    global _cities_cache, _api_cities_loaded
    if _api_cities_loaded and _cities_cache is not None and not force_refresh:
        return _cities_cache

    data = await _post("HotelCityList", {}, timeout=180.0)
    rows = data.get("HotelCityList") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise RuntimeError("Travelomatix HotelCityList returned no cities")

    cities: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized = _normalize_city_row(row)
        if normalized:
            cities.append(normalized)

    # Keep static/override entries first so overrides win on equal match rank.
    seed = _static_and_override_cities()
    merged = seed + cities
    _cities_cache = merged
    _api_cities_loaded = True
    logger.info("Travelomatix HotelCityList loaded (%s cities)", len(cities))
    return merged


async def ensure_city_catalog() -> list[dict[str, Any]]:
    """Prefer live HotelCityList; fall back to static seed on failure."""
    if _api_cities_loaded and _cities_cache is not None:
        return _cities_cache
    if not has_travelomatix_hotels_credentials():
        return get_cities()
    try:
        return await fetch_hotel_city_list()
    except Exception as exc:
        logger.warning("Travelomatix HotelCityList unavailable, using seed map: %s", exc)
        return get_cities()


def _country_code_from_name(name: str) -> str:
    key = (name or "").strip().lower()
    if len(key) == 2 and key.isalpha():
        return key.upper()
    return _COUNTRY_NAME_TO_CODE.get(key, "")


def _city_country_from_location(location: str) -> tuple[str, str]:
    parts = [part.strip() for part in (location or "").split(",") if part.strip()]
    if len(parts) >= 2:
        return parts[0], parts[-1]
    return (location or "").strip(), ""


def _parse_explicit_city_id(location: str) -> Optional[int]:
    text = (location or "").strip()
    match = re.search(r"(?:city[_-]?id\s*[:=]\s*|#)(\d{3,})", text, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    if text.isdigit() and len(text) >= 3:
        return int(text)
    return None


def resolve_city(location: str) -> Optional[dict[str, Any]]:
    """Resolve location text → {city_id, city_name, country_code}."""
    explicit_id = _parse_explicit_city_id(location)
    city_name, country_name = _city_country_from_location(
        re.sub(r"(?:city[_-]?id\s*[:=]\s*|#)\d{3,}", "", location or "", flags=re.IGNORECASE).strip(" ,")
        or location
    )
    country_code = _country_code_from_name(country_name) if country_name else ""

    if explicit_id is not None:
        return {
            "city_id": explicit_id,
            "city_name": city_name or str(explicit_id),
            "country_code": country_code or (TRAVELOMATIX_GUEST_NATIONALITY or "IN"),
        }

    needle = _normalize_place(city_name)
    if not needle:
        return None

    exact: list[dict[str, Any]] = []
    partial: list[dict[str, Any]] = []
    for row in get_cities():
        names = [
            str(row.get("city_name") or ""),
            *(str(a) for a in (row.get("aliases") or []) if a),
        ]
        row_country = str(row.get("country_code") or "").upper()
        if country_code and row_country and row_country != country_code:
            continue
        for name in names:
            normalized = _normalize_place(name)
            if not normalized:
                continue
            candidate = {
                "city_id": int(row["city_id"]),
                "city_name": str(row.get("city_name") or city_name),
                "country_code": row_country or country_code or (TRAVELOMATIX_GUEST_NATIONALITY or "IN"),
            }
            if normalized == needle:
                exact.append(candidate)
                break
            if needle in normalized or normalized in needle:
                partial.append(candidate)
                break

    if exact:
        return exact[0]
    if partial:
        return partial[0]

    if TRAVELOMATIX_DEFAULT_CITY_ID.isdigit():
        return {
            "city_id": int(TRAVELOMATIX_DEFAULT_CITY_ID),
            "city_name": city_name or TRAVELOMATIX_DEFAULT_CITY_ID,
            "country_code": country_code or (TRAVELOMATIX_GUEST_NATIONALITY or "IN"),
        }
    return None


def _to_tm_date(value: Optional[str]) -> str:
    """Convert YYYY-MM-DD (or similar) → dd-mm-yyyy."""
    if value:
        text = value.strip()[:10]
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(text, fmt).strftime("%d-%m-%Y")
            except ValueError:
                continue
    checkin = datetime.now(timezone.utc).date() + timedelta(days=1)
    return checkin.strftime("%d-%m-%Y")


def _default_dates(date: Optional[str]) -> tuple[str, int, str, str]:
    """Return (checkin_tm, nights, checkin_iso, checkout_iso)."""
    if date:
        try:
            checkin = datetime.strptime(date[:10], "%Y-%m-%d").date()
        except ValueError:
            checkin = datetime.now(timezone.utc).date() + timedelta(days=1)
    else:
        checkin = datetime.now(timezone.utc).date() + timedelta(days=1)
    nights = 2
    checkout = checkin + timedelta(days=nights)
    return checkin.strftime("%d-%m-%Y"), nights, checkin.isoformat(), checkout.isoformat()


def _default_room_guests(adults: int = 2, children: int = 0, child_ages: Optional[list[int]] = None) -> list[dict[str, Any]]:
    room: dict[str, Any] = {"NoOfAdults": max(1, adults), "NoOfChild": max(0, children)}
    if children > 0:
        ages = child_ages or [8] * children
        room["ChildAge"] = [str(a) for a in ages[:children]]
    return [room]


def _price(value: Any) -> Optional[float]:
    if isinstance(value, dict):
        for key in (
            "OfferedPrice",
            "OfferedPriceRoundedOff",
            "PublishedPrice",
            "PublishedPriceRoundedOff",
            "RoomPrice",
            "amount",
            "price",
        ):
            if key in value:
                amount = _price(value.get(key))
                if amount is not None:
                    return amount
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount >= 0 else None


def _hotel_rows(response: Any) -> list[dict[str, Any]]:
    if not isinstance(response, dict):
        return []
    search = response.get("Search") or {}
    if not isinstance(search, dict):
        search = {}
    result = search.get("HotelSearchResult") or response.get("HotelSearchResult") or {}
    if not isinstance(result, dict):
        return []
    rows = result.get("HotelResults") or result.get("HotelResult") or []
    if isinstance(rows, dict):
        rows = [rows]
    return [row for row in rows if isinstance(row, dict)]


def _budget_match(price: float, budget: Optional[str]) -> bool:
    if not budget:
        return True
    key = budget.strip().lower()
    if key in {"low", "budget"}:
        return price <= 150
    if key in {"mid", "medium"}:
        return 100 <= price <= 350
    if key in {"high", "luxury"}:
        return price >= 250
    return True


def _app_reference() -> str:
    stamp = datetime.now(timezone.utc).strftime("%d%m%Y")
    return f"HB-{stamp}-{uuid.uuid4().hex[:6].upper()}"


# ---------------------------------------------------------------------------
# API methods
# ---------------------------------------------------------------------------


async def search_hotels(
    *,
    check_in_date: str,
    no_of_nights: int,
    country_code: str,
    city_id: int,
    guest_nationality: str,
    no_of_rooms: int = 1,
    room_guests: Optional[list[dict[str, Any]]] = None,
) -> dict:
    body = {
        "CheckInDate": check_in_date,
        "NoOfNights": max(1, int(no_of_nights)),
        "CountryCode": country_code,
        "CityId": int(city_id),
        "GuestNationality": guest_nationality,
        "NoOfRooms": max(1, int(no_of_rooms)),
        "RoomGuests": room_guests or _default_room_guests(),
    }
    return await _post("Search", body, timeout=60.0)


async def get_hotel_details(result_token: str) -> dict:
    return await _post("HotelDetails", {"ResultToken": result_token}, timeout=45.0)


async def get_room_list(result_token: str) -> dict:
    return await _post("RoomList", {"ResultToken": result_token}, timeout=45.0)


async def block_room(result_token: str, room_unique_ids: list[str]) -> dict:
    return await _post(
        "BlockRoom",
        {"ResultToken": result_token, "RoomUniqueId": room_unique_ids},
        timeout=60.0,
    )


async def commit_booking(
    *,
    result_token: str,
    block_room_id: str,
    app_reference: str,
    room_details: list[dict[str, Any]],
) -> dict:
    return await _post(
        "CommitBooking",
        {
            "ResultToken": result_token,
            "BlockRoomId": block_room_id,
            "AppReference": app_reference,
            "RoomDetails": room_details,
        },
        timeout=90.0,
    )


async def update_hold_booking(app_reference: str) -> dict:
    return await _post("UpdateHoldBooking", {"AppReference": app_reference}, timeout=45.0)


async def cancel_booking(app_reference: str) -> dict:
    return await _post("CancelBooking", {"AppReference": app_reference}, timeout=45.0)


async def cancellation_refund_details(change_request_id: str | int, app_reference: str) -> dict:
    return await _post(
        "CancellationRefundDetails",
        {"ChangeRequestId": str(change_request_id), "AppReference": app_reference},
        timeout=45.0,
    )


def _room_unique_ids_from_room_list(room_list_response: dict) -> list[str]:
    room_list = room_list_response.get("RoomList") or {}
    result = room_list.get("GetHotelRoomResult") or room_list
    rooms = result.get("HotelRoomsDetails") or []
    if isinstance(rooms, dict):
        rooms = [rooms]
    ids: list[str] = []
    for room in rooms:
        if not isinstance(room, dict):
            continue
        uid = room.get("RoomUniqueId")
        if uid:
            ids.append(str(uid))
    return ids


def _first_room_unique_id(room_list_response: dict) -> Optional[str]:
    ids = _room_unique_ids_from_room_list(room_list_response)
    return ids[0] if ids else None


def _block_room_id(block_response: dict) -> Optional[str]:
    block = block_response.get("BlockRoom") or {}
    result = block.get("BlockRoomResult") or block
    if isinstance(result, dict) and result.get("BlockRoomId"):
        return str(result["BlockRoomId"])
    return None


async def book_hotel(
    *,
    result_token: str,
    room_unique_ids: Optional[list[str]] = None,
    app_reference: Optional[str] = None,
    passenger_details: Optional[list[dict[str, Any]]] = None,
    customer_email: str = "",
    customer_phone: str = "0000000000",
    title: str = "Mr",
    first_name: str = "Traveler",
    last_name: str = "Guest",
) -> dict:
    """Block selected room(s) then commit booking (Travelomatix pathway)."""
    token = result_token
    room_ids = [rid for rid in (room_unique_ids or []) if rid]
    if not room_ids:
        rooms = await get_room_list(token)
        first = _first_room_unique_id(rooms)
        if not first:
            raise RuntimeError("No rooms available for selected hotel")
        room_ids = [first]

    blocked = await block_room(token, room_ids)
    block_id = _block_room_id(blocked)
    if not block_id:
        raise RuntimeError("BlockRoom did not return BlockRoomId")

    if blocked.get("BlockRoom", {}).get("BlockRoomResult", {}).get("IsPriceChanged") is True:
        logger.warning("Travelomatix BlockRoom reported price change for %s", token)

    pax = passenger_details
    if not pax:
        pax = [
            {
                "Title": title,
                "FirstName": first_name,
                "MiddleName": "",
                "LastName": last_name,
                "Phoneno": customer_phone or "0000000000",
                "Email": customer_email or "traveler@travlplanr.local",
                "PaxType": "1",
                "LeadPassenger": True,
                "Age": 30,
            }
        ]

    # One RoomDetails entry per requested room; lead pax on first room only.
    room_details: list[dict[str, Any]] = []
    for index, _room_id in enumerate(room_ids):
        if index == 0:
            room_details.append({"PassengerDetails": pax})
        else:
            lead = dict(pax[0])
            lead["LeadPassenger"] = True
            room_details.append({"PassengerDetails": [lead]})

    reference = app_reference or _app_reference()
    booked = await commit_booking(
        result_token=token,
        block_room_id=block_id,
        app_reference=reference,
        room_details=room_details,
    )
    return {
        "app_reference": reference,
        "block_room_id": block_id,
        "room_unique_ids": room_ids,
        "block_response": blocked,
        "booking_response": booked,
    }


async def search_hotels_travelomatix(
    location: Optional[str],
    budget: Optional[str],
    *,
    date: Optional[str] = None,
) -> list[InventoryItem]:
    if not (has_travelomatix_hotels_credentials() and location):
        return []

    await ensure_city_catalog()
    city = resolve_city(location)
    if not city:
        logger.warning(
            "Travelomatix Hotels: no CityId for location=%r — add it to "
            "travelomatix_cities.json or TRAVELOMATIX_CITY_OVERRIDES",
            location,
        )
        return []

    checkin_tm, nights, checkin_iso, checkout_iso = _default_dates(date)
    try:
        response = await search_hotels(
            check_in_date=checkin_tm,
            no_of_nights=nights,
            country_code=str(city["country_code"]),
            city_id=int(city["city_id"]),
            guest_nationality=TRAVELOMATIX_GUEST_NATIONALITY or str(city["country_code"]),
            no_of_rooms=1,
            room_guests=_default_room_guests(),
        )
    except CircuitBreakerOpen:
        logger.warning("Travelomatix Hotels search skipped — circuit breaker open")
        return []
    except Exception as exc:
        logger.error("Travelomatix Hotels search failed: %s", exc)
        return []

    results: list[InventoryItem] = []
    for row in _hotel_rows(response):
        try:
            hotel_code = str(row.get("HotelCode") or "").strip()
            result_token = str(row.get("ResultToken") or "").strip()
            if not hotel_code or not result_token:
                continue

            price_block = row.get("Price") if isinstance(row.get("Price"), dict) else {}
            price = _price(price_block) or _price(row.get("OfferedPrice"))
            if price is None or not _budget_match(price, budget):
                continue

            title = str(row.get("HotelName") or "Hotel").strip()
            rating_raw = row.get("StarRating") or row.get("trip_rating")
            try:
                rating = float(rating_raw) if rating_raw not in (None, "") else None
            except (TypeError, ValueError):
                rating = None

            amenities = row.get("HotelAmenities") or []
            if not isinstance(amenities, list):
                amenities = []

            currency = str(price_block.get("CurrencyCode") or "INR")
            free_cancel = row.get("Free_cancel_date") or ""
            cancellation = "Free cancellation" if free_cancel else str(row.get("HotelPolicy") or "See policy")

            results.append(
                InventoryItem(
                    id=hotel_code,
                    type="hotel",
                    provider="travelomatix",
                    title=title,
                    price=price,
                    currency=currency,
                    deep_link="",
                    start_time=None,
                    end_time=None,
                    duration=f"{nights} night(s)",
                    image_url=str(row.get("HotelPicture") or "") or None,
                    details={
                        "hotelId": hotel_code,
                        "hotelCode": hotel_code,
                        "resultToken": result_token,
                        "resultIndex": row.get("ResultIndex"),
                        "address": row.get("HotelAddress") or city["city_name"],
                        "location": row.get("HotelAddress") or row.get("HotelLocation") or city["city_name"],
                        "city": city["city_name"],
                        "cityId": city["city_id"],
                        "country": city["country_code"],
                        "countryCode": city["country_code"],
                        "rating": rating,
                        "star_rating": rating,
                        "description": row.get("HotelDescription") or "",
                        "amenities": [str(a).strip() for a in amenities if str(a).strip()],
                        "hotelPromotion": row.get("HotelPromotion"),
                        "hotelPromotionContent": row.get("HotelPromotionContent"),
                        "free_cancel_date": free_cancel,
                        "cancellation": cancellation,
                        "latitude": row.get("Latitude"),
                        "longitude": row.get("Longitude"),
                        "trip_rating": row.get("trip_rating"),
                        "checkin": checkin_iso,
                        "checkout": checkout_iso,
                        "bookable": True,
                    },
                )
            )
        except Exception as exc:
            logger.error("Error parsing Travelomatix hotel result: %s", exc)
            continue

    results.sort(key=lambda item: item.price)
    return results[:20]
