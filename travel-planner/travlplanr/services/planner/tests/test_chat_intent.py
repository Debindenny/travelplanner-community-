"""Exhaustive tests for chat intent parsing and action building."""
from __future__ import annotations

import pytest

from app.services.chat_intent import (
    build_actions,
    enrich_reply,
    extract_destination,
    extract_duration_days,
    extract_day_number,
    infer_intent,
    parse_itinerary_edits,
)


# ── Destination extraction ───────────────────────────────────────────────────

@pytest.mark.parametrize(
    "message,expected",
    [
        ("show me Dubai packages", "Dubai"),
        ("trip to abu dhabi", "Abu Dhabi"),
        ("visit the UAE", "Dubai"),
        ("emirates holiday", "Dubai"),
        ("paris and rome", "Paris"),
        ("hello there", None),
    ],
)
def test_extract_destination(message: str, expected: str | None):
    assert extract_destination(message) == expected


# ── Duration / day extraction ────────────────────────────────────────────────

@pytest.mark.parametrize(
    "message,expected",
    [
        ("4 day trip", 4),
        ("filter 7 days packages", 7),
        ("ten days", None),
        ("make a 4 days trip", 4),
    ],
)
def test_extract_duration_days(message: str, expected: int | None):
    assert extract_duration_days(message) == expected


@pytest.mark.parametrize(
    "message,expected",
    [
        ("add snorkeling on day 2", 2),
        ("remove food on day 3", 3),
        ("add train on 2nd day", 2),
        ("no day here", None),
        # Spelled-out numbers (voice transcriptions render "day 2" as "day two").
        ("add a car to day two", 2),
        ("add a car on day three", 3),
        ("add a car to day ten", 10),
        ("add a car to day twenty one", 21),
        ("add snorkeling on the second day", 2),
        ("add a car to the twenty-first day", 21),
        # Durations must not be mistaken for a day number.
        ("plan a two day trip", None),
        ("a 5 day trip to Goa", None),
    ],
)
def test_extract_day_number(message: str, expected: int | None):
    assert extract_day_number(message) == expected


def test_parse_add_transport_word_day():
    edits = parse_itinerary_edits("add a car to day two")
    assert edits == [{"edit": "add_transport", "transportType": "car", "day": 2}]


def test_parse_add_activity_ordinal_day_strips_suffix():
    edits = parse_itinerary_edits("add snorkeling on the second day")
    assert edits == [{"edit": "add_activity", "title": "Snorkeling", "day": 2}]


# ── Intent classification ───────────────────────────────────────────────────

@pytest.mark.parametrize(
    "message,expected",
    [
        ("make a 4 days trip to dubai", "create_trip"),
        ("plan a 5 day vacation in paris", "create_trip"),
        ("Plan 5 days in Ljubljana", "create_trip"),
        ("plan 4 days in Bali", "create_trip"),
        ("4 day trip to bali", "create_trip"),
        ("filter 4 days packages", "filter_packages"),
        ("show 7 day packages", "filter_packages"),
        ("show dubai packages", "browse_packages"),
        ("fix my itinerary", "fix_itinerary"),
        ("rebuild the trip plan", "fix_itinerary"),
        ("add snorkeling on day 2", "modify_itinerary"),
        ("remove food tasting from day 3", "modify_itinerary"),
        ("add a train on day 2", "modify_itinerary"),
        ("delete the bus on day 4", "modify_itinerary"),
        ("what is the weather", "weather_query"),
        ("hi", "general"),
    ],
)
def test_infer_intent(message: str, expected: str):
    assert infer_intent(message) == expected


def test_create_trip_not_confused_with_filter():
    assert infer_intent("make a 4 days trip") == "create_trip"
    assert infer_intent("filter 4 days packages") == "filter_packages"


# ── Itinerary edit parsing ───────────────────────────────────────────────────

def test_parse_add_four_activities_to_day():
    edits = parse_itinerary_edits("can you add 4 more activities to day 3")
    assert len(edits) == 1
    assert edits[0]["edit"] == "add_activity"
    assert edits[0]["day"] == 3
    assert edits[0]["count"] == 4
    assert edits[0]["autoSuggest"] is True


def test_parse_add_activity():
    edits = parse_itinerary_edits("add snorkeling on day 2")
    assert len(edits) == 1
    assert edits[0]["edit"] == "add_activity"
    assert edits[0]["title"] == "Snorkeling"
    assert edits[0]["day"] == 2


