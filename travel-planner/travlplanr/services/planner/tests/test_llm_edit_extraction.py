"""Tests for the pure normalization layer of the LLM edit extractor.

Network-dependent extraction (`extract_edit_via_llm`) degrades to `[]` on any
failure by design, so only the deterministic `normalize_llm_edit` mapping is
unit-tested here."""
from __future__ import annotations

import pytest

from app.services.llm_edit_extraction import normalize_llm_edit


def test_none_action_returns_empty():
    assert normalize_llm_edit({"action": "none"}) == []
    assert normalize_llm_edit({"action": "banana"}) == []
    assert normalize_llm_edit({}) == []


def test_generic_add_activity_becomes_autosuggest():
    out = normalize_llm_edit(
        {"action": "add_activity", "day": 3, "count": 2, "is_generic": True, "specific_title": None}
    )
    assert out == [{"edit": "add_activity", "day": 3, "count": 2, "autoSuggest": True}]


def test_generic_add_activity_defaults_count_to_three():
    out = normalize_llm_edit({"action": "add_activity", "day": 3, "is_generic": True})
    assert out == [{"edit": "add_activity", "day": 3, "count": 3, "autoSuggest": True}]


def test_specific_add_activity_titlecased():
    out = normalize_llm_edit(
        {"action": "add_activity", "day": 2, "is_generic": False, "specific_title": "sunset kayak tour"}
    )
    assert out == [{"edit": "add_activity", "title": "Sunset Kayak Tour", "day": 2}]


def test_title_with_day_fragment_falls_back_to_generic():
    # The model leaked a "day N" into the title — must not become a literal card.
    out = normalize_llm_edit(
        {"action": "add_activity", "day": 3, "is_generic": False, "specific_title": "activities to the day 3"}
    )
    assert out == [{"edit": "add_activity", "day": 3, "count": 3, "autoSuggest": True}]


def test_day_out_of_range_is_dropped():
    out = normalize_llm_edit(
        {"action": "add_activity", "day": 9, "is_generic": True}, total_days=5
    )
    assert out == [{"edit": "add_activity", "day": 1, "count": 3, "autoSuggest": True}]


def test_add_transport_valid_and_invalid():
    assert normalize_llm_edit({"action": "add_transport", "day": 2, "transport_type": "train"}) == [
        {"edit": "add_transport", "transportType": "train", "day": 2}
    ]
    assert normalize_llm_edit({"action": "add_transport", "day": 2, "transport_type": "spaceship"}) == []


def test_remove_item():
    out = normalize_llm_edit(
        {"action": "remove_item", "day": 3, "specific_title": "Food Tour", "is_generic": False}
    )
    assert out == [{"edit": "remove_item", "titleMatch": "Food Tour", "day": 3, "itemType": "activity"}]


@pytest.mark.parametrize("bad_day", [0, -1, True, "3", 999])
def test_bad_day_values_default_safely(bad_day):
    out = normalize_llm_edit({"action": "add_activity", "day": bad_day, "is_generic": True})
    assert out[0]["day"] == 1
