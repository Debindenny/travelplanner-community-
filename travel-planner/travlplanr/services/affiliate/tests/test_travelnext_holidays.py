"""TravelNext Holidays adapter tests (no network)."""
from __future__ import annotations

import httpx
import pytest

import app.adapters.providers.travelnext as travelnext
import app.adapters.providers.travelnext_holidays as travelnext_holidays

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
    monkeypatch.setattr(travelnext_holidays, "TRAVELNEXT_USER_ID", "user")
    monkeypatch.setattr(travelnext_holidays, "TRAVELNEXT_USER_PASSWORD", "pass")
    monkeypatch.setattr(travelnext_holidays, "TRAVELNEXT_ACCESS", "Test")
    travelnext_holidays._countries_cache = None
    travelnext_holidays._travel_styles_cache = None


async def test_search_by_country_posts_expected_body(monkeypatch):
    def handler(_method, url, kwargs):
        assert "holiday-search" in url
        body = kwargs.get("json") or {}
        assert body["country"] == "India"
        assert body["from_date"] == "2026-07-24"
        assert body["to_date"] == "2026-07-24"
        assert body["requiredCurrency"] == "USD"
        assert body["user_id"] == "user"
        return _FakeResponse({"title": "India", "holidays": [{"id": "8404"}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_holidays.search_by_country("India", "2026-07-24", "2026-07-24")
    assert data["holidays"][0]["id"] == "8404"


async def test_search_by_travel_style_includes_price_range(monkeypatch):
    def handler(_method, url, kwargs):
        assert "holidays-travel-style-search" in url
        body = kwargs.get("json") or {}
        assert body["travel_style"] == "Adventure"
        assert body["minPrice"] == 100
        assert body["maxPrice"] == 5000
        return _FakeResponse({"title": "Adventure", "holidays": []})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_holidays.search_by_travel_style(
        "Adventure", "2026-07-24", "2026-07-24", min_price=100, max_price=5000
    )
    assert data["title"] == "Adventure"


async def test_get_holiday_details_posts_holiday_code(monkeypatch):
    def handler(_method, url, kwargs):
        assert "holday-details" in url
        body = kwargs.get("json") or {}
        assert body["holiday_code"] == "8404"
        return _FakeResponse({"id": "8404", "package_name": "Kathmandu Off The Beaten Path Tour:"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_holidays.get_holiday_details("8404")
    assert data["id"] == "8404"


async def test_create_booking_posts_reference_code_and_lead_passenger(monkeypatch):
    def handler(_method, url, kwargs):
        assert "holiday-booking" in url
        body = kwargs.get("json") or {}
        assert body["ReferenceCode"] == "8404"
        assert body["leadPassanger"]["email"] == "test@gmail.com"
        return _FakeResponse({"status": "Confirmed", "booking_ref": "dH6H8XaFOj"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_holidays.create_booking(
        "8404",
        {
            "title": "Mr",
            "firstName": "test",
            "lastName": "test",
            "email": "test@gmail.com",
            "address": "wooden garden road",
            "dob": "12-02-2000",
            "gender": "male",
            "telephone": "0123456789",
            "countryCode": "IN",
        },
    )
    assert data["booking_ref"] == "dH6H8XaFOj"


async def test_get_booking_details_posts_reference_code(monkeypatch):
    def handler(_method, url, kwargs):
        assert "booking-details" in url
        body = kwargs.get("json") or {}
        assert body["ReferenceCode"] == "epKi9SWDzP"
        return _FakeResponse({"id": "19", "booking_ref": "epKi9SWDzP"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_holidays.get_booking_details("epKi9SWDzP")
    assert data["booking_ref"] == "epKi9SWDzP"


async def test_get_countries_unwraps_country_det_and_caches(monkeypatch):
    calls = 0

    def handler(_method, url, kwargs):
        nonlocal calls
        calls += 1
        assert "holiday-countries" in url
        return _FakeResponse({"country_det": [{"id": "1", "name": "Benin"}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    first = await travelnext_holidays.get_countries()
    second = await travelnext_holidays.get_countries()
    assert first == [{"id": "1", "name": "Benin"}]
    assert second == first
    assert calls == 1  # cached, no second HTTP call


async def test_get_travel_styles_returns_list(monkeypatch):
    def handler(_method, url, kwargs):
        assert "travel-styles" in url
        return _FakeResponse(["Adventure", "Adventure, Antarctica"])

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    styles = await travelnext_holidays.get_travel_styles()
    assert styles == ["Adventure", "Adventure, Antarctica"]


async def test_resolve_holiday_country_maps_city_and_region():
    assert travelnext_holidays.resolve_holiday_country("Amsterdam") == "Netherlands"
    assert travelnext_holidays.resolve_holiday_country("Paris, France") == "France"
    assert travelnext_holidays.resolve_holiday_country("Europe") == "France"
    assert travelnext_holidays.resolve_holiday_country("India") == "India"


async def test_search_holidays_maps_inventory_items(monkeypatch):
    async def fake_search(country, from_date, to_date, **_kw):
        assert country == "Netherlands"
        assert from_date
        assert to_date
        return {
            "holidays": [
                {
                    "id": "15540",
                    "package_name": "Springfest (2 nights):",
                    "destinations": "Munich",
                    "duration": "3 days",
                    "total_price": "3804.00",
                    "pricePerDay": "1268.00",
                    "main_img": "https://example.com/h.jpg",
                    "travel_style": "Festival",
                    "operator": "Stoke Travel",
                    "rating": "5.0",
                }
            ]
        }

    monkeypatch.setattr(travelnext_holidays, "search_by_country", fake_search)
    items = await travelnext_holidays.search_holidays("Amsterdam", "standard", date="2026-08-15")
    assert len(items) == 1
    item = items[0]
    assert item.type == "holiday"
    assert item.provider == "travelnext"
    assert item.title == "Springfest (2 nights)"
    assert item.price == 3804.0
    assert item.image_url
    assert item.details["holiday_code"] == "15540"
    assert item.details["country"] == "Netherlands"


# --------------------------------------------------------------------------
# Error handling
# --------------------------------------------------------------------------

async def test_post_raises_on_error_field_in_response(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"error": "Invalid session"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(RuntimeError, match="Invalid session"):
        await travelnext_holidays.get_booking_details("15540")


async def test_post_raises_on_http_error_status(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"detail": "boom"}, status_code=500)

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(httpx.HTTPStatusError):
        await travelnext_holidays.get_booking_details("15540")


async def test_post_raises_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(travelnext, "TRAVELNEXT_USER_ID", None)
    with pytest.raises(RuntimeError, match="credentials"):
        await travelnext_holidays.get_booking_details("15540")
