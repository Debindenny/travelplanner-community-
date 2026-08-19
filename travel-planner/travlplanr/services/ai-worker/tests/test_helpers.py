"""Pure-logic tests for the ai-worker prompt builder and response parser.

No DB/Redis/network — _build_prompt is pure string formatting and
_parse_segments is pure JSON parsing (tolerating markdown fences). Importing
app.main only instantiates ServiceSettings (env/defaults) and configures
logging; no I/O happens at import time.
"""
from __future__ import annotations

import pytest

from app.main import _build_prompt, _parse_segments


def test_build_prompt_includes_destination_and_duration():
    payload = {"duration_days": 7, "travelers": 3, "budget": "luxury"}
    prompt = _build_prompt(payload, "Tokyo", "cust-42")
    assert "Tokyo" in prompt
    assert "7-day" in prompt
    assert "cust-42" in prompt
    assert "3 travelers" in prompt
    assert "luxury" in prompt


def test_build_prompt_uses_defaults_for_missing_fields():
    prompt = _build_prompt({}, "Paris", "cust-1")
    # duration default 4, travelers default 1, budget default 'standard'
    assert "4-day" in prompt
    assert "1 travelers" in prompt
    assert "standard" in prompt
    # interests default phrase and food default
    assert "general attractions" in prompt
    assert "any" in prompt


def test_build_prompt_joins_interests_and_food():
    payload = {
        "interests": ["museums", "food"],
        "food_preferences": ["vegetarian", "halal"],
    }
    prompt = _build_prompt(payload, "Rome", "cust-2")
    assert "museums, food" in prompt
    assert "vegetarian, halal" in prompt


def test_parse_segments_plain_json():
    text = '{"segments": [{"type": "flight", "day": 1}]}'
    segments = _parse_segments(text)
    assert segments == [{"type": "flight", "day": 1}]


def test_parse_segments_strips_json_fence():
    text = '```json\n{"segments": [{"type": "hotel", "day": 1}]}\n```'
    segments = _parse_segments(text)
    assert segments[0]["type"] == "hotel"


def test_parse_segments_strips_bare_fence():
    text = '```\n{"segments": [{"type": "activity", "day": 2}]}\n```'
    segments = _parse_segments(text)
    assert segments[0]["day"] == 2


def test_parse_segments_empty_list_raises():
    with pytest.raises(ValueError):
        _parse_segments('{"segments": []}')


def test_parse_segments_missing_key_raises():
    with pytest.raises(ValueError):
        _parse_segments('{"other": 1}')


def test_parse_segments_non_list_raises():
    with pytest.raises(ValueError):
        _parse_segments('{"segments": {"not": "a list"}}')


def test_parse_segments_invalid_json_raises():
    import json

    with pytest.raises(json.JSONDecodeError):
        _parse_segments("definitely not json")
