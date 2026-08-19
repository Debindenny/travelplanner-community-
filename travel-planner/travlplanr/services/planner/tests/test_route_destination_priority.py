"""Regression tests: in "from X to Y" messages the arrival is the destination,
even when only the origin is in the curated DESTINATION_PATTERNS list.

Bug: "plan a trip from bangalore to chalakudy" resolved destination=Bangalore
(origin, curated) and dropped Chalakudy entirely, because the position-
independent curated-list scan ran before the route-aware extraction.
"""

from __future__ import annotations

from app.services.destination_resolver import resolve_destination
from app.services.trip_planning_slots import gather_trip_slots


def test_route_arrival_wins_over_curated_origin():
    resolved = resolve_destination("plan a trip from bangalore to chalakudy")
    assert resolved.display_name == "Chalakudy"
    assert resolved.tier == "draft_eligible"


def test_route_arrival_supported_destination():
    resolved = resolve_destination("plan a trip from chalakudy to bangalore")
    assert resolved.display_name == "Bangalore"
    assert resolved.tier == "supported"


def test_route_both_curated_cities():
    resolved = resolve_destination("trip from delhi to dubai for 5 days")
    assert resolved.display_name == "Dubai"
    assert resolved.tier == "supported"


def test_no_route_keeps_curated_behavior():
    resolved = resolve_destination("plan a 4 day trip to bangalore")
    assert resolved.display_name == "Bangalore"
    assert resolved.tier == "supported"


def test_slots_carry_departure_and_arrival():
    message = "plan a trip from bangalore to chalakudy for 3 days as a couple"
    resolved = resolve_destination(message)
    slots = gather_trip_slots(message, resolved=resolved)
    assert slots.departure_location == "Bangalore"
    assert slots.destination == "Chalakudy"
    assert slots.arrival_location == "Chalakudy"
    assert slots.duration_days == 3


def test_slots_route_from_history():
    history = [{"role": "user", "content": "plan a trip from bangalore to chalakudy"}]
    resolved = resolve_destination("make it 3 days for 2 people")
    slots = gather_trip_slots("make it 3 days for 2 people", history=history, resolved=resolved)
    assert slots.departure_location == "Bangalore"
    assert slots.destination == "Chalakudy"
