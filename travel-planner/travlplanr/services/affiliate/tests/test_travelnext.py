"""TravelNext flight + car inventory adapter tests (no network)."""
from __future__ import annotations

import httpx
import pytest

import app.adapters.providers.travelnext as travelnext
import app.adapters.providers.travelnext_cars as travelnext_cars

pytestmark = pytest.mark.asyncio


class _FakeResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code
        self.text = str(json_data)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "error",
                request=httpx.Request("POST", "https://example.com"),
                response=httpx.Response(self.status_code),
            )

    def json(self):
        return self._json


class _FakeAsyncClient:
    def __init__(self, handler, *_a, **_kw):
        self._handler = handler

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

    async def post(self, url, **kwargs):
        return self._handler("post", url, kwargs)


@pytest.fixture(autouse=True)
def _tn_creds(monkeypatch):
    monkeypatch.setattr(travelnext, "TRAVELNEXT_USER_ID", "user")
    monkeypatch.setattr(travelnext, "TRAVELNEXT_USER_PASSWORD", "pass")
    monkeypatch.setattr(travelnext, "TRAVELNEXT_IP_ADDRESS", "1.2.3.4")
    monkeypatch.setattr(travelnext, "TRAVELNEXT_ACCESS", "Test")
    monkeypatch.setattr(travelnext, "TRAVELNEXT_IP_AUTODETECT", False)
    monkeypatch.setattr(travelnext, "_egress_ip_cache", None)