# ── Generic bulk "add activities" must NEVER echo the command as a card title ─
# Regression for the "Activities To The Day 3" placeholder card: every one of
# these vague asks should route to an autoSuggest bulk edit on the *correct*
# day, never a literally-titled add_activity.
@pytest.mark.parametrize(
    "message,expected_day",
    [
        ("add activities to day 3", 3),
        ("add some activities to day 3", 3),
        ("add a few activities to day 3", 3),
        ("add a couple of activities to day 3", 3),
        ("add more activities to day 3", 3),
        ("add activities in day 3", 3),
        ("add activities day 3", 3),
        ("add activities to the day 3", 3),
        ("add activities to the day 3rd", 3),
        ("add several things to do on day 3", 3),
        ("add stuff to day 3", 3),
        ("add few activities to the day 3", 3),
        ("add some more activities to the day 3", 3),
        ("add activities to the day three", 3),
    ],
)
def test_generic_add_activities_routes_to_autosuggest(message: str, expected_day: int):
    edits = parse_itinerary_edits(message)
    assert len(edits) == 1
    edit = edits[0]
    assert edit["edit"] == "add_activity"
    assert edit["autoSuggest"] is True
    assert edit["day"] == expected_day
    assert edit.get("count", 0) >= 1
    assert "title" not in edit  # never a literally-titled placeholder card


def test_generic_add_activities_count_defaults_and_quantifiers():
    assert parse_itinerary_edits("add activities to day 3")[0]["count"] == 3
    assert parse_itinerary_edits("add a couple of activities to day 3")[0]["count"] == 2
    assert parse_itinerary_edits("add an activity to day 3")[0]["count"] == 1


@pytest.mark.parametrize(
    "message,title,day",
    [
        ("add snorkeling to day 3", "Snorkeling", 3),
        ("add a cooking class on day 2", "Cooking Class", 2),
        ("add a day trip to day 2", "Day Trip", 2),
    ],
)
def test_named_activity_stays_literal(message: str, title: str, day: int):
    edits = parse_itinerary_edits(message)
    assert edits == [{"edit": "add_activity", "title": title, "day": day}]


def test_extract_day_number_ordinal_after_day():
    assert extract_day_number("add activities to the day 3rd") == 3
    assert extract_day_number("add activities to the day 2nd") == 2


def test_parse_add_transport_train():
    edits = parse_itinerary_edits("add a train on day 2")
    assert edits == [{"edit": "add_transport", "transportType": "train", "day": 2}]


def test_parse_add_transport_transfer_maps_to_car():
    edits = parse_itinerary_edits("add transfer on day 1")
    assert edits[0]["transportType"] == "car"


def test_parse_swap_car_to_bus_natural_language():
    edits = parse_itinerary_edits("the toyota camry car change it to any bus available")
    assert edits == [
        {
            "edit": "swap_transport",
            "fromType": "car",
            "toType": "bus",
            "fromTitleMatch": "toyota camry",
            "day": 1,
        }
    ]


def test_parse_swap_change_day_car_to_bus():
    edits = parse_itinerary_edits("change day 1 car to a bus")
    assert edits[0]["edit"] == "swap_transport"
    assert edits[0]["fromType"] == "car"
    assert edits[0]["toType"] == "bus"
    assert edits[0]["day"] == 1
    assert edits[0].get("fromTitleMatch") is None


def test_parse_swap_change_to_bus():
    edits = parse_itinerary_edits("change toyota camry to bus")
    assert edits[0]["edit"] == "swap_transport"
    assert edits[0]["toType"] == "bus"
    assert edits[0]["fromTitleMatch"] == "toyota camry"


def test_parse_swap_replace_car_with_bus():
    edits = parse_itinerary_edits("replace the car with a bus")
    assert edits[0]["edit"] == "swap_transport"
    assert edits[0]["fromType"] == "car"
    assert edits[0]["toType"] == "bus"


def test_parse_remove_activity():
    edits = parse_itinerary_edits("remove food tasting from day 3")
    assert len(edits) == 1
    assert edits[0]["edit"] == "remove_item"
    assert edits[0]["titleMatch"] == "food tasting"
    assert edits[0]["day"] == 3
    assert edits[0]["itemType"] == "activity"


def test_parse_remove_transport():
    edits = parse_itinerary_edits("delete the train on day 2")
    assert edits[0]["itemType"] == "transport"


# ── Action building ──────────────────────────────────────────────────────────

def test_build_create_trip_action():
    # Destination + duration alone isn't enough signal for a good default
    # itinerary — no travelers, style, or interest means gather_trip_slots
    # asks one more question (see trip_planning_slots.ready_to_auto_create)
    # instead of silently creating a generic solo/standard/sightseeing trip.
    actions = build_actions("make a 4 day trip to Dubai")
    assert not any(a["type"] == "create_trip" for a in actions)


