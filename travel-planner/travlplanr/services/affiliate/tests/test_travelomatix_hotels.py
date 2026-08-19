"""Unit tests for Travelomatix hotels adapter helpers (no live API)."""

from __future__ import annotations

import os

import pytest

from app.adapters.providers import travelomatix_hotels as tm


def test_resolve_city_bangalore():
    city = tm.resolve_city("Bangalore, India")
    assert city is not None
    assert city["city_id"] == 6743
    assert city["country_code"] == "IN"


def test_resolve_city_explicit_id():
    city = tm.resolve_city("Somewhere city_id:99999")
    assert city is not None
    assert city["city_id"] == 99999


def test_resolve_city_unknown_returns_none(monkeypatch):
    monkeypatch.setattr(tm, "TRAVELOMATIX_DEFAULT_CITY_ID", "")
    tm._cities_cache = None
    tm._api_cities_loaded = False
    assert tm.resolve_city("Unknown City XYZ") is None


def test_to_tm_date():
    assert tm._to_tm_date("2026-08-15") == "15-08-2026"


def test_hotel_rows_parsing():
    rows = tm._hotel_rows(
        {
            "Status": 1,
            "Search": {
                "HotelSearchResult": {
                    "HotelResults": [{"HotelCode": "H1", "ResultToken": "tok"}]
                }
            },
        }
    )
    assert len(rows) == 1
    assert rows[0]["HotelCode"] == "H1"


def test_credentials_require_all_headers(monkeypatch):
    monkeypatch.setattr(tm, "TRAVELOMATIX_USERNAME", "u")
    monkeypatch.setattr(tm, "TRAVELOMATIX_PASSWORD", "p")
    monkeypatch.setattr(tm, "TRAVELOMATIX_DOMAIN_KEY", "d")
    monkeypatch.setattr(tm, "TRAVELOMATIX_SYSTEM", "test")
    assert tm.has_travelomatix_hotels_credentials() is True
    monkeypatch.setattr(tm, "TRAVELOMATIX_DOMAIN_KEY", "")
    assert tm.has_travelomatix_hotels_credentials() is False


def test_city_overrides(monkeypatch):
    monkeypatch.setenv("TRAVELOMATIX_CITY_OVERRIDES", '{"Testville": 111}')
    tm._cities_cache = None
    tm._api_cities_loaded = False
    city = tm.resolve_city("Testville, India")
    assert city is not None
    assert city["city_id"] == 111
    tm._cities_cache = None
    tm._api_cities_loaded = False
    if "TRAVELOMATIX_CITY_OVERRIDES" in os.environ:
        del os.environ["TRAVELOMATIX_CITY_OVERRIDES"]


def test_resolve_mumbai_from_seed():
    tm._cities_cache = None
    tm._api_cities_loaded = False
    city = tm.resolve_city("Mumbai, India")
    assert city is not None
    assert city["city_id"] == 5200
    assert city["country_code"] == "IN"
