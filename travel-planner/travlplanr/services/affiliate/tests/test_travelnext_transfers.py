"""TravelNext Transfers adapter tests (no network)."""
from __future__ import annotations

import httpx
import pytest

import app.adapters.providers.travelnext as travelnext
import app.adapters.providers.travelnext_transfers as travelnext_transfers

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
    monkeypatch.setattr(travelnext_transfers, "TRAVELNEXT_USER_ID", "user")
    monkeypatch.setattr(travelnext_transfers, "TRAVELNEXT_USER_PASSWORD", "pass")
    monkeypatch.setattr(travelnext_transfers, "TRAVELNEXT_ACCESS", "Test")


# --------------------------------------------------------------------------
# Destinations
# --------------------------------------------------------------------------

async def test_search_destinations_posts_expected_body(monkeypatch):
    def handler(_method, url, kwargs):
        assert "destinations_auto" in url
        body = kwargs.get("json") or {}
        assert body["destination"] == "Malaga"
        assert body["user_id"] == "user"
        return _FakeResponse(
            [
                {
                    "id": "1234",
                    "longitude": "-4.4213",
                    "latitude": "36.7213",
                    "place": "Malaga Airport",
                    "country": "Spain",
                    "city": "Malaga",
                    "locationCode": "AGP",
                }
            ]
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_transfers.search_destinations("Malaga")
    assert data[0]["locationCode"] == "AGP"


async def test_search_destinations_unwraps_dict_response(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"destinations": [{"id": "1", "place": "X"}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_transfers.search_destinations("X")
    assert data == [{"id": "1", "place": "X"}]


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------

async def test_search_transfers_posts_required_fields(monkeypatch):
    def handler(_method, url, kwargs):
        assert url.endswith("/search")
        body = kwargs.get("json") or {}
        assert body["journey_type"] == "OneWay"
        assert body["pickup_location"] == "Malaga Airport"
        assert body["dropoff_location"] == "Marbella Hotel"
        assert body["adults"] == 2
        assert body["children"] == 0
        assert body["infants"] == 0
        assert body["search_currency"] == "USD"
        assert "arrival_date" not in body
        return _FakeResponse(
            {
                "sessionId": "sess-123",
                "searchResult": "Success",
                "travelling": {
                    "products": [
                        {
                            "general": {"productId": "p1", "productName": "Sedan"},
                            "pricing": {"totalPrice": "45.00", "currency": "USD"},
                        }
                    ]
                },
            }
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_transfers.search_transfers(
        "OneWay", "Malaga Airport", "Marbella Hotel", 2
    )
    assert data["sessionId"] == "sess-123"
    assert data["travelling"]["products"][0]["general"]["productId"] == "p1"


async def test_search_transfers_includes_optional_airport_leg_fields(monkeypatch):
    def handler(_method, url, kwargs):
        body = kwargs.get("json") or {}
        assert body["arrival_date"] == "2026-08-01"
        assert body["arrival_time"] == "14:30"
        return _FakeResponse({"sessionId": "sess-456", "travelling": {"products": []}})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    await travelnext_transfers.search_transfers(
        "OneWay",
        "Malaga Airport",
        "Marbella Hotel",
        2,
        arrival_date="2026-08-01",
        arrival_time="14:30",
    )


async def test_search_transfers_includes_geo_code_fields(monkeypatch):
    def handler(_method, url, kwargs):
        body = kwargs.get("json") or {}
        assert body["pickup_location_code"] == "AGP"
        assert body["pickup_location_type"] == "airport"
        assert body["dropoff_location_code"] == "MRB"
        assert body["dropoff_location_type"] == "hotel"
        return _FakeResponse({"sessionId": "sess-789", "travelling": {"products": []}})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    await travelnext_transfers.search_transfers(
        "Return",
        "Malaga Airport",
        "Marbella Hotel",
        2,
        pickup_location_code="AGP",
        pickup_location_type="airport",
        dropoff_location_code="MRB",
        dropoff_location_type="hotel",
    )


# --------------------------------------------------------------------------
# Booking
# --------------------------------------------------------------------------

async def test_book_transfer_posts_pax_and_accomodation_details(monkeypatch):
    def handler(_method, url, kwargs):
        assert "transfer_booking" in url
        body = kwargs.get("json") or {}
        assert body["session_id"] == "sess-123"
        assert body["product_id"] == "p1"
        assert body["booking_type_id"] == "1"
        assert body["pax_details"]["lead_first_name"] == "John"
        assert body["accomodation_details"]["accomodation_name"] == "Marbella Hotel"
        assert "payment_details" not in body
        return _FakeResponse(
            {
                "status": "Confirmed",
                "confirmationNumber": "TR12345",
                "customerName": "John Doe",
                "transferDescription": {
                    "supplierName": "Acme Transfers",
                    "outboundDetails": {
                        "transferDetails": {"pickupTime": "10:00"},
                        "companyDetails": {"supplierName": "Acme Transfers"},
                    },
                },
            }
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_transfers.book_transfer(
        "sess-123",
        "p1",
        "1",
        {
            "lead_title": "Mr",
            "lead_first_name": "John",
            "lead_last_name": "Doe",
            "phone": "0000000000",
            "email_id": "john@example.com",
            "address01": "1 Main St",
            "zip_code": "12345",
        },
        {
            "accomodation_name": "Marbella Hotel",
            "accomodation_address01": "2 Beach Rd",
        },
    )
    assert data["confirmationNumber"] == "TR12345"
    assert data["transferDescription"]["supplierName"] == "Acme Transfers"


async def test_book_transfer_includes_optional_fields(monkeypatch):
    def handler(_method, url, kwargs):
        body = kwargs.get("json") or {}
        assert body["client_reference"] == "REF1"
        assert body["payment_details"]["card_type"] == "visa"
        assert body["departure_airline"]["airline_code"] == "BA"
        assert body["extras"] == [{"code": "CHILD_SEAT", "quantity": 1}]
        assert body["remark"] == "Meet at gate"
        return _FakeResponse({"status": "Confirmed", "confirmationNumber": "TR999", "customerName": "Jane"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    await travelnext_transfers.book_transfer(
        "sess-456",
        "p2",
        "2",
        {
            "lead_title": "Ms",
            "lead_first_name": "Jane",
            "lead_last_name": "Roe",
            "phone": "1111111111",
            "email_id": "jane@example.com",
            "address01": "3 Elm St",
            "zip_code": "54321",
        },
        {
            "accomodation_name": "City Hotel",
            "accomodation_address01": "4 River Rd",
        },
        client_reference="REF1",
        payment_details={"card_type": "visa", "card_no": "4111111111111111"},
        departure_airline={"airport_code": "AGP", "airline_code": "BA", "airline_number": "123"},
        extras=[{"code": "CHILD_SEAT", "quantity": 1}],
        remark="Meet at gate",
    )


# --------------------------------------------------------------------------
# Cancel / booking details
# --------------------------------------------------------------------------

async def test_cancel_transfer_posts_confirmation_id(monkeypatch):
    def handler(_method, url, kwargs):
        assert "cancel" in url
        body = kwargs.get("json") or {}
        assert body["confirmation_id"] == "TR12345"
        assert body["user_id"] == "user"
        return _FakeResponse({"status": "Cancelled", "confirmationNumber": "TR12345", "customerName": "John Doe"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_transfers.cancel_transfer("TR12345")
    assert data["status"] == "Cancelled"


async def test_get_booking_details_posts_confirmation_id(monkeypatch):
    def handler(_method, url, kwargs):
        assert "booking_details" in url
        body = kwargs.get("json") or {}
        assert body["confirmation_id"] == "TR12345"
        return _FakeResponse(
            {
                "status": "Confirmed",
                "confirmationNumber": "TR12345",
                "customerName": "John Doe",
                "transferDescription": {"supplierName": "Acme Transfers"},
            }
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_transfers.get_booking_details("TR12345")
    assert data["confirmationNumber"] == "TR12345"


# --------------------------------------------------------------------------
# Error handling
# --------------------------------------------------------------------------

async def test_post_raises_on_error_field_in_response(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"error": "Invalid session"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(RuntimeError, match="Invalid session"):
        await travelnext_transfers.cancel_transfer("bad-id")


async def test_post_raises_on_http_error_status(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"detail": "boom"}, status_code=500)

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(httpx.HTTPStatusError):
        await travelnext_transfers.cancel_transfer("bad-id")


async def test_post_raises_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(travelnext, "TRAVELNEXT_USER_ID", None)
    with pytest.raises(RuntimeError, match="credentials"):
        await travelnext_transfers.cancel_transfer("TR12345")
