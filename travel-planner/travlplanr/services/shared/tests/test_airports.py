"""Tests for the shared nearest-airport resolver (dataset + alias lookups only —
no network; the geocode fallback is exercised separately with a stub)."""

from __future__ import annotations

import pytest

from shared import airports


def test_alias_towns_resolve_to_gateway_airports():
    assert airports.airport_code_for_place("Chalakudy") == "COK"
    assert airports.airport_code_for_place("chalakudi") == "COK"
    assert airports.airport_code_for_place("Munnar") == "COK"
    assert airports.airport_code_for_place("Varkala") == "TRV"
    assert airports.airport_code_for_place("Gurgaon") == "DEL"


def test_city_variants_resolve():
    assert airports.airport_code_for_place("Bangalore") == "BLR"
    assert airports.airport_code_for_place("Bengaluru") == "BLR"
    assert airports.airport_code_for_place("Bombay") == "BOM"
    assert airports.airport_code_for_place("Kochi") == "COK"
    assert airports.airport_code_for_place("Cochin") == "COK"


def test_multi_airport_cities_pin_primary_hub():
    assert airports.airport_code_for_place("London") == "LHR"
    assert airports.airport_code_for_place("Paris") == "CDG"
    assert airports.airport_code_for_place("Tokyo") == "HND"
    assert airports.airport_code_for_place("Dubai") == "DXB"
    assert airports.airport_code_for_place("New York") == "JFK"


def test_dataset_municipality_match():
    assert airports.airport_code_for_place("Chennai") == "MAA"
    assert airports.airport_code_for_place("Thiruvananthapuram") == "TRV"
    assert airports.airport_code_for_place("Zurich") == "ZRH"


def test_iata_passthrough_and_city_name_priority():
    assert airports.airport_code_for_place("BLR") == "BLR"
    assert airports.airport_code_for_place("cok") == "COK"
    # "Goa" is a place name first, never the IATA code GOA (Genoa).
    assert airports.airport_code_for_place("Goa") == "GOI"


def test_unknown_and_empty_places():
    assert airports.airport_code_for_place("Someplaceville") is None
    assert airports.airport_code_for_place("") is None
    assert airports.airport_code_for_place(None) is None


def test_airport_city_label():
    assert airports.airport_city_for_place("Chalakudy") == "Kochi"
    assert airports.airport_city_for_place("Bangalore") == "Bengaluru"
    assert airports.airport_city_for_place("Nowhereville") is None


def test_nearest_airport_by_coords_prefers_major_hub():
    # Chalakudy, Kerala — Cochin International is the nearest scheduled airport.
    hit = airports.nearest_airport_by_coords(10.31, 76.33)
    assert hit is not None
    assert hit["iata"] == "COK"
    assert hit["distance_km"] < 60


def test_nearest_airport_by_coords_remote_ocean_returns_none():
    assert airports.nearest_airport_by_coords(-48.0, -123.0) is None


@pytest.mark.asyncio
async def test_resolve_airport_code_uses_geocode_fallback(monkeypatch):
    async def fake_geocode(place):
        assert place == "Tiny Unknown Town"
        return (10.31, 76.33)

    monkeypatch.setattr(airports, "geocode_place", fake_geocode)
    assert await airports.resolve_airport_code("Tiny Unknown Town") == "COK"


@pytest.mark.asyncio
async def test_resolve_airport_code_no_geocode_when_disallowed(monkeypatch):
    async def boom(place):  # pragma: no cover - must not be called
        raise AssertionError("geocode should not run")

    monkeypatch.setattr(airports, "geocode_place", boom)
    assert await airports.resolve_airport_code("Someplaceville", allow_geocode=False) is None
    assert await airports.resolve_airport_code("Bangalore", allow_geocode=False) == "BLR"


@pytest.mark.asyncio
async def test_resolve_airport_code_geocode_failure_is_none(monkeypatch):
    async def fake_geocode(place):
        return None

    monkeypatch.setattr(airports, "geocode_place", fake_geocode)
    assert await airports.resolve_airport_code("Someplaceville") is None