async def test_search_flights_defaults_date_and_maps_fields(monkeypatch):
    def handler(_method, url, kwargs):
        assert "availability" in url
        body = kwargs.get("json") or {}
        assert body["OriginDestinationInfo"][0]["departureDate"]
        assert body["OriginDestinationInfo"][0]["airportOriginCode"] == "AMS"
        return _FakeResponse(
            {
                "AirSearchResponse": {
                    "session_id": "sess-1",
                    "AirSearchResult": {
                        "FareItineraries": [
                            {
                                "FareItinerary": {
                                    "OriginDestinationOptions": [
                                        {
                                            "OriginDestinationOption": [
                                                {
                                                    "FlightSegment": {
                                                        "MarketingAirlineCode": "KL",
                                                        "MarketingAirlineName": "KLM",
                                                        "FlightNumber": "1013",
                                                        "DepartureAirportLocationCode": "AMS",
                                                        "ArrivalAirportLocationCode": "LHR",
                                                        "DepartureDateTime": "2026-08-15T17:30:00",
                                                        "ArrivalDateTime": "2026-08-15T17:50:00",
                                                        "JourneyDuration": "80",
                                                        "CabinClassCode": "Y",
                                                    }
                                                }
                                            ]
                                        }
                                    ],
                                    "AirItineraryFareInfo": {
                                        "FareSourceCode": "FARE1",
                                        "IsRefundable": "No",
                                        "FareType": "Public",
                                        "ItinTotalFares": {
                                            "TotalFare": {"Amount": "216.00", "CurrencyCode": "USD"}
                                        },
                                    },
                                }
                            }
                        ]
                    },
                }
            }
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    # No date → adapter should still search (defaults tomorrow).
    results = await travelnext.search_flights("AMS", "LHR", None, "standard")
    assert len(results) == 1
    item = results[0]
    assert item.provider == "travelnext"
    assert item.start_time == "17:30"
    assert item.end_time == "17:50"
    assert item.duration == "1h 20m"
    assert item.details["flight_number"] == "KL1013"
    assert item.details["stops"] == 0
    assert item.details["sessionId"] == "sess-1"
    assert item.details["fareSourceCode"] == "FARE1"
    assert item.price == 216.0


async def test_search_flights_requires_iata_codes(monkeypatch):
    results = await travelnext.search_flights("Amsterdam", "London", "2026-08-15", "standard")
    assert results == []


async def test_resolve_destination_prefers_airport(monkeypatch):
    async def fake_destinations(force_refresh=False):
        return [
            {
                "id": "1",
                "city": "Amsterdam",
                "location_name": "Amsterdam City",
                "isairport": "0",
                "airport_code": "",
            },
            {
                "id": "7085",
                "city": "Amsterdam",
                "location_name": "Amsterdam - Airport - Schiphol (AMS)",
                "isairport": "1",
                "airport_code": "AMS",
                "latitude": "52.3",
                "longitude": "4.7",
            },
        ]

    monkeypatch.setattr(travelnext_cars, "get_destinations", fake_destinations)
    dest = await travelnext_cars.resolve_destination("Amsterdam")
    assert dest is not None
    assert dest["id"] == "7085"

    dest_iata = await travelnext_cars.resolve_destination("AMS")
    assert dest_iata is not None
    assert dest_iata["airport_code"] == "AMS"


async def test_resolve_destination_prefers_primary_city_airport(monkeypatch):
    """City names that collide across countries must pick the primary hub."""

    async def fake_destinations():
        return [
            {
                "id": "1191",
                "city": "London",
                "location_name": "London - Airport, Canada (YXU)",
                "airport_code": "YXU",
                "isairport": "1",
                "country_code": "CA",
            },
            {
                "id": "10113",
                "city": "London Heathrow Apt",
                "location_name": "London - Airport - Heathrow (LHR)",
                "airport_code": "LHR",
                "isairport": "1",
                "country_code": "GB",
            },
            {
                "id": "10011",
                "city": "Gatwick",
                "location_name": "London - Airport - Gatwick (LGW)",
                "airport_code": "LGW",
                "isairport": "1",
                "country_code": "GB",
            },
            {
                "id": "10442",
                "city": "London",
                "location_name": "Euston Station - Downtown",
                "airport_code": "",
                "isairport": "0",
                "country_code": "GB",
            },
        ]

    monkeypatch.setattr(travelnext_cars, "get_destinations", fake_destinations)
    dest = await travelnext_cars.resolve_destination("London")
    assert dest is not None
    assert dest["airport_code"] == "LHR"


async def test_search_cars_maps_rich_details(monkeypatch):
    async def fake_dest(location):
        return {
            "id": "7085",
            "city": "Amsterdam",
            "location_name": "Amsterdam - Airport - Schiphol (AMS)",
            "latitude": "52.3",
            "longitude": "4.7",
            "isairport": "1",
            "airport_code": "AMS",
        }

    async def fake_search(*_a, **_kw):
        return {
            "sessionId": "car-sess",
            "data": [
                {
                    "referenceId": "ref-1",
                    "duration": "2",
                    "fees": {"rateTotalAmount": "155.92", "currencyCode": "USD"},
                    "vendor": {"name": "SIXT"},
                    "pickup": {
                        "date": "2026-08-15",
                        "time": "10:00",
                        "locationName": "Schiphol",
                        "address": "Plaza",
                    },
                    "dropoff": {"date": "2026-08-17", "time": "10:00", "locationName": "Schiphol"},
                    "carDetails": {
                        "sizeName": "SUV",
                        "carModel": "DS 7 Crossback or similar",
                        "passengerQuantity": "5",
                        "baggageQuantity": "4",
                        "transmissionType": "Manual",
                        "fuelType": "Hybrid",
                        "carImage": "https://example.com/car.png",
                        "fuelPolicy": {"description": "Full to full"},
                        "rateDistance": {"vehiclePeriodUnitName": "Unlimited"},
                    },
                }
            ],
        }

    monkeypatch.setattr(travelnext_cars, "resolve_destination", fake_dest)
    monkeypatch.setattr(travelnext_cars, "search_availability", fake_search)
    results = await travelnext_cars.search_cars("Amsterdam", "standard", date="2026-08-15")
    assert len(results) == 1
    car = results[0]
    assert car.provider == "travelnext"
    assert car.price == 155.92
    assert car.image_url
    assert car.start_time == "10:00"
    assert car.details["sessionId"] == "car-sess"
    assert car.details["referenceId"] == "ref-1"
    assert car.details["passengers"] == 5
    assert car.details["bags"] == 4
    assert car.details["supplier_name"] == "SIXT"


async def test_normalize_reissue_pax_details_maps_type_and_cabin():
    out = travelnext.normalize_reissue_pax_details(
        [
            {
                "passengerType": "adult",
                "title": "Mr",
                "firstName": "Test",
                "lastName": "Traveler",
                "eTicket": "000",
            }
        ]
    )
    assert out[0]["type"] == "ADT"
    assert out[0]["cabinPreference"] == "Economy"
    assert "passengerType" not in out[0]

    out2 = travelnext.normalize_reissue_pax_details(
        [{"type": "CHD", "cabin_preference": "Business", "title": "Ms", "firstName": "A", "lastName": "B", "eTicket": "1"}]
    )
    assert out2[0]["type"] == "CHD"
    assert out2[0]["cabinPreference"] == "Business"
    assert "cabin_preference" not in out2[0]


async def test_normalize_reissue_origin_destination_aliases():
    out = travelnext.normalize_reissue_origin_destination(
        [
            {
                "departureDate": "2026-08-21",
                "airportOriginCode": "DEL",
                "airportDestinationCode": "BOM",
                "FlightNumber": "101",
                "marketingAirline": "AI",
            }
        ]
    )
    assert out[0]["cabinPreference"] == "Economy"
    assert out[0]["flightNumber"] == "101"
    assert out[0]["airlineCode"] == "AI"
    assert "FlightNumber" not in out[0]
    assert "marketingAirline" not in out[0]


async def test_reissue_ticket_quote_sends_normalized_payload(monkeypatch):
    captured = {}

    async def fake_post(path, body, timeout=30.0):
        captured["path"] = path
        captured["body"] = body
        return {"ReissueQuoteResponse": {"Errors": [{"ErrorMessage": "Invalid UniqueID"}]}}

    monkeypatch.setattr(travelnext, "_post", fake_post)
    await travelnext.reissue_ticket_quote(
        "TEST-UID",
        [{"paxType": "ADT", "title": "Mr", "firstName": "T", "lastName": "T", "eTicket": "0"}],
        [
            {
                "departureDate": "2026-08-21",
                "airportOriginCode": "DEL",
                "airportDestinationCode": "BOM",
                "flight_number": "101",
                "airline_code": "AI",
            }
        ],
    )
    assert captured["path"] == "reissue_ticket_quote"
    pax = captured["body"]["paxDetails"][0]
    odi = captured["body"]["OriginDestinationInfo"][0]
    assert pax["type"] == "ADT"
    assert pax["cabinPreference"] == "Economy"
    assert odi["cabinPreference"] == "Economy"
    assert odi["flightNumber"] == "101"
    assert odi["airlineCode"] == "AI"


# --------------------------------------------------------------------------
# Error handling
# --------------------------------------------------------------------------

async def test_post_raises_on_error_field_in_response(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"error": "Invalid session"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(RuntimeError, match="Invalid session"):
        await travelnext.cancel_booking("bad-id")


async def test_post_raises_on_http_error_status(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"detail": "boom"}, status_code=500)

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(httpx.HTTPStatusError):
        await travelnext.cancel_booking("bad-id")


async def test_post_raises_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(travelnext, "TRAVELNEXT_USER_ID", None)
    with pytest.raises(RuntimeError, match="credentials"):
        await travelnext.cancel_booking("bad-id")
