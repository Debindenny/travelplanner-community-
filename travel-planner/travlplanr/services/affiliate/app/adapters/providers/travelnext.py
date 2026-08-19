"""TravelNext (aeroVE5) flight API adapter.

Covers the full documented surface: search (one-way/return/multi-city, with
branded fares), revalidate, extra services, fare rules, booking, ticketing,
trip details, cancel, booking notes, airport/airline reference lists, and the
async post-transaction (PTR) flows — void, refund, reissue (quote + execute),
tracked via search_post_ticket_status.

`revalidate`, `extra_services`, `fare_rules`, and `booking` ride on the search
session (no auth block) — everything else (`ticket_order`, `trip_details`,
`cancel`, `booking_notes`, the airport/airline lists, the PTR endpoints)
requires the full `user_id`/`user_password`/`access`/`ip_address` block.

Booking wire format (provider docs):
  flightBookingInfo.flight_session_id, fare_source_code, fareType (string:
  Public|Private|WebFare), IsPassportMandatory, areaCode, countryCode
  paxInfo.customerEmail, customerPhone, paxDetails[{adult|child|infant}]
  with parallel field arrays (title[], firstName[], ...).
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

from app.schemas.inventory import InventoryItem

logger = logging.getLogger(__name__)

TRAVELNEXT_USER_ID = os.environ.get("TRAVELNEXT_USER_ID")
TRAVELNEXT_USER_PASSWORD = os.environ.get("TRAVELNEXT_USER_PASSWORD")
TRAVELNEXT_ACCESS = os.environ.get("TRAVELNEXT_ACCESS") or "Test"
TRAVELNEXT_IP_ADDRESS = os.environ.get("TRAVELNEXT_IP_ADDRESS")
# When true (default), prefer the container's egress IP over TRAVELNEXT_IP_ADDRESS.
# TravelNext Events validates that the supplied ip_address matches the caller.
TRAVELNEXT_IP_AUTODETECT = os.environ.get("TRAVELNEXT_IP_AUTODETECT", "true").lower() in (
    "1",
    "true",
    "yes",
)
TRAVELNEXT_API_BASE_URL = (
    os.environ.get("TRAVELNEXT_API_BASE_URL") or "https://travelnext.works/api/aeroVE5"
).rstrip("/")

_egress_ip_cache: Optional[str] = None

# Search `fareType` filter ints → booking fareType strings (provider booking docs).
_FARE_TYPE_INT_TO_STR = {
    1: "Public",
    2: "Private",
    3: "WebFare",
    4: "Public",
}
_FARE_TYPE_ALIASES = {
    "public": "Public",
    "private": "Private",
    "webfare": "WebFare",
    "web fare": "WebFare",
    "web_fare": "WebFare",
}

_travelnext_breaker = CircuitBreaker(name="travelnext", failure_threshold=5, recovery_timeout=60.0)

# In-process caches for the two reference-data endpoints — the provider's own
# docs recommend caching these for a month rather than calling per-search.
_airport_list_cache: list[dict] | None = None
_airline_list_cache: list[dict] | None = None


def has_travelnext_credentials() -> bool:
    return bool(TRAVELNEXT_USER_ID and TRAVELNEXT_USER_PASSWORD and (TRAVELNEXT_IP_ADDRESS or TRAVELNEXT_IP_AUTODETECT))


def get_travelnext_ip() -> str:
    """Return the IP TravelNext auth should send.

    Prefers live egress detection when TRAVELNEXT_IP_AUTODETECT is enabled, so
    strict products (Events) see a matching caller IP. Falls back to the
    configured TRAVELNEXT_IP_ADDRESS.
    """
    global _egress_ip_cache
    configured = (TRAVELNEXT_IP_ADDRESS or "").strip()
    if not TRAVELNEXT_IP_AUTODETECT:
        return configured
    if _egress_ip_cache:
        return _egress_ip_cache
    try:
        import urllib.request

        with urllib.request.urlopen("https://api.ipify.org", timeout=5) as response:
            detected = response.read().decode().strip()
        if detected:
            if configured and detected != configured:
                logger.warning(
                    "TravelNext IP autodetect: configured %s but egress is %s — using egress",
                    configured,
                    detected,
                )
            _egress_ip_cache = detected
            return detected
    except Exception as exc:
        logger.warning("TravelNext IP autodetect failed: %s", exc)
    return configured


def _auth_block() -> dict:
    return {
        "user_id": TRAVELNEXT_USER_ID,
        "user_password": TRAVELNEXT_USER_PASSWORD,
        "access": TRAVELNEXT_ACCESS,
        "ip_address": get_travelnext_ip(),
    }


async def _request_with_retry(
    request_fn,
    *,
    label: str,
    retries: int = 3,
) -> httpx.Response:
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
    """POST to a TravelNext endpoint, wrapped in the circuit breaker + retry."""
    if not has_travelnext_credentials():
        raise RuntimeError("TravelNext credentials are not configured")

    url = f"{TRAVELNEXT_API_BASE_URL}/{path.lstrip('/')}"

    async def _call() -> dict:
        async with httpx.AsyncClient() as client:
            response = await _request_with_retry(
                lambda: client.post(url, json=body, timeout=timeout),
                label=f"TravelNext {path}",
            )
            if response.status_code >= 400:
                logger.error("TravelNext %s returned %s: %s", path, response.status_code, response.text[:500])
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(f"TravelNext {path} error: {data['error']}")
            return data

    return await _travelnext_breaker.call(_call)


def _amount(node: Optional[dict]) -> Optional[float]:
    if not node:
        return None
    try:
        return float(node.get("Amount"))
    except (TypeError, ValueError):
        return None


def normalize_fare_type(value: Any) -> Optional[str]:
    """Normalize provider fare-type values to booking strings."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return _FARE_TYPE_INT_TO_STR.get(int(value))
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return _FARE_TYPE_INT_TO_STR.get(int(text))
    return _FARE_TYPE_ALIASES.get(text.lower(), text)


