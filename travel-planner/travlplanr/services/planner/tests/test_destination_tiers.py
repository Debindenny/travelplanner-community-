"""Integration-style tests for tiered chat actions, partitioning, and reply enrichment."""
from __future__ import annotations

import pytest

from app.services.chat_intent import (
    build_actions,
    enrich_reply,
    infer_intent,
    partition_chat_actions,
)
from app.services.destination_resolver import resolve_destination


def _resolve(message: str, region: str | None = None):
    return resolve_destination(message, region=region, supported_names=set(), supported_by_id={})


def _auto_suggested(message: str, region: str | None = None):
    resolved = _resolve(message, region=region)
    actions = build_actions(message, region=region, resolved=resolved)
    return partition_chat_actions(actions)


# ── Intent: plan N days in CITY (no "trip" word) ─────────────────────────────

@pytest.mark.parametrize(
    "message",
    [
        "Plan 5 days in Ljubljana",
        "plan 4 days in Paris",
        "build 7 days in Bali",
    ],
)
def test_infer_intent_plan_days_in_city(message: str):
    assert infer_intent(message) == "create_trip"


# ── Supported tier actions ────────────────────────────────────────────────────

def test_supported_paris_no_auto_create_without_preference():
    # Destination + duration alone isn't enough signal for a good default
    # itinerary — gather_trip_slots.ready_to_auto_create asks one more
    # question (via collection_prompt) rather than silently assuming
    # solo/standard/sightseeing.
    msg = "Plan 5 days in Paris"
    auto, suggested = _auto_suggested(msg)
    assert not any(a["type"] == "create_trip" for a in auto)


def test_supported_paris_auto_create_trip():
    msg = "For a family, plan 5 days in Paris"
    auto, suggested = _auto_suggested(msg)
    assert len(auto) == 1
    assert auto[0]["type"] == "create_trip"
    assert auto[0]["destination"] == "Paris"
    assert auto[0]["durationDays"] == 5
    assert auto[0]["coverageTier"] == "full"
    assert suggested == []


def test_supported_dubai_with_travelers():
    msg = "we are 4 people planning a 5 day trip to Dubai"
    auto, suggested = _auto_suggested(msg)
    assert any(a["type"] == "create_trip" for a in auto)
    create = next(a for a in auto if a["type"] == "create_trip")
    assert create["destination"] == "Dubai"
    assert create.get("travelStyle") == "friends"
    assert suggested == []


# ── Draft eligible tier actions ───────────────────────────────────────────────

def test_draft_ljubljana_auto_create_draft():
    msg = "For a family, plan 5 days in Ljubljana"
    auto, suggested = _auto_suggested(msg)
    assert any(a["type"] == "create_draft_trip" for a in auto)
    draft = next(a for a in auto if a["type"] == "create_draft_trip")
    assert draft["destination"] == "Ljubljana"
    assert draft["coverageTier"] == "draft"
    types = {a["type"] for a in suggested}
    assert types == {"show_similar_destinations", "request_destination"}


def test_draft_prague_has_central_europe_similar():
    msg = "For a family, plan 6 days in Prague"
    auto, suggested = _auto_suggested(msg)
    assert any(a["type"] == "create_draft_trip" for a in auto)
    similar = next(a for a in suggested if a["type"] == "show_similar_destinations")
    assert "Austria" in similar["similar"]


# ── Unknown tier actions ──────────────────────────────────────────────────────

def test_unknown_vague_query_no_trip_actions():
    msg = "somewhere warm for 5 days"
    auto, suggested = _auto_suggested(msg)
    assert not any(a["type"] in ("create_trip", "create_draft_trip") for a in auto + suggested)


def test_unknown_create_trip_intent_without_place():
    msg = "plan a 5 day trip"
    resolved = _resolve(msg)
    assert resolved.tier == "unknown"
    auto, suggested = _auto_suggested(msg)
    assert auto == []
    # unknown tier with create_trip intent may add show_similar only when tier branch runs
    assert all(a["type"] != "create_draft_trip" for a in suggested)


# ── partition_chat_actions ─────────────────────────────────────────────────────

def test_partition_manual_action_types():
    actions = [
        {"type": "create_trip", "destination": "Paris"},
        {"type": "create_draft_trip", "destination": "Ljubljana"},
        {"type": "request_destination", "destination": "Ljubljana"},
        {"type": "show_similar_destinations", "similar": ["Italy"]},
        {"type": "navigate_packages", "destination": "Dubai"},
    ]
    auto, suggested = partition_chat_actions(actions)
    assert len(auto) == 3
    assert {a["type"] for a in auto} == {"create_trip", "create_draft_trip", "navigate_packages"}
    assert len(suggested) == 2
    assert all("auto" not in a for a in suggested)


def test_partition_auto_false_flag():
    actions = [{"type": "create_trip", "auto": False, "destination": "Paris"}]
    auto, suggested = partition_chat_actions(actions)
    assert auto == []
    assert len(suggested) == 1


# ── enrich_reply with resolved tiers ─────────────────────────────────────────

def test_enrich_reply_supported_create_trip():
    resolved = _resolve("make a 4 day trip to Dubai")
    enriched = enrich_reply(
        "Sure!",
        "create_trip",
        "Dubai",
        "make a 4 day trip to Dubai",
        resolved=resolved,
        auto_actions=[{"type": "create_trip", "destination": "Dubai", "durationDays": 4}],
    )
    blob = f"{enriched.reply} {' '.join(enriched.ui_status)}"
    assert "Dubai" in blob
    assert "4" in blob


