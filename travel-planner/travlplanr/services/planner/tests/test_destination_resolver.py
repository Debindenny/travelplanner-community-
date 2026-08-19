"""Tests for tiered destination resolution (supported / draft_eligible / unknown)."""
from __future__ import annotations

import pytest

from app.services.destination_resolver import (
    ResolvedDestination,
    resolve_destination,
    similar_destinations,
    _is_valid_draft_place,
)


PARIS_ID = "11111111-1111-1111-1111-111111111111"
LJUBLJANA_ID = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def catalog() -> tuple[set[str], dict[str, str]]:
    return (
        {"paris", "dubai", "bali", "singapore"},
        {
            "paris": PARIS_ID,
            "dubai": "33333333-3333-3333-3333-333333333333",
            "bali": "44444444-4444-4444-4444-444444444444",
            "singapore": "55555555-5555-5555-5555-555555555555",
        },
    )


# ── Supported (pattern + catalog) ─────────────────────────────────────────────

@pytest.mark.parametrize(
    "message,expected_name",
    [
        ("Plan 5 days in Paris", "Paris"),
        ("make a 4 day trip to Dubai", "Dubai"),
        ("show me Bali packages", "Bali"),
        ("visit the UAE", "Dubai"),
    ],
)
def test_resolve_supported_from_patterns(message: str, expected_name: str, catalog):
    names, by_id = catalog
    resolved = resolve_destination(message, supported_names=names, supported_by_id=by_id)
    assert resolved.tier == "supported"
    assert resolved.display_name == expected_name
    assert resolved.destination_id == by_id.get(expected_name.lower())


def test_resolve_supported_from_db_catalog_only(catalog):
    names, by_id = catalog
    resolved = resolve_destination(
        "trip to Singapore",
        supported_names=names,
        supported_by_id=by_id,
    )
    assert resolved.tier == "supported"
    assert resolved.display_name == "Singapore"
    assert resolved.destination_id == by_id["singapore"]


def test_resolve_supported_via_page_region(catalog):
    names, by_id = catalog
    resolved = resolve_destination(
        "add snorkeling on day 2",
        region="Paris",
        supported_names=names,
        supported_by_id=by_id,
    )
    assert resolved.tier == "supported"
    assert resolved.display_name == "Paris"


# ── Draft eligible ────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "message,expected_place",
    [
        ("Plan 5 days in Ljubljana", "Ljubljana"),
        ("plan a trip to Zagreb", "Zagreb"),
        ("visit Reykjavik for a week", "Reykjavik"),
        ("make a 7 day trip to Lisbon", "Lisbon"),
        ("explore Tbilisi", "Tbilisi"),
    ],
)
def test_resolve_draft_eligible_places(message: str, expected_place: str, catalog):
    names, by_id = catalog
    resolved = resolve_destination(message, supported_names=names, supported_by_id=by_id)
    assert resolved.tier == "draft_eligible"
    assert resolved.display_name == expected_place
    assert resolved.destination_id is None
    assert len(resolved.similar) == 3


def test_draft_eligible_similar_destinations_for_balkans():
    similar = similar_destinations("Ljubljana")
    assert similar == ["Italy", "Austria", "Greece"]


def test_draft_eligible_similar_defaults_for_unknown_region():
    similar = similar_destinations("Foobarville")
    assert len(similar) == 3
    assert "Italy" in similar or "Dubai" in similar


# ── Unknown / blocklisted ─────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "message",
    [
        "somewhere warm",
        "plan a beach vacation",
        "hi there",
        "what can you do",
        "plan a 5 day trip",  # no place
    ],
)
def test_resolve_unknown_without_place(message: str, catalog):
    names, by_id = catalog
    resolved = resolve_destination(message, supported_names=names, supported_by_id=by_id)
    assert resolved.tier == "unknown"
    assert resolved.display_name is None
    assert len(resolved.similar) == 3


@pytest.mark.parametrize(
    "place,valid",
    [
        ("Ljubljana", True),
        ("St. John's", True),
        ("a", False),
        ("warm", False),
        ("somewhere", False),
        ("5 days", False),
        ("", False),
        ("x" * 50, False),
        ("Paris123", False),
    ],
)
def test_is_valid_draft_place(place: str, valid: bool):
    assert _is_valid_draft_place(place) is valid


def test_resolve_draft_not_confused_with_blocklist_words(catalog):
    names, by_id = catalog
    resolved = resolve_destination(
        "plan a warm trip",
        supported_names=names,
        supported_by_id=by_id,
    )
    assert resolved.tier == "unknown"


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_resolve_case_insensitive_catalog_match(catalog):
    names, by_id = catalog
    resolved = resolve_destination(
        "packages in PARIS",
        supported_names=names,
        supported_by_id=by_id,
    )
    assert resolved.tier == "supported"
    assert resolved.display_name == "Paris"


def test_resolve_empty_message(catalog):
    names, by_id = catalog
    resolved = resolve_destination("", supported_names=names, supported_by_id=by_id)
    assert resolved.tier == "unknown"


def test_resolve_whitespace_only_region(catalog):
    names, by_id = catalog
    resolved = resolve_destination("plan a trip", region="   ", supported_names=names, supported_by_id=by_id)
    assert resolved.tier == "unknown"


def test_resolved_destination_dataclass_defaults():
    r = ResolvedDestination()
    assert r.tier == "unknown"
    assert r.similar == []


def test_resolve_standalone_place_name_as_draft_eligible(catalog):
    names, by_id = catalog
    resolved = resolve_destination("Ljubljana", supported_names=names, supported_by_id=by_id)
    assert resolved.tier == "draft_eligible"
    assert resolved.display_name == "Ljubljana"


def test_resolve_standalone_supported_place(catalog):
    names, by_id = catalog
    resolved = resolve_destination("Paris", supported_names=names, supported_by_id=by_id)
    assert resolved.tier == "supported"
    assert resolved.display_name == "Paris"


# ── Open-itinerary region must not override a new place in the message ────────

@pytest.mark.parametrize(
    "message,expected",
    [
        ("plan a trip to Chalakudy for 3 days", "Chalakudy"),
        ("plan a trip to Goa from Bangalore", "Goa"),
        ("plan a 4 day trip to Goa from Bangalore, couple", "Goa"),
        ("plan a trip to Mumbai for 4 days", "Mumbai"),
        ("plan a trip from bangalore to goa", "Goa"),
    ],
)
def test_message_place_wins_over_page_region(message: str, expected: str):
    resolved = resolve_destination(message, region="Australia")
    assert resolved.display_name == expected


@pytest.mark.parametrize(
    "message",
    [
        "3 days",
        "add snorkeling on day 2",
        "make it a couple trip",
    ],
)
def test_followup_without_place_keeps_page_region(message: str):
    resolved = resolve_destination(message, region="Australia")
    assert resolved.display_name == "Australia"
    assert resolved.tier == "supported"