def _extract_fare_type(itinerary: dict, fare_info: dict) -> Optional[str]:
    for source in (fare_info, itinerary):
        for key in ("FareType", "fareType", "FareTypeName", "FareFamily", "FareCategory"):
            normalized = normalize_fare_type(source.get(key))
            if normalized:
                return normalized
    return None


def _passenger_field(passenger: dict, *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in passenger and passenger[key] not in (None, ""):
            return passenger[key]
    return default


def _pack_passenger_group(passengers: list[dict]) -> dict:
    """Convert list-of-passenger objects into provider parallel-array shape."""
    fields = (
        ("title", ("title", "Title")),
        ("firstName", ("firstName", "FirstName", "first_name")),
        ("lastName", ("lastName", "LastName", "last_name")),
        ("dob", ("dob", "DateOfBirth", "dateOfBirth", "date_of_birth")),
        ("nationality", ("nationality", "Nationality", "passengerNationality", "PassengerNationality")),
        ("passportNo", ("passportNo", "passportNumber", "PassportNumber", "passengerPassportNo", "PassportNo")),
        ("passportIssueCountry", ("passportIssueCountry", "PassportIssueCountry")),
        ("passportExpiryDate", ("passportExpiryDate", "PassportExpiryDate")),
        ("passportIssueDate", ("passportIssueDate", "PassportIssueDate", "passportDOI")),
    )
    packed: dict[str, list] = {name: [] for name, _ in fields}
    for passenger in passengers:
        for name, aliases in fields:
            packed[name].append(_passenger_field(passenger, *aliases, default=""))
        # Drop empty optional passport columns later if entirely blank
    # Remove optional passport fields when every value is blank
    for optional in ("passportNo", "passportIssueCountry", "passportExpiryDate", "passportIssueDate"):
        if packed[optional] and all(v == "" for v in packed[optional]):
            del packed[optional]
    return packed


def normalize_flight_booking_info(info: dict) -> dict:
    """Map camelCase/aliases → provider booking keys (flight_session_id, etc.)."""
    if not isinstance(info, dict):
        raise ValueError("flightBookingInfo must be an object")

    out = dict(info)

    session = (
        out.get("flight_session_id")
        or out.get("session_id")
        or out.get("sessionId")
        or out.get("flightSessionId")
    )
    if session:
        out["flight_session_id"] = session

    fare_code = out.get("fare_source_code") or out.get("fareSourceCode")
    if fare_code:
        out["fare_source_code"] = fare_code

    inbound = out.get("fare_source_code_inbound") or out.get("fareSourceCodeInbound")
    if inbound:
        out["fare_source_code_inbound"] = inbound

    fare_type = normalize_fare_type(
        out.get("fareType") or out.get("FareType") or out.get("fare_type")
    )
    if fare_type:
        out["fareType"] = fare_type

    passport_mandatory = out.get("IsPassportMandatory")
    if passport_mandatory is None:
        passport_mandatory = out.get("isPassportMandatory")
    if passport_mandatory is None:
        passport_mandatory = True
    if isinstance(passport_mandatory, bool):
        out["IsPassportMandatory"] = "true" if passport_mandatory else "false"
    else:
        out["IsPassportMandatory"] = str(passport_mandatory).lower()

    if not out.get("areaCode"):
        out["areaCode"] = out.get("area_code") or "080"
    if not out.get("countryCode"):
        out["countryCode"] = out.get("country_code") or "91"

    # Drop non-wire aliases so the provider does not reject unknown keys.
    for alias in (
        "session_id",
        "sessionId",
        "flightSessionId",
        "fareSourceCode",
        "fareSourceCodeInbound",
        "fare_type",
        "FareType",
        "isPassportMandatory",
        "area_code",
        "country_code",
    ):
        out.pop(alias, None)

    missing = [
        name
        for name in ("flight_session_id", "fare_source_code", "fareType")
        if not out.get(name)
    ]
    if missing:
        raise ValueError(f"flightBookingInfo missing required fields: {', '.join(missing)}")
    return out


def normalize_pax_info(pax_info: dict) -> dict:
    """Accept provider shape or a simplified adults/children/infants list shape."""
    if not isinstance(pax_info, dict):
        raise ValueError("paxInfo must be an object")

    out = dict(pax_info)

    # Already in provider shape
    if "paxDetails" in out:
        if not out.get("customerEmail"):
            out["customerEmail"] = out.get("email") or out.get("customer_email")
        if not out.get("customerPhone"):
            out["customerPhone"] = out.get("phone") or out.get("customer_phone") or out.get("mobileno")
        if not out.get("customerEmail") or not out.get("customerPhone"):
            raise ValueError("paxInfo requires customerEmail and customerPhone")
        return out

    adults = out.get("adults") or out.get("Adults") or []
    children = out.get("childs") or out.get("children") or out.get("child") or out.get("Children") or []
    infants = out.get("infants") or out.get("infant") or out.get("Infants") or []
    if not isinstance(adults, list) or not adults:
        raise ValueError("paxInfo requires at least one adult (adults[] or paxDetails)")

    first_adult = adults[0] if isinstance(adults[0], dict) else {}
    customer_email = (
        out.get("customerEmail")
        or out.get("email")
        or out.get("customer_email")
        or _passenger_field(first_adult, "email", "EmailAddress", "customerEmail")
    )
    customer_phone = (
        out.get("customerPhone")
        or out.get("phone")
        or out.get("customer_phone")
        or out.get("mobileno")
        or _passenger_field(first_adult, "phone", "PhoneNumber", "mobileno", "customerPhone")
    )
    if not customer_email or not customer_phone:
        raise ValueError("paxInfo requires customerEmail and customerPhone")

    details: dict[str, Any] = {"adult": _pack_passenger_group(adults)}
    details["child"] = _pack_passenger_group(children) if children else {
        "title": [], "firstName": [], "lastName": [], "dob": [], "nationality": []
    }
    details["infant"] = _pack_passenger_group(infants) if infants else {
        "title": [], "firstName": [], "lastName": [], "dob": [], "nationality": []
    }

    normalized = {
        "customerEmail": customer_email,
        "customerPhone": str(customer_phone),
        "paxDetails": [details],
    }
    for optional in ("clientRef", "postCode", "bookingNote", "BookingNote"):
        if out.get(optional):
            key = "bookingNote" if optional == "BookingNote" else optional
            normalized[key] = out[optional]
    return normalized


_REISSUE_PAX_TYPE_ALIASES = (
    "type",
    "Type",
    "passengerType",
    "PassengerType",
    "paxType",
    "PaxType",
    "passenger_type",
)
_REISSUE_PAX_TYPE_MAP = {
    "adt": "ADT",
    "adult": "ADT",
    "a": "ADT",
    "1": "ADT",
    "chd": "CHD",
    "child": "CHD",
    "c": "CHD",
    "2": "CHD",
    "inf": "INF",
    "infant": "INF",
    "i": "INF",
    "3": "INF",
}


def normalize_reissue_pax_type(value: Any, default: str = "ADT") -> str:
    """Map common passenger-type aliases → provider wire value (ADT|CHD|INF)."""
    if value is None or value == "":
        return default
    raw = str(value).strip()
    mapped = _REISSUE_PAX_TYPE_MAP.get(raw.lower())
    if mapped:
        return mapped
    upper = raw.upper()
    if upper in ("ADT", "CHD", "INF"):
        return upper
    return default


def normalize_reissue_pax_details(pax_details: list[dict], default_cabin: str = "Economy") -> list[dict]:
    """Ensure each reissue passenger includes provider-required `type` + cabinPreference.

    Live sandbox accepts passenger type only as `type` (ADT|CHD|INF). Aliases such as
    passengerType / paxType / Type are normalized here. cabinPreference on the
    passenger is kept for compatibility; reissue_ticket_quote also requires
    cabinPreference (and flightNumber / airlineCode) on OriginDestinationInfo.
    """
    normalized: list[dict] = []
    for entry in pax_details:
        item = dict(entry)
        pax_type = None
        for key in _REISSUE_PAX_TYPE_ALIASES:
            if item.get(key) not in (None, ""):
                pax_type = item.get(key)
                break
        item["type"] = normalize_reissue_pax_type(pax_type)

        cabin = item.get("cabinPreference") or item.get("cabin_preference") or item.get("class") or default_cabin
        item["cabinPreference"] = cabin

        for alias in (
            "Type",
            "passengerType",
            "PassengerType",
            "paxType",
            "PaxType",
            "passenger_type",
            "cabin_preference",
        ):
            item.pop(alias, None)
        normalized.append(item)
    return normalized


def normalize_reissue_origin_destination(
    origin_destination_info: list[dict], default_cabin: str = "Economy"
) -> list[dict]:
    """Normalize reissue segments; ensure cabinPreference and common flight aliases.

    After `type` on paxDetails, the sandbox validates on each ODI segment:
      cabinPreference → flightNumber → airlineCode
    (further fields may still be required for a real UniqueID quote).
    """
    if not isinstance(origin_destination_info, list) or not origin_destination_info:
        raise ValueError("OriginDestinationInfo must be a non-empty list")

    normalized: list[dict] = []
    for entry in origin_destination_info:
        if not isinstance(entry, dict):
            raise ValueError("OriginDestinationInfo entries must be objects")
        item = dict(entry)
        cabin = (
            item.get("cabinPreference")
            or item.get("cabin_preference")
            or item.get("class")
            or item.get("cabinClass")
            or default_cabin
        )
        item["cabinPreference"] = cabin

        flight_number = (
            item.get("flightNumber")
            or item.get("FlightNumber")
            or item.get("flight_number")
            or item.get("flightNo")
        )
        if flight_number not in (None, ""):
            item["flightNumber"] = str(flight_number)

        airline_code = (
            item.get("airlineCode")
            or item.get("AirlineCode")
            or item.get("airline_code")
            or item.get("airline")
            or item.get("marketingAirline")
            or item.get("MarketingAirlineCode")
        )
        if airline_code not in (None, ""):
            item["airlineCode"] = str(airline_code)

        for alias in (
            "cabin_preference",
            "cabinClass",
            "FlightNumber",
            "flight_number",
            "flightNo",
            "AirlineCode",
            "airline_code",
            "airline",
            "marketingAirline",
            "MarketingAirlineCode",
        ):
            item.pop(alias, None)
        normalized.append(item)
    return normalized


# --------------------------------------------------------------------------
# Search (Flight Availability) — supports OneWay / Return / Circle
# --------------------------------------------------------------------------

async def search_availability(
    journey_type: str,
    origin_destination_info: list[dict],
    *,
    cabin_class: str = "Economy",
    adults: int = 1,
    childs: int = 0,
    infants: int = 0,
    airline_code: Optional[str] = None,
    direct_flight: Optional[int] = None,
    multiple_branded_fares: Optional[bool] = None,
    fare_type: Optional[int] = None,
    required_currency: str = "USD",
) -> dict:
    """Rich search entry point — returns the raw (lightly-unwrapped) AirSearchResponse."""
    body: dict[str, Any] = {
        **_auth_block(),
        "requiredCurrency": required_currency,
        "journeyType": journey_type,
        "OriginDestinationInfo": origin_destination_info,
        "class": cabin_class,
        "adults": adults,
        "childs": childs,
        "infants": infants,
    }
    if airline_code:
        body["airlineCode"] = airline_code
    if direct_flight is not None:
        body["directFlight"] = direct_flight
    if multiple_branded_fares is not None:
        body["multipleBrandedFares"] = multiple_branded_fares
    if fare_type is not None:
        body["fareType"] = fare_type

    data = await _post("availability", body)
    return data.get("AirSearchResponse", data)


def _extract_itineraries(air_search_response: dict) -> list[dict]:
    """FareItineraries is sometimes a list, sometimes a single dict — normalize to a list."""
    result = air_search_response.get("AirSearchResult") or {}
    itineraries = result.get("FareItineraries")
    if itineraries is None:
        return []
    if isinstance(itineraries, dict):
        itineraries = [itineraries]
    return itineraries


def _collect_segments(itinerary_wrapper: dict) -> list[dict]:
    itinerary = itinerary_wrapper.get("FareItinerary") or {}
    od_options = itinerary.get("OriginDestinationOptions") or []
    all_segments: list[dict] = []
    for od in od_options:
        for opt in od.get("OriginDestinationOption") or []:
            seg = opt.get("FlightSegment")
            if seg:
                all_segments.append(seg)
    return all_segments


def _first_segment_and_fare(
    itinerary_wrapper: dict, all_segments: list[dict]
) -> tuple[Optional[dict], Optional[dict], Optional[dict]]:
    """Return (first FlightSegment, last FlightSegment, chosen AirItineraryFareInfo) for one FareItinerary entry.

    `all_segments` must be `_collect_segments(itinerary_wrapper)` — passed in
    rather than recomputed since callers already have it.
    """
    if not all_segments:
        return None, None, None

    itinerary = itinerary_wrapper.get("FareItinerary") or {}
    fare_info = itinerary.get("AirItineraryFareInfo")
    if not fare_info:
        branded = itinerary.get("BrandedFares") or []
        if branded:
            fare_info = branded[0].get("AirItineraryFareInfo")

    return all_segments[0], all_segments[-1], fare_info


def _format_duration(minutes: Any) -> Optional[str]:
    try:
        total = int(minutes)
    except (TypeError, ValueError):
        return None
    hours, mins = divmod(total, 60)
    return f"{hours}h {mins}m" if mins else f"{hours}h"


def _time_hhmm(value: Any) -> Optional[str]:
    """Normalize TravelNext ISO datetimes to HH:MM for the UI."""
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    if "T" in text:
        text = text.split("T", 1)[1]
    text = text[:5]
    return text if len(text) == 5 else None


def _default_departure_date(date: Optional[str]) -> str:
    """Use an explicit YYYY-MM-DD date, or tomorrow when the UI omits one."""
    if date:
        try:
            return datetime.strptime(date[:10], "%Y-%m-%d").date().isoformat()
        except ValueError:
            pass
    return (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()


async def search_flights(
    dep: Optional[str], arr: Optional[str], date: Optional[str], budget: Optional[str]
) -> list[InventoryItem]:
    """Narrow one-way/1-adult search, matching the existing provider signature
    so it drops straight into inventory_manager."""
    del budget  # TravelNext fare class filtering is cabin-based; keep Economy default.
    if not (has_travelnext_credentials() and dep and arr and len(dep) == 3 and len(arr) == 3):
        return []

    departure_date = _default_departure_date(date)

    try:
        response = await search_availability(
            "OneWay",
            [
                {
                    "departureDate": departure_date,
                    "airportOriginCode": dep.upper(),
                    "airportDestinationCode": arr.upper(),
                }
            ],
            adults=1,
        )
    except CircuitBreakerOpen:
        logger.warning("TravelNext flight search skipped — circuit breaker open")
        return []
    except Exception as exc:
        logger.error("TravelNext flight search failed: %s", exc)
        return []

    results: list[InventoryItem] = []
    session_id = response.get("session_id") or response.get("sessionId")
    for entry in _extract_itineraries(response):
        try:
            segments = _collect_segments(entry)
            first_seg, last_seg, fare_info = _first_segment_and_fare(entry, segments)
            if not first_seg or not fare_info:
                continue
            total_fare = _amount((fare_info.get("ItinTotalFares") or {}).get("TotalFare"))
            if total_fare is None:
                continue
            currency = ((fare_info.get("ItinTotalFares") or {}).get("TotalFare") or {}).get("CurrencyCode", "USD")
            airline_code = first_seg.get("MarketingAirlineCode") or ""
            carrier = first_seg.get("MarketingAirlineName") or airline_code or "Unknown"
            flight_number = str(
                first_seg.get("FlightNumber")
                or (first_seg.get("OperatingAirline") or {}).get("FlightNumber")
                or ""
            )
            flight_label = f"{airline_code}{flight_number}".strip() or f"{carrier} Flight"
            stops = max(0, len(segments) - 1)
            itinerary = entry.get("FareItinerary") or {}
            fare_type = _extract_fare_type(itinerary, fare_info)
            fare_source = fare_info.get("FareSourceCode")
            cabin = first_seg.get("CabinClassText") or first_seg.get("CabinClassCode") or "Economy"
            refundable = fare_info.get("IsRefundable")
            if isinstance(refundable, bool):
                refundable_label = "Refundable" if refundable else "Non-Refundable"
            else:
                refundable_label = str(refundable or "See fare rules")

            results.append(InventoryItem(
                id=str(uuid.uuid4()),
                type="flight",
                provider="travelnext",
                title=f"{carrier} {flight_label} {dep.upper()} → {arr.upper()}".strip(),
                price=total_fare,
                currency=currency,
                # Booking is API-session based (sessionId + fareSourceCode), not a public URL.
                deep_link="",
                start_time=_time_hhmm(first_seg.get("DepartureDateTime")),
                end_time=_time_hhmm((last_seg or first_seg).get("ArrivalDateTime")),
                duration=_format_duration(first_seg.get("JourneyDuration")),
                details={
                    "carrier": carrier,
                    "airline": carrier,
                    "airline_code": airline_code,
                    "flight_number": flight_label,
                    "depCode": first_seg.get("DepartureAirportLocationCode", dep.upper()),
                    "arrCode": (last_seg or first_seg).get("ArrivalAirportLocationCode", arr.upper()),
                    "origin": first_seg.get("DepartureAirportLocationCode", dep.upper()),
                    "destination": (last_seg or first_seg).get("ArrivalAirportLocationCode", arr.upper()),
                    "departure_date": departure_date,
                    "departure_datetime": first_seg.get("DepartureDateTime"),
                    "arrival_datetime": (last_seg or first_seg).get("ArrivalDateTime"),
                    "stops": stops,
                    "stops_label": "Direct" if stops == 0 else f"{stops} Stop{'s' if stops != 1 else ''}",
                    "cabin_class": str(cabin).title() if cabin else "Economy",
                    "fareSourceCode": fare_source,
                    "sessionId": session_id,
                    "flightSessionId": session_id,
                    "fareType": fare_type,
                    "refundable": refundable_label,
                    "bookable": True,
                },
            ))
        except Exception as exc:
            logger.error("Error parsing TravelNext itinerary: %s", exc)
            continue

    results.sort(key=lambda item: item.price)
    return results[:20]


# --------------------------------------------------------------------------
# Revalidate / Extra Services / Fare Rules — session-scoped, no auth block
# --------------------------------------------------------------------------

async def revalidate(
    session_id: str, fare_source_code: str, fare_source_code_inbound: Optional[str] = None
) -> dict:
    body: dict[str, Any] = {"session_id": session_id, "fare_source_code": fare_source_code}
    if fare_source_code_inbound:
        body["fare_source_code_inbound"] = fare_source_code_inbound
    data = await _post("revalidate", body)
    return data.get("AirRevalidateResponse", data)


async def get_extra_services(session_id: str, fare_source_code: str) -> dict:
    data = await _post("extra_services", {"session_id": session_id, "fare_source_code": fare_source_code})
    return data.get("ExtraServicesResponse", data)


async def get_fare_rules(
    session_id: str, fare_source_code: str, fare_source_code_inbound: Optional[str] = None
) -> dict:
    body: dict[str, Any] = {"session_id": session_id, "fare_source_code": fare_source_code}
    if fare_source_code_inbound:
        body["fare_source_code_inbound"] = fare_source_code_inbound
    data = await _post("fare_rules", body)
    return data.get("FareRules1_1Response", data)


# --------------------------------------------------------------------------
# Booking / Ticketing / Trip Details
# --------------------------------------------------------------------------

async def create_booking(flight_booking_info: dict, pax_info: dict) -> dict:
    body = {
        "flightBookingInfo": normalize_flight_booking_info(flight_booking_info),
        "paxInfo": normalize_pax_info(pax_info),
    }
    data = await _post("booking", body, timeout=60.0)
    return data.get("BookFlightResponse", data)


async def issue_ticket(unique_id: str) -> dict:
    data = await _post("ticket_order", {**_auth_block(), "UniqueID": unique_id}, timeout=60.0)
    return data.get("AirOrderTicketRS", data)


async def get_trip_details(unique_id: str) -> dict:
    data = await _post("trip_details", {**_auth_block(), "UniqueID": unique_id})
    return data.get("TripDetailsResponse", data)


# --------------------------------------------------------------------------
# Post-booking servicing
# --------------------------------------------------------------------------

async def cancel_booking(unique_id: str) -> dict:
    data = await _post("cancel", {**_auth_block(), "UniqueID": unique_id})
    return data.get("CancelBookingResponse", data)


async def add_booking_notes(unique_id: str, notes: str) -> dict:
    data = await _post("booking_notes", {**_auth_block(), "UniqueID": unique_id, "notes": notes})
    return data.get("BookingNotesResponse", data)


async def get_post_ticket_status(unique_id: str, ptr_unique_id: str) -> dict:
    data = await _post(
        "search_post_ticket_status", {**_auth_block(), "UniqueID": unique_id, "ptrUniqueID": ptr_unique_id}
    )
    return data.get("PtrResponse", data)


async def void_ticket_quote(unique_id: str, pax_details: list[dict]) -> dict:
    data = await _post("void_ticket_quote", {**_auth_block(), "UniqueID": unique_id, "paxDetails": pax_details})
    return data.get("VoidQuoteResponse", data)


async def void_ticket(unique_id: str, pax_details: list[dict], remark: Optional[str] = None) -> dict:
    body = {**_auth_block(), "UniqueID": unique_id, "paxDetails": pax_details}
    if remark:
        body["remark"] = remark
    data = await _post("void_ticket", body)
    return data.get("VoidQuoteResponse", data)


async def refund_ticket_quote(unique_id: str, pax_details: list[dict], remark: Optional[str] = None) -> dict:
    body = {**_auth_block(), "UniqueID": unique_id, "paxDetails": pax_details}
    if remark:
        body["remark"] = remark
    data = await _post("refund_quote", body)
    return data.get("RefundQuoteResponse", data)


async def refund_ticket(unique_id: str, pax_details: list[dict], remark: Optional[str] = None) -> dict:
    body = {**_auth_block(), "UniqueID": unique_id, "paxDetails": pax_details}
    if remark:
        body["remark"] = remark
    data = await _post("refund", body)
    return data.get("RefundResponse", data)


async def reissue_ticket_quote(unique_id: str, pax_details: list[dict], origin_destination_info: list[dict]) -> dict:
    data = await _post(
        "reissue_ticket_quote",
        {
            **_auth_block(),
            "UniqueID": unique_id,
            "paxDetails": normalize_reissue_pax_details(pax_details),
            "OriginDestinationInfo": normalize_reissue_origin_destination(origin_destination_info),
        },
    )
    return data.get("ReissueQuoteResponse", data)


async def reissue_ticket(
    unique_id: str, ptr_unique_id: str, preference_option: int, remark: Optional[str] = None
) -> dict:
    body = {
        **_auth_block(),
        "UniqueID": unique_id,
        "ptrUniqueID": ptr_unique_id,
        "PreferenceOption": preference_option,
    }
    if remark:
        body["remark"] = remark
    data = await _post("reissue_ticket", body)
    return data.get("ReissueResponse", data)


# --------------------------------------------------------------------------
# Reference data — cached in-process, refresh manually/periodically
# --------------------------------------------------------------------------

async def get_airport_list(force_refresh: bool = False) -> list[dict]:
    global _airport_list_cache
    if _airport_list_cache is not None and not force_refresh:
        return _airport_list_cache
    data = await _post("airport_list", _auth_block())
    _airport_list_cache = data if isinstance(data, list) else data.get("AirportList", [])
    return _airport_list_cache


async def get_airline_list(force_refresh: bool = False) -> list[dict]:
    global _airline_list_cache
    if _airline_list_cache is not None and not force_refresh:
        return _airline_list_cache
    data = await _post("airline_list", _auth_block())
    _airline_list_cache = data if isinstance(data, list) else data.get("AirlineList", [])
    return _airline_list_cache
