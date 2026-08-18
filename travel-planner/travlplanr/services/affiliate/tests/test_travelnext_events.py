"""TravelNext Events adapter tests (no network)."""
from __future__ import annotations

import httpx
import pytest

import app.adapters.providers.travelnext as travelnext
import app.adapters.providers.travelnext_events as travelnext_events

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
    monkeypatch.setattr(travelnext_events, "TRAVELNEXT_USER_ID", "user")
    monkeypatch.setattr(travelnext_events, "TRAVELNEXT_USER_PASSWORD", "pass")
    monkeypatch.setattr(travelnext_events, "TRAVELNEXT_ACCESS", "Test")
    travelnext_events._static_cache.clear()


async def test_search_by_country_posts_expected_body(monkeypatch):
    def handler(_method, url, kwargs):
        assert "search_events" in url
        body = kwargs.get("json") or {}
        assert body["searchMethod"] == "countryName"
        assert body["countryId"] == "1002"
        assert body["countryName"] == "Spain"
        assert body["currency"] == "EUR"
        return _FakeResponse({"controll": {"totalrecords": 1}, "data": [{"eventId": 345757}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_events.search_by_country("1002", "Spain", currency="EUR")
    assert data["data"][0]["eventId"] == 345757


async def test_search_tournament_includes_date_range(monkeypatch):
    def handler(_method, url, kwargs):
        body = kwargs.get("json") or {}
        assert body["searchMethod"] == "getTournaments"
        assert body["tournamentId"] == "24"
        assert body["from"] == "2022-10-10"
        assert body["until"] == "2023-11-15"
        return _FakeResponse({"data": []})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    await travelnext_events.search_tournament("24", from_date="2022-10-10", until_date="2023-11-15")


async def test_search_tournament_omits_dates_when_not_given(monkeypatch):
    def handler(_method, url, kwargs):
        body = kwargs.get("json") or {}
        assert "from" not in body
        assert "until" not in body
        return _FakeResponse({"data": []})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    await travelnext_events.search_tournament("24")


async def test_get_ticket_details_uses_own_endpoint(monkeypatch):
    def handler(_method, url, kwargs):
        assert "ticket_details" in url
        assert "search_events" not in url
        body = kwargs.get("json") or {}
        assert body["eventId"] == "345757"
        assert body["session_id"] == "sess-abc"
        return _FakeResponse({"data": [{"id": 16957830, "price": 221}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_events.get_ticket_details("345757", "sess-abc")
    assert data["data"][0]["id"] == 16957830


async def test_create_order_posts_attendee_details(monkeypatch):
    def handler(_method, url, kwargs):
        assert "create_order" in url
        body = kwargs.get("json") or {}
        assert body["ticketId"] == "5658359"
        assert body["ticketQty"] == "2"
        assert len(body["attendeeDetails"]) == 2
        assert body["attendeeDetails"][0]["fullName"] == "John mathew"
        return _FakeResponse({"Status": "CONFIRMED", "ConfirmationNum": "12345", "Success": "True"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_events.create_order(
        "sess-abc",
        "test@acb.com",
        "00000000000000",
        "KJHJI",
        "5658359",
        "2",
        "387123",
        "1006",
        [
            {
                "nationalityCountryid": "1003",
                "cityofBirth": "London",
                "passportNumber": "234234234234",
                "birthDate": "1985-11-25",
                "fullName": "John mathew",
            },
            {
                "nationalityCountryid": "1003",
                "cityofBirth": "London",
                "passportNumber": "234234234234",
                "birthDate": "1858-11-18",
                "fullName": "alxander jose",
            },
        ],
    )
    assert data["Status"] == "CONFIRMED"


async def test_get_booking_details_posts_confirmation_and_reference(monkeypatch):
    def handler(_method, url, kwargs):
        assert "booking_details" in url
        body = kwargs.get("json") or {}
        assert body["ConfirmationNum"] == "12345"
        assert body["referenceNum"] == "EVT12345"
        return _FakeResponse({"status": "CONFIRMED", "confirmationNum": "12345"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_events.get_booking_details("12345", "EVT12345")
    assert data["status"] == "CONFIRMED"


async def test_get_countries_unwraps_and_caches(monkeypatch):
    calls = 0

    def handler(_method, url, kwargs):
        nonlocal calls
        calls += 1
        assert "static_data" in url
        body = kwargs.get("json") or {}
        assert body["searchMethod"] == "getCountries"
        return _FakeResponse({"countries": [{"countryId": "1", "name": "Spain"}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    first = await travelnext_events.get_countries()
    second = await travelnext_events.get_countries()
    assert first == [{"countryId": "1", "name": "Spain"}]
    assert second == first
    assert calls == 1


async def test_get_cities_caches_per_country_id(monkeypatch):
    calls = []

    def handler(_method, url, kwargs):
        body = kwargs.get("json") or {}
        calls.append(body["countryId"])
        return _FakeResponse({"cities": [{"cityId": body["countryId"], "name": "City"}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    spain = await travelnext_events.get_cities("1002")
    spain_again = await travelnext_events.get_cities("1002")
    france = await travelnext_events.get_cities("1003")
    assert spain == spain_again
    assert spain != france
    assert calls == ["1002", "1003"]  # second Spain call served from cache


async def test_search_events_inventory_maps_items(monkeypatch):
    async def fake_resolve(location):
        assert location == "Madrid"
        return {"cityId": "2001", "cityName": "Madrid"}

    async def fake_search(city_id, city_name, **_kw):
        assert city_id == "2001"
        return {
            "session_id": "evt-sess",
            "data": [
                {
                    "eventId": 345757,
                    "eventName": "Real Madrid vs Barcelona",
                    "minPrice": 89.5,
                    "currency": "EUR",
                    "venueName": "Santiago Bernabeu",
                    "eventDate": "2026-08-20",
                    "eventTime": "21:00",
                    "image": "https://example.com/e.jpg",
                }
            ],
        }

    monkeypatch.setattr(travelnext_events, "resolve_event_city", fake_resolve)
    monkeypatch.setattr(travelnext_events, "search_by_city", fake_search)
    items = await travelnext_events.search_events_inventory("Madrid", "standard", date="2026-08-15")
    assert len(items) == 1
    item = items[0]
    assert item.type == "event"
    assert item.provider == "travelnext"
    assert item.price == 89.5
    assert item.details["eventId"] == "345757"
    assert item.details["sessionId"] == "evt-sess"
    assert item.details["bookable"] is True


# --------------------------------------------------------------------------
# Error handling
# --------------------------------------------------------------------------

async def test_post_raises_on_error_field_in_response(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"error": "Invalid session"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(RuntimeError, match="Invalid session"):
        await travelnext_events.get_booking_details("12345", "EVT12345")


async def test_post_raises_on_http_error_status(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"detail": "boom"}, status_code=500)

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(httpx.HTTPStatusError):
        await travelnext_events.get_booking_details("12345", "EVT12345")


async def test_post_raises_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(travelnext, "TRAVELNEXT_USER_ID", None)
    with pytest.raises(RuntimeError, match="credentials"):
        await travelnext_events.get_booking_details("12345", "EVT12345")