def test_build_create_trip_action_with_preference():
    actions = build_actions("make a 4 day trip to Dubai for 2 people, we love food")
    assert any(a["type"] == "create_trip" for a in actions)
    create = next(a for a in actions if a["type"] == "create_trip")
    assert create["destination"] == "Dubai"
    assert create["durationDays"] == 4
    assert create["coverageTier"] == "full"
    assert create["travelers"] == 2
    assert "food" in create["interests"]


def test_build_create_trip_uses_region_fallback():
    actions = build_actions("plan a 3 day trip for a family", region="Singapore")
    create = next(a for a in actions if a["type"] == "create_trip")
    assert create["destination"] == "Singapore"
    assert create["durationDays"] == 3


def test_build_filter_packages_action():
    actions = build_actions("filter 4 days packages")
    assert {"type": "filter_packages", "durationDays": 4} in [
        {k: a[k] for k in a if k in ("type", "durationDays")} for a in actions
    ]
    assert any(a["type"] == "navigate_packages" for a in actions)


def test_build_modify_itinerary_includes_trip_id():
    actions = build_actions("add snorkeling on day 2", trip_id="trip-abc")
    assert actions[0]["type"] == "itinerary_edit"
    assert actions[0]["tripId"] == "trip-abc"


def test_build_fix_itinerary_action():
    # Vague "fix my itinerary" asks what to fix — no auto rebuild.
    assert build_actions("fix my itinerary", trip_id="trip-xyz") == []
    # Explicit whole-trip language still rebuilds.
    assert build_actions("rebuild my whole itinerary", trip_id="trip-xyz") == [
        {"type": "rebuild_itinerary", "tripId": "trip-xyz"}
    ]


def test_build_browse_packages_with_destination():
    actions = build_actions("show bali packages")
    assert actions[0] == {"type": "navigate_packages", "destination": "Bali"}


def test_build_compare_prices_action():
    actions = build_actions("find cheapest 5 day bali packages")
    assert any(a["type"] == "sort_packages" for a in actions)


def test_build_multi_city_action():
    actions = build_actions("Paris → Rome → Barcelona in 10 days")
    assert any(a["type"] == "create_multi_city_trip" for a in actions)


def test_build_save_note_action():
    actions = build_actions("remind me sunset dinner on day 4", trip_id="trip-1")
    assert actions[0]["type"] == "save_trip_note"
    assert actions[0]["tripId"] == "trip-1"


def test_build_regenerate_action():
    actions = build_actions("make day 3 more relaxing", trip_id="trip-1")
    assert actions[0]["type"] == "regenerate_itinerary"
    assert actions[0]["day"] == 3


# ── Reply enrichment ─────────────────────────────────────────────────────────

def test_enrich_reply_create_trip():
    enriched = enrich_reply(
        "Sure!",
        "create_trip",
        "Dubai",
        "make a 4 day trip to dubai for 2 people",
        auto_actions=[{"type": "create_trip", "destination": "Dubai", "durationDays": 4}],
    )
    assert "Dubai" in " ".join(enriched.ui_status) or "4" in " ".join(enriched.ui_status)
    assert "pulled up" not in enriched.reply.lower()
    assert "you'll land" not in enriched.reply.lower()


def test_enrich_reply_modify_itinerary():
    enriched = enrich_reply("Done.", "modify_itinerary", None, "add snorkeling")
    assert enriched.ui_status
    assert "updated" in " ".join(enriched.ui_status).lower() or "itinerary" in " ".join(enriched.ui_status).lower()
    assert "I've updated your itinerary on the page" not in enriched.reply
    assert "couldn't apply" not in enriched.reply.lower()


def test_enrich_reply_modify_keeps_clarifying_model_voice():
    reply = (
        "On it — would you like to swap out something from today "
        "(like the Aquarium) for one of those new activities, or just slot them in alongside?"
    )
    # Unparsed vague ask: keep model voice, never splice failure.
    enriched = enrich_reply(reply, "modify_itinerary", "Dubai", "what do you think?")
    assert "couldn't apply" not in enriched.reply.lower()
    assert "Aquarium" in enriched.reply

    # Parsed bulk add: don't leave a contradictory open question.
    bulk = enrich_reply(reply, "modify_itinerary", "Dubai", "add more fun stuff")
    assert "couldn't apply" not in bulk.reply.lower()
    assert bulk.ui_status
    assert "alongside" not in bulk.reply.lower()

