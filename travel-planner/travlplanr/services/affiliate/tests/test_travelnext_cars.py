"""TravelNext Cars adapter tests (no network)."""
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
    monkeypatch.setattr(travelnext_cars, "TRAVELNEXT_USER_ID", "user")
    monkeypatch.setattr(travelnext_cars, "TRAVELNEXT_USER_PASSWORD", "pass")
    monkeypatch.setattr(travelnext_cars, "TRAVELNEXT_ACCESS", "Test")


# --------------------------------------------------------------------------
# Booking / cancel
# --------------------------------------------------------------------------

async def test_cancel_booking_posts_confirmation_id(monkeypatch):
    def handler(_method, url, kwargs):
        assert "cancel_booking" in url
        body = kwargs.get("json") or {}
        assert body["confirmation_id"] == "CAR12345"
        return _FakeResponse({"status": "CANCELLED"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_cars.cancel_booking("CAR12345")
    assert data["status"] == "CANCELLED"


async def test_get_booking_details_posts_confirmation_id(monkeypatch):
    def handler(_method, url, kwargs):
        assert "booking_details" in url
        body = kwargs.get("json") or {}
        assert body["confirmation_id"] == "CAR12345"
        return _FakeResponse({"status": "CONFIRMED"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    data = await travelnext_cars.get_booking_details("CAR12345")
    assert data["status"] == "CONFIRMED"


# --------------------------------------------------------------------------
# Error handling
# --------------------------------------------------------------------------

async def test_post_raises_on_error_field_in_response(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"error": "Invalid session"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(RuntimeError, match="Invalid session"):
        await travelnext_cars.cancel_booking("bad-id")


async def test_post_raises_on_http_error_status(monkeypatch):
    def handler(_method, url, kwargs):
        return _FakeResponse({"detail": "boom"}, status_code=500)

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(handler, *a, **kw))
    with pytest.raises(httpx.HTTPStatusError):
        await travelnext_cars.cancel_booking("bad-id")


async def test_post_raises_when_credentials_missing(monkeypatch):
    monkeypatch.setattr(travelnext, "TRAVELNEXT_USER_ID", None)
    with pytest.raises(RuntimeError, match="credentials"):
        await travelnext_cars.cancel_booking("CAR12345")
