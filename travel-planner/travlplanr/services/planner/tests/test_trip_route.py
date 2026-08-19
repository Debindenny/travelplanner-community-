"""Tests for trip route parsing and airport mapping."""

from __future__ import annotations

import pytest

from app.services.package_plan_builder import _airport_code
from app.services.trip_route import (
    extract_flight_correction,
    extract_trip_route,
    flight_correction_hint,
    nearest_airport_city,
)


@pytest.mark.parametrize(
    "message,dep,arr",
    [
        ("draft a trip from Delhi to Chalakudy", "Delhi", "Chalakudy"),
        ("plan from delhi to chalakudi for 5 days", "Delhi", "Chalakudi"),
        ("Bangalore to Chalakudy", "Bangalore", "Chalakudy"),
        ("Bangalore to Chalakudy from next monday", "Bangalore", "Chalakudy"),
    ],
)
def test_extract_trip_route(message: str, dep: str, arr: str):
    route = extract_trip_route(message)
    assert route == (dep, arr)


def test_plan_a_trip_to_city_is_not_a_route():
    assert extract_trip_route("plan a trip to bangalore") is None
    assert extract_trip_route("plan a trip to banagalore") is None


@pytest.mark.parametrize(
    "message",
    [
        "I want to relax on a beach for a week with my partner",
        "we'd love to visit somewhere warm",
        "I need to travel somewhere quiet",
        "hoping to unwind for a few days",
    ],
)
def test_infinitive_sentence_is_not_a_bare_route(message: str):
    # The bare "CityA to CityB" pattern has no "from" anchor, so a plain
    # infinitive ("I want to relax...") also matches its shape and was
    # previously misread as a route from "I want" to "relax on a beach".
    assert extract_trip_route(message) is None


def test_nearest_airport_for_chalakudy():
    assert nearest_airport_city("Chalakudy") == "Kochi"
    assert nearest_airport_city("chalakudi") == "Kochi"


def test_airport_codes_india():
    assert _airport_code("Delhi") == "DEL"
    assert _airport_code("Chalakudy") == "COK"
    assert _airport_code("Kochi") == "COK"


def test_extract_flight_correction_loose_phrase():
    route = extract_flight_correction("fix the flights they should be Delhi to Kochi")
    assert route == ("Delhi", "Kochi")


def test_travel_statement_is_flight_correction():
    assert extract_flight_correction("i will be travelling from delhi to dubai") == ("Delhi", "Dubai")
    assert extract_flight_correction("flying from mumbai to dubai") == ("Mumbai", "Dubai")
    assert extract_flight_correction("show dubai packages") is None


def test_starting_from_is_departure_only():
    from app.services.trip_route import extract_departure_city

    assert extract_departure_city("i'm starting from delhi") == "Delhi"
    assert extract_departure_city("starting from Mumbai") == "Mumbai"
    assert extract_departure_city("from delhi to dubai") is None  # full route, not origin-only


def test_flight_correction_hint():
    hint = flight_correction_hint("Delhi", "Chalakudy")
    assert "Delhi" in hint
    assert "Kochi" in hint or "COK" in hint
