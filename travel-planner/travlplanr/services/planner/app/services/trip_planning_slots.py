"""Collect trip planning fields from chat turns before auto-creating itineraries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from app.services.chat_intent import (
    _guess_unrecognized_place,
    extract_budget_tier,
    extract_destination,
    extract_duration_days,
    extract_interests,
    extract_travel_style,
    extract_travelers,
)
from app.services.trip_route import extract_departure_city, extract_trip_route

if TYPE_CHECKING:
    from app.services.destination_resolver import ResolvedDestination


@dataclass
class TripPlanningSlots:
    destination: str | None = None
    duration_days: int | None = None
    travelers: int | None = None
    travel_style: str | None = None
    budget: str | None = None
    interests: list[str] = field(default_factory=list)
    departure_location: str | None = None
    arrival_location: str | None = None
    tier: str = "unknown"
    # True only when the value came from the user's own words (this message or
    # history), never from the best-effort LLM hint pass. The small local model
    # used for hinting sometimes fills these in despite being told not to guess,
    # so auto-creating a real trip must never rely on a hint alone.
    duration_confirmed: bool = False
    travelers_confirmed: bool = False
    prefs_confirmed: bool = False


def _value_from_history(history: list[dict] | None, extractor) -> Any:
    for turn in reversed(history or []):
        if turn.get("role") != "user":
            continue
        value = extractor(turn["content"])
        if value:
            return value
    return None


def gather_trip_slots(
    message: str,
    *,
    history: list[dict] | None = None,
    region: str | None = None,
    resolved: ResolvedDestination | None = None,
    llm_hints: dict[str, Any] | None = None,
    known_slots: dict[str, Any] | None = None,
) -> TripPlanningSlots:
    """Extract trip-planning slots from the message/history.

    `llm_hints` (see llm_slot_extraction.py) fills gaps this regex pass
    leaves empty — e.g. "a week" for duration, or a destination outside the
    DESTINATION_PATTERNS table. Regex results always win when present; a
    hint is only used for a field regex found nothing for.

    `known_slots` are client-confirmed values from the "Trip so far" UI —
    treated as confirmed when regex/history left the field empty.
    """
    route = extract_trip_route(message) or _value_from_history(history, extract_trip_route)
    departure = (
        (route[0] if route else None)
        or extract_departure_city(message)
        or _value_from_history(history, extract_departure_city)
    )
    arrival = route[1] if route else None
    hints = llm_hints or {}
    known = known_slots or {}

    # Origin-only statements must not replace the trip destination with the home city.
    origin_only = bool(extract_departure_city(message)) and not route

    destination = (
        (resolved.display_name if resolved else None)
        or arrival
        or (None if origin_only else extract_destination(message))
        or (None if origin_only else _value_from_history(history, extract_destination))
        or (None if origin_only else _guess_unrecognized_place(message))
        or (None if origin_only else _value_from_history(history, _guess_unrecognized_place))
        or region
        or hints.get("destination")
        or known.get("destination")
    )

    duration_regex = extract_duration_days(message) or _value_from_history(history, extract_duration_days)
    duration = duration_regex or hints.get("duration_days") or known.get("duration_days")
    duration_confirmed = duration_regex is not None or (
        duration is not None and known.get("duration_days") is not None and duration_regex is None and not hints.get("duration_days")
    )
    # Client-confirmed duration counts even when it came only from known_slots.
    if duration is not None and known.get("duration_days") is not None and duration == known.get("duration_days"):
        duration_confirmed = True
    if duration_regex is not None:
        duration_confirmed = True

    travelers_regex = extract_travelers(message) or _value_from_history(history, extract_travelers)
    travelers = travelers_regex or hints.get("travelers") or known.get("travelers")
    travelers_confirmed = travelers_regex is not None
    if travelers is not None and known.get("travelers") is not None and travelers == known.get("travelers"):
        travelers_confirmed = True
    if travelers_regex is not None:
        travelers_confirmed = True

    travel_style_regex = extract_travel_style(message) or _value_from_history(history, extract_travel_style)
    travel_style = travel_style_regex or hints.get("travel_style") or known.get("travel_style")

    budget_regex = extract_budget_tier(message) or _value_from_history(history, extract_budget_tier)
    budget = budget_regex or hints.get("budget") or known.get("budget")
    departure = departure or hints.get("departure_location") or known.get("departure_location")

    interests_regex: list[str] = []
    for source in (message, *[
        t["content"] for t in (history or []) if t.get("role") == "user"
    ]):
        found = extract_interests(source)
        if found:
            for item in found:
                if item not in interests_regex:
                    interests_regex.append(item)
    interests = list(interests_regex)
    if not interests and hints.get("interests"):
        interests = list(hints["interests"])
    if not interests and known.get("interests"):
        interests = list(known["interests"])

    prefs_confirmed = bool(travel_style_regex or budget_regex or interests_regex)
    if not prefs_confirmed and (known.get("travel_style") or known.get("budget") or known.get("interests")):
        prefs_confirmed = True

    if resolved and resolved.tier:
        tier = resolved.tier
    elif extract_destination(message) or _value_from_history(history, extract_destination):
        tier = "supported"
    elif region and destination and destination.lower() == region.lower():
        tier = "supported"
    elif hints.get("destination") and destination == hints.get("destination"):
        tier = "draft_eligible"
    else:
        tier = "unknown"

    return TripPlanningSlots(
        destination=destination,
        duration_days=duration,
        travelers=travelers,
        travel_style=travel_style,
        budget=budget,
        interests=interests,
        departure_location=departure,
        arrival_location=arrival or destination,
        tier=tier,
        duration_confirmed=duration_confirmed,
        travelers_confirmed=travelers_confirmed,
        prefs_confirmed=prefs_confirmed,
    )


def _has_confirmed_prefs(slots: TripPlanningSlots) -> bool:
    return slots.prefs_confirmed and bool(slots.travel_style or slots.budget or slots.interests)


def message_advances_planning_slots(message: str) -> bool:
    """True when this user turn supplies at least one planning field.

    Used by the chat router to promote vague follow-ups ("3 days", "just us",
    "starting from Bangalore") into create_trip once enough slots accumulate.
    """
    if not (message or "").strip():
        return False
    return bool(
        extract_trip_route(message)
        or extract_departure_city(message)
        or extract_destination(message)
        or extract_duration_days(message) is not None
        or extract_travelers(message) is not None
        or extract_travel_style(message)
        or extract_budget_tier(message)
        or extract_interests(message)
    )


def ready_to_auto_create(slots: TripPlanningSlots) -> bool:
    """Require destination, an explicitly-stated trip length, and explicitly-stated
    travelers or preferences. Values that only came from the best-effort LLM hint
    pass (see llm_slot_extraction.py) don't count here — they're informative, but
    never sufficient on their own to auto-create a real itinerary."""
    if not slots.destination or slots.duration_days is None or not slots.duration_confirmed:
        return False
    has_party = slots.travelers is not None and slots.travelers_confirmed
    return has_party or _has_confirmed_prefs(slots)


def collection_prompt(slots: TripPlanningSlots, *, locale: str | None = None) -> str:
    lang = (locale or "en").lower()[:2]
    if not slots.destination:
        return {
            "fr": "Quelle ville ou quel pays dois-je planifier ?",
            "es": "¿Qué ciudad o país debo planear?",
        }.get(lang, "Which city or country should I plan for?")
    if slots.duration_days is None or not slots.duration_confirmed:
        return {
            "fr": f"Combien de jours pour {slots.destination} ? Par exemple : 4 jours, ou un long week-end.",
            "es": f"¿Cuántos días para {slots.destination}? Por ejemplo: 4 días, o un fin de semana largo.",
        }.get(
            lang,
            f"How many days should I plan for {slots.destination}? "
            "For example: 4 days, or a long weekend.",
        )
    # Ask one thing at a time — travelers first, then focus.
    if slots.travelers is None or not slots.travelers_confirmed:
        return {
            "fr": f"{slots.destination} pour {slots.duration_days} jours — combien de voyageurs ?",
            "es": f"{slots.destination} por {slots.duration_days} días — ¿cuántos viajeros?",
        }.get(
            lang,
            f"Got {slots.destination} for {slots.duration_days} days — how many travelers?",
        )
    if not _has_confirmed_prefs(slots):
        return {
            "fr": "Quel focus pour le voyage (food, culture, aventure, détente, famille) ?",
            "es": "¿Qué enfoque quieres (comida, cultura, aventura, relax, familia)?",
        }.get(
            lang,
            "What should the trip focus on (food, culture, adventure, relaxed, family-friendly)?",
        )
    return ""


def slots_for_response(slots: TripPlanningSlots) -> dict[str, Any]:
    """Shape slots for the `/chat` response so the client can render a live
    "trip so far" chip row instead of the wizard's fixed step sequence.
    Only values the user actually stated are reported as captured — anything
    that only came from the best-effort LLM hint pass is reported as missing
    instead, so the UI never claims to know something it's merely guessed."""
    has_prefs = _has_confirmed_prefs(slots)
    missing: list[str] = []
    if not slots.destination:
        missing.append("destination")
    if slots.duration_days is None or not slots.duration_confirmed:
        missing.append("duration_days")
    if (slots.travelers is None or not slots.travelers_confirmed) and not has_prefs:
        missing.append("travelers_or_focus")
    return {
        "destination": slots.destination,
        "duration_days": slots.duration_days if slots.duration_confirmed else None,
        "travelers": slots.travelers if slots.travelers_confirmed else None,
        "travel_style": slots.travel_style if slots.prefs_confirmed else None,
        "budget": slots.budget if slots.prefs_confirmed else None,
        "interests": slots.interests if slots.prefs_confirmed else [],
        "ready": ready_to_auto_create(slots),
        "missing": missing,
    }


def slots_to_trip_action_fields(slots: TripPlanningSlots) -> dict[str, Any]:
    travelers = slots.travelers or 1
    travel_style = slots.travel_style
    if not travel_style:
        if travelers > 2:
            travel_style = "friends"
        elif travelers == 2:
            travel_style = "couple"
        else:
            travel_style = "solo"

    return {
        "destination": slots.destination,
        "durationDays": slots.duration_days,
        "travelers": travelers,
        "travelStyle": travel_style,
        "budget": slots.budget or "standard",
        "interests": slots.interests or ["sightseeing"],
        "departureLocation": slots.departure_location,
        "arrivalLocation": slots.arrival_location or slots.destination,
        "coverageTier": "full" if slots.tier == "supported" else "draft",
    }
