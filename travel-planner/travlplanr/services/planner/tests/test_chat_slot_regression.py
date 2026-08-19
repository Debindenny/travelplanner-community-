"""Regressions from live chat screenshots (typos + companion phrases)."""
from app.services.destination_resolver import resolve_destination
from app.services.trip_planning_slots import gather_trip_slots, ready_to_auto_create, slots_for_response


def test_dubain_typo_with_wife_resolves_cleanly():
    msg = "plan a trip to dubain for 2 days with my wife"
    resolved = resolve_destination(msg)
    assert resolved.display_name == "Dubai"
    assert resolved.tier == "supported"
    slots = gather_trip_slots(msg, resolved=resolved)
    assert slots.destination == "Dubai"
    assert slots.duration_days == 2
    assert slots.travelers == 2
    assert slots.travel_style == "couple"
    assert ready_to_auto_create(slots)
    resp = slots_for_response(slots)
    assert resp["travelers"] == 2
    assert "For" not in (resp["destination"] or "")


def test_slot_followup_creates_draft_over_stale_known_slots():
    """Completing days/party after a draft destination must create — not keep Dubai chips."""
    from app.services.chat_intent import build_actions, infer_intent
    from app.services.destination_resolver import resolve_destination_with_history

    history = [{"role": "user", "content": "plan a trip from delhi to chalakudy"}]
    msg = "me and wife only , keep it into 3 days only."
    assert infer_intent(msg) == "general"
    resolved = resolve_destination_with_history(
        msg, history, supported_names=set(), supported_by_id={}
    )
    assert resolved.display_name == "Chalakudy"
    actions = build_actions(
        msg,
        history=history,
        resolved=resolved,
        known_slots={
            "destination": "Dubai",
            "duration_days": 2,
            "travelers": 2,
            "travel_style": "couple",
        },
    )
    draft = next(a for a in actions if a["type"] == "create_draft_trip")
    assert draft["destination"] == "Chalakudy"
    assert draft["durationDays"] == 3
    assert draft["travelers"] == 2
    assert draft.get("departureLocation") == "Delhi"


def test_trip_create_normalizes_dubain_for():
    from app.routers.trips import _format_trip_title, _hero_image_for_destination, _normalize_create_destinations

    dests, tier = _normalize_create_destinations(["Dubain For"])
    assert dests == ["Dubai"]
    assert tier == "full"
    assert "Dubain" not in _format_trip_title(dests, "2026-07-13", "2026-07-14")
    assert "uae" in _hero_image_for_destination(dests[0])
