"""Tests for web place research service."""

from __future__ import annotations

from app.services.place_research_service import format_place_research_for_prompt


def test_format_place_research_for_prompt_includes_summary_and_attractions():
    research = {
        "place": "Ljubljana",
        "summary": "Ljubljana is the capital of Slovenia.",
        "attractions": [
            {
                "name": "Ljubljana Castle",
                "address": "Grajska planota 1",
                "rating": 4.6,
                "types": ["tourist_attraction", "point_of_interest"],
            }
        ],
        "landmarks": ["Ljubljana Castle"],
        "sources": ["wikipedia", "google_places"],
    }
    prompt = format_place_research_for_prompt(research)
    assert "Ljubljana" in prompt
    assert "capital of Slovenia" in prompt
    assert "Ljubljana Castle" in prompt
    assert "WEB RESEARCH" in prompt


def test_format_place_research_for_prompt_empty():
    assert format_place_research_for_prompt({}) == ""