def test_enrich_reply_draft_builds_itinerary():
    msg = "For a family, plan 5 days in Ljubljana"
    resolved = _resolve(msg)
    enriched = enrich_reply(
        "Great choice!",
        "create_trip",
        resolved.display_name,
        msg,
        resolved=resolved,
        auto_actions=[{"type": "create_draft_trip", "destination": resolved.display_name, "durationDays": 5}],
    )
    blob = f"{enriched.reply} {' '.join(enriched.ui_status)}".lower()
    assert "ljubljana" in blob
    assert "draft" in blob or "itinerary" in blob or "building" in blob or "5" in blob
    assert "tap" not in enriched.reply.lower()
    assert "you'll land" not in enriched.reply.lower()


def test_enrich_reply_unknown_asks_for_specific_place():
    msg = "somewhere warm"
    resolved = _resolve(msg)
    enriched = enrich_reply("Interesting!", "general", None, msg, resolved=resolved)
    assert isinstance(enriched.reply, str)


def test_enrich_reply_unknown_create_trip_intent():
    # No destination at all — collection_prompt asks for one directly rather
    # than the "couldn't pin down" + similar-destinations wording, which only
    # applies once we at least have *some* (unresolved) place candidate.
    msg = "plan a 5 day trip"
    resolved = _resolve(msg)
    enriched = enrich_reply("Ok!", "create_trip", None, msg, resolved=resolved)
    assert "city or country" in enriched.reply.lower()


def test_enrich_reply_draft_unrecognized_guess():
    msg = "For a family, plan 4 days in Foobarville"
    resolved = _resolve(msg)
    enriched = enrich_reply(
        "Nice!",
        "create_trip",
        resolved.display_name,
        msg,
        resolved=resolved,
        auto_actions=[{"type": "create_draft_trip", "destination": resolved.display_name, "durationDays": 4}],
    )
    blob = f"{enriched.reply} {' '.join(enriched.ui_status)}"
    assert "Foobarville" in blob
    assert "draft" in blob.lower() or "4" in blob


# ── Legacy build_actions without resolved (dev fallback) ───────────────────────

def test_build_actions_legacy_pattern_destination():
    actions = build_actions("make a 4 day trip to Dubai for 2 people")
    assert any(a["type"] == "create_trip" for a in actions)
    create = next(a for a in actions if a["type"] == "create_trip")
    assert create["coverageTier"] == "full"


def test_build_actions_legacy_region_fallback():
    actions = build_actions("plan a 3 day trip for a family", region="Singapore")
    create = next(a for a in actions if a["type"] == "create_trip")
    assert create["destination"] == "Singapore"


def test_resolve_vague_europe_maps_to_supported_pattern():
    """'Europe' is a curated pattern destination — not treated as unknown."""
    resolved = resolve_destination("anywhere in europe", supported_names=set(), supported_by_id={})
    assert resolved.tier == "supported"
    assert resolved.display_name == "Europe"


def test_build_actions_no_auto_trip_without_place_or_region():
    msg = "For a family, plan 5 days in Ljubljana"
    resolved = _resolve(msg)
    actions = build_actions(msg, resolved=resolved)
    assert not any(a["type"] == "create_trip" for a in actions)
    assert any(a["type"] == "create_draft_trip" for a in actions)


def test_turn_into_full_itinerary_follow_up():
    from app.services.destination_resolver import resolve_destination_with_history

    history = [{"role": "user", "content": "For a family, draft a 5 day trip from Delhi to Chalakudy"}]
    msg = "Turn this into a full itinerary"
    resolved = resolve_destination_with_history(
        msg,
        history,
        supported_names=set(),
        supported_by_id={},
    )
    assert infer_intent(msg) == "show_itinerary"
    actions = build_actions(msg, resolved=resolved, history=history)
    auto, _suggested = partition_chat_actions(actions)
    assert any(a["type"] == "create_draft_trip" for a in auto)


def test_show_itinerary_uses_history_for_draft_destination():
    from app.services.destination_resolver import resolve_destination_with_history

    history = [{"role": "user", "content": "For a family, draft a 5 day trip from Delhi to Chalakudy"}]
    resolved = resolve_destination_with_history(
        "show the itinerary",
        history,
        supported_names=set(),
        supported_by_id={},
    )
    assert resolved.display_name == "Chalakudy"
    assert resolved.tier == "draft_eligible"
    assert infer_intent("show the itinerary") == "show_itinerary"
    actions = build_actions("show the itinerary", resolved=resolved, history=history)
    auto, suggested = partition_chat_actions(actions)
    assert any(a["type"] == "create_draft_trip" for a in auto)
    draft = next(a for a in auto if a["type"] == "create_draft_trip")
    assert draft["destination"] == "Chalakudy"
    assert draft["departureLocation"] == "Delhi"
    assert draft["durationDays"] == 5


# ── TripCreateBody coverage tier ──────────────────────────────────────────────

def test_trip_create_body_coverage_tier():
    from app.routers.trips import TripCreateBody

    full = TripCreateBody(
        destinations=["Paris"],
        startDate="2026-01-01",
        endDate="2026-01-05",
        travelers=2,
        travelStyle="couple",
        travelMethod="flight",
        budget="mid",
        interests=[],
        foodPreferences=[],
        coverageTier="full",
    )
    assert full.coverageTier == "full"

    draft = TripCreateBody(**{**full.model_dump(), "coverageTier": "draft"})
    assert draft.coverageTier == "draft"
