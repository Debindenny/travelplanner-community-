"""Unit tests for local chat tooling and adaptive token budgets."""

from app.services.chat_providers import chat_max_tokens
from app.services.chat_tools import (
    ChatToolContext,
    execute_chat_tool,
    format_tool_results_for_prompt,
    parse_ollama_tool_calls,
)


def test_chat_max_tokens_short_vs_detail():
    assert chat_max_tokens("hi") <= 300
    assert chat_max_tokens("give me a detailed day by day itinerary for bali") >= 800


def test_execute_chat_tools_return_context():
    ctx = ChatToolContext(
        trip_summary="Day 1: Marina Walk",
        catalog_context="Dubai Deluxe — 4 days — ₹45000",
        platform_context="Free plan includes 1 trip.",
        known_slots={"destination": "Dubai", "duration_days": 4},
    )
    assert "Marina" in execute_chat_tool("get_current_itinerary", {}, ctx)
    assert "Deluxe" in execute_chat_tool("search_packages", {"destination": "Dubai"}, ctx)
    assert "Dubai" in execute_chat_tool("get_trip_slots", {}, ctx)
    assert "Free plan" in execute_chat_tool("get_platform_info", {}, ctx)


def test_parse_ollama_tool_calls():
    payload = {
        "message": {
            "tool_calls": [
                {"function": {"name": "get_trip_slots", "arguments": {}}},
                {"function": {"name": "search_packages", "arguments": '{"destination":"Bali"}'}},
            ]
        }
    }
    calls = parse_ollama_tool_calls(payload)
    assert calls[0][0] == "get_trip_slots"
    assert calls[1] == ("search_packages", {"destination": "Bali"})


def test_format_tool_results_for_prompt():
    text = format_tool_results_for_prompt([("get_trip_slots", "destination=Bali")])
    assert "TOOL RESULTS" in text
    assert "<get_trip_slots>" in text
