"""Flight route correction action tests."""

from __future__ import annotations

from app.services.chat_intent import build_actions, extract_flight_correction


def test_flight_fix_triggers_regenerate_not_rebuild():
    msg = "fix the flights from Delhi to Kochi"
    assert extract_flight_correction(msg) == ("Delhi", "Kochi")
    actions = build_actions(msg, trip_id="trip-123")
    assert actions == [{
        "type": "regenerate_itinerary",
        "tripId": "trip-123",
        "style": actions[0]["style"],
        "departureLocation": "Delhi",
        "arrivalLocation": "Kochi",
        "useAi": True,
    }]
    assert "Delhi" in actions[0]["style"]
    assert "Kochi" in actions[0]["style"]


def test_travelling_from_updates_open_trip_not_packages():
    """Natural origin statements must regenerate flights — never navigate_packages."""
    from app.services.chat_intent import infer_intent

    msg = "i will be travelling from delhi to dubai"
    assert infer_intent(msg) == "fix_itinerary"
    assert extract_flight_correction(msg) == ("Delhi", "Dubai")
    actions = build_actions(msg, trip_id="trip-abc")
    assert len(actions) == 1
    assert actions[0]["type"] == "regenerate_itinerary"
    assert actions[0]["departureLocation"] == "Delhi"
    assert actions[0]["arrivalLocation"] == "Dubai"
    assert not any(a["type"] == "navigate_packages" for a in actions)


def test_starting_from_delhi_regenerates_open_trip():
    from app.services.chat_intent import infer_intent
    from app.services.destination_resolver import resolve_destination

    msg = "i'm starting from delhi"
    assert infer_intent(msg) == "fix_itinerary"
    resolved = resolve_destination(msg, region="Chalakudy", supported_names=set(), supported_by_id={})
    assert resolved.display_name == "Chalakudy"
    assert "Starting" not in (resolved.display_name or "")
    actions = build_actions(
        msg,
        trip_id="trip-chalakudy",
        region="Chalakudy",
        resolved=resolved,
        known_slots={"destination": "Chalakudy", "duration_days": 3},
    )
    assert len(actions) == 1
    assert actions[0]["type"] == "regenerate_itinerary"
    assert actions[0]["departureLocation"] == "Delhi"
    assert actions[0]["arrivalLocation"] == "Chalakudy"


def test_draft_route_includes_departure_on_create():
    msg = "For a family, draft a 5 day trip from Delhi to Chalakudy"
    from app.services.destination_resolver import resolve_destination

    resolved = resolve_destination(msg, supported_names=set(), supported_by_id={})
    actions = build_actions(msg, resolved=resolved)
    draft = next(a for a in actions if a["type"] == "create_draft_trip")
    assert draft["destination"] == "Chalakudy"
    assert draft["departureLocation"] == "Delhi"
    assert draft["arrivalLocation"] == "Chalakudy"
