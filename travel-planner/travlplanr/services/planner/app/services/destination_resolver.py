"""Resolve user-mentioned places into supported / draft / unknown tiers."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from app.services.chat_intent import DESTINATION_PATTERNS, _guess_unrecognized_place, extract_destination
from app.services.trip_route import extract_trip_route

DestinationTier = Literal["supported", "draft_eligible", "unknown"]

_BLOCKLIST = frozenset(
    {
        "a",
        "an",
        "the",
        "my",
        "our",
        "your",
        "trip",
        "vacation",
        "holiday",
        "itinerary",
        "plan",
        "warm",
        "cold",
        "beach",
        "mountains",
        "somewhere",
        "anywhere",
        "europe",
        "asia",
        "africa",
    }
)

# Common conversational filler — a candidate made up *entirely* of these words
# (e.g. "hi there", "what can you do") is a greeting/question, not a place name.
# Checked with `all()` rather than `any()` so real destinations that happen to
# contain one such word (rare, but possible) aren't rejected outright.
_CONVERSATIONAL_STOPWORDS = frozenset(
    {
        "hi", "hello", "hey", "there", "what", "how", "why", "who", "when",
        "can", "could", "would", "should", "do", "does", "did", "is", "are",
        "am", "you", "your", "yours", "i", "we", "us", "it", "this", "that",
        "these", "those", "here", "help", "please", "thanks", "thank", "ok",
        "okay", "yes", "no", "work", "works", "working",
    }
)

_SIMILAR_BY_PATTERN: list[tuple[str, list[str]]] = [
    (r"\b(slovenia|ljubljana|balkans?)\b", ["Italy", "Austria", "Greece"]),
    (r"\b(croatia|zagreb|split|dubrovnik)\b", ["Italy", "Greece", "Spain"]),
    (r"\b(portugal|lisbon|porto)\b", ["Spain", "Italy", "France"]),
    (r"\b(colombia|cartagena|medellin)\b", ["Bali", "Thailand", "Dubai"]),
    (r"\b(peru|lima|cusco)\b", ["Dubai", "Bali", "Thailand"]),
    (r"\b(iceland|reykjavik)\b", ["Norway", "Finland", "Switzerland"]),
    (r"\b(georgia|tbilisi)\b", ["Turkey", "Greece", "Dubai"]),
    (r"\b(vietnam|hanoi|ho chi minh)\b", ["Thailand", "Bali", "Singapore"]),
    (r"\b(czech|prague)\b", ["Austria", "Germany", "France"]),
    (r"\b(hungary|budapest)\b", ["Austria", "Italy", "Greece"]),
]

_DEFAULT_SIMILAR = ["Italy", "France", "Thailand", "Bali", "Dubai", "Japan"]

# Common spelling variants → canonical display name
_PLACE_ALIASES: dict[str, str] = {
    "banagalore": "Bangalore",
    "bangalore": "Bangalore",
    "bengaluru": "Bangalore",
    "bombay": "Mumbai",
    "madras": "Chennai",
    "calcutta": "Kolkata",
    # Frequent chat typos
    "dubain": "Dubai",
    "dubay": "Dubai",
    "dbuai": "Dubai",
    "duabi": "Dubai",
    "parris": "Paris",
    "balii": "Bali",
    "bally": "Bali",
    "singapur": "Singapore",
    "singpore": "Singapore",
    "tailand": "Thailand",
    "thailandia": "Thailand",
}


@dataclass
class ResolvedDestination:
    raw_query: str | None = None
    display_name: str | None = None
    tier: DestinationTier = "unknown"
    destination_id: str | None = None
    similar: list[str] = field(default_factory=list)


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _title_place(name: str) -> str:
    from app.services.chat_intent import _strip_place_trailer

    cleaned = _strip_place_trailer(name)
    cleaned = re.sub(
        r"\s+(?:from|starting|on)\s+(?:next\s+|this\s+)?"
        r"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|weekend|today|tomorrow)\b.*$",
        "",
        cleaned.strip(" .!?"),
        flags=re.I,
    )
    cleaned = re.sub(r"\s+", " ", cleaned)
    titled = cleaned.title() if cleaned else cleaned
    aliased = _PLACE_ALIASES.get(_normalize_name(titled), titled)
    # Fuzzy: single-token near-miss against curated destinations (e.g. dubain→Dubai).
    if aliased == titled and " " not in titled:
        fuzzy = _fuzzy_canonical(titled)
        if fuzzy:
            return fuzzy
    return aliased


def _fuzzy_canonical(name: str) -> str | None:
    """Map short typos to DESTINATION_PATTERNS canonical names (edit distance ≤ 2)."""
    token = _normalize_name(name)
    if len(token) < 4:
        return None
    best: str | None = None
    best_dist = 99
    seen: set[str] = set()
    for _pattern, canonical in DESTINATION_PATTERNS:
        key = _normalize_name(canonical)
        if key in seen:
            continue
        seen.add(key)
        # Prefer same starting letter to avoid random collisions.
        if token[0] != key[0]:
            continue
        dist = _edit_distance(token, key)
        if dist < best_dist and dist <= 2:
            best_dist = dist
            best = canonical
    return best


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 2:
        return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            ins = cur[j - 1] + 1
            delete = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[-1]


def _is_valid_draft_place(name: str) -> bool:
    cleaned = _normalize_name(name)
    if len(cleaned) < 2 or len(cleaned) > 48:
        return False
    if cleaned in _BLOCKLIST:
        return False
    tokens = cleaned.split()
    if any(token in _BLOCKLIST for token in tokens):
        return False
    if all(token in _CONVERSATIONAL_STOPWORDS for token in tokens):
        return False
    # Reject departure statements titled as places ("I'm Starting From Delhi").
    if "from" in tokens and any(
        t in {"starting", "departing", "leaving", "flying", "traveling", "travelling", "i'm", "im", "i"}
        for t in tokens
    ):
        return False
    if not re.match(r"^[a-z][a-z\s\-'.]{1,47}$", cleaned, re.I):
        return False
    if re.search(r"\b(day|days|people|person|budget|trip|plan)\b", cleaned):
        return False
    # Reject verb-led phrases ("relax on a beach") pretending to be places.
    if tokens and tokens[0] in {
        "relax", "relaxing", "want", "need", "looking", "search", "find",
        "book", "visit", "explore", "go", "going", "travel", "traveling",
        "travelling", "plan", "planning", "make", "create", "build", "see",
        "stay", "fly",
    }:
        return False
    return True


def _extract_place_candidate(message: str) -> str | None:
    route = extract_trip_route(message)
    if route:
        candidate = _title_place(route[1])
        if _is_valid_draft_place(candidate):
            return candidate

    guess = _guess_unrecognized_place(message)
    if guess and _is_valid_draft_place(guess):
        return _title_place(guess)

    patterns = [
        r"\b(?:trip|vacation|holiday|itinerar\w*)\s+to\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?=\s+from\b|\s+for\s+\d|\s+with\s+|,|\s*$|[.!?])",
        r"\b(?:plan|build|create|make)\s+(?:a\s+)?(?:\d+\s*-?\s*day\s+)?(?:trip\s+to\s+)([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?=\s+from\b|\s+for\s+\d|\s+with\s+|,|\s*$|[.!?])",
        r"\b(?:plan|build|create|make)\s+(?:a\s+)?(?:\d+\s*-?\s*day\s+)?(?:trip\s+to\s+)?([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?=\s+for\s+\d|\s+with\s+|\s*$|[.!?])",
        r"\b(?:visit|explore|go\s+to)\s+([A-Za-z][A-Za-z\-'.]+)",
        # "chalakudy 3 days couple" / "Bali 5 days"
        r"^([A-Za-z][A-Za-z\s\-'.]{1,40}?)\s+\d+\s*(?:day|days|night|nights)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, message.strip(), re.I)
        if not match:
            continue
        candidate = _title_place(match.group(1))
        if _is_valid_draft_place(candidate):
            return candidate
    return None


def _is_supported_name(name: str, supported_names: set[str] | None) -> bool:
    normalized = _normalize_name(name)
    if extract_destination(name):
        return True
    if supported_names and normalized in supported_names:
        return True
    for pattern, canonical in DESTINATION_PATTERNS:
        if re.search(pattern, normalized) or _normalize_name(canonical) == normalized:
            return True
    return False


def similar_destinations(place: str | None) -> list[str]:
    text = (place or "").lower()
    for pattern, options in _SIMILAR_BY_PATTERN:
        if re.search(pattern, text, re.I):
            return options[:3]
    return _DEFAULT_SIMILAR[:3]


def canonicalize_place_name(name: str | None) -> str | None:
    """Normalize a free-typed place for titles/storage (typos + trailer junk)."""
    if not name or not str(name).strip():
        return None
    return _title_place(str(name).strip())


def resolve_destination(
    message: str,
    *,
    region: str | None = None,
    supported_names: set[str] | None = None,
    supported_by_id: dict[str, str] | None = None,
) -> ResolvedDestination:
    """Classify a place mention for chat trip flows."""
    supported_by_id = supported_by_id or {}

    # Origin-only statements are not destination changes ("starting from Delhi").
    from app.services.trip_route import extract_departure_city, extract_trip_route

    if extract_departure_city(message) and not extract_trip_route(message):
        if region:
            if _is_supported_name(region, supported_names):
                dest_id = supported_by_id.get(_normalize_name(region))
                return ResolvedDestination(
                    raw_query=region,
                    display_name=region,
                    tier="supported",
                    destination_id=dest_id,
                    similar=similar_destinations(region),
                )
            if _is_valid_draft_place(region):
                return ResolvedDestination(
                    raw_query=region,
                    display_name=_title_place(region),
                    tier="draft_eligible",
                    similar=similar_destinations(region),
                )
        return ResolvedDestination(tier="unknown", similar=_DEFAULT_SIMILAR[:3])

    # A "from X to Y" route names the destination explicitly — the arrival must
    # win over the curated-list scan below, which is position-independent and
    # would return the *origin* when only the origin is a famous place
    # ("from Bangalore to Chalakudy" must resolve to Chalakudy, not Bangalore).
    route = extract_trip_route(message)
    if route:
        arrival = _title_place(route[1])
        if _is_valid_draft_place(arrival):
            if _is_supported_name(arrival, supported_names):
                return ResolvedDestination(
                    raw_query=arrival,
                    display_name=arrival,
                    tier="supported",
                    destination_id=supported_by_id.get(_normalize_name(arrival)),
                    similar=similar_destinations(arrival),
                )
            return ResolvedDestination(
                raw_query=arrival,
                display_name=arrival,
                tier="draft_eligible",
                similar=similar_destinations(arrival),
            )

    # Explicit place phrasing ("trip to Goa from Bangalore") must beat a
    # position-independent curated scan that would otherwise return the origin.
    candidate = _extract_place_candidate(message)
    if candidate:
        fuzzy = _PLACE_ALIASES.get(candidate.lower()) or _fuzzy_canonical(
            re.sub(r"[^a-z]", "", candidate.lower())
        )
        if fuzzy and _is_supported_name(fuzzy, supported_names):
            display = fuzzy
        elif _is_supported_name(candidate, supported_names):
            display = extract_destination(candidate) or candidate
        else:
            return ResolvedDestination(
                raw_query=candidate,
                display_name=candidate,
                tier="draft_eligible",
                similar=similar_destinations(candidate),
            )
        dest_id = supported_by_id.get(_normalize_name(display))
        return ResolvedDestination(
            raw_query=candidate,
            display_name=display,
            tier="supported",
            destination_id=dest_id,
            similar=similar_destinations(display),
        )

    canonical = extract_destination(message)
    if not canonical:
        # Catch typos before draft extraction ("dubain" → Dubai).
        for token in re.findall(r"[A-Za-z]{4,}", message):
            hit = _PLACE_ALIASES.get(token.lower()) or _fuzzy_canonical(token)
            if hit and _is_supported_name(hit, supported_names):
                canonical = hit
                break
    if canonical:
        dest_id = supported_by_id.get(_normalize_name(canonical))
        return ResolvedDestination(
            raw_query=canonical,
            display_name=canonical,
            tier="supported",
            destination_id=dest_id,
            similar=similar_destinations(canonical),
        )

    # Hero-style standalone place query: "Ljubljana", "Chalakudy"
    stripped = message.strip()
    words = stripped.split()
    if 1 <= len(words) <= 4 and "?" not in stripped:
        standalone = _title_place(stripped)
        if _is_valid_draft_place(standalone):
            if _is_supported_name(standalone, supported_names):
                dest_id = supported_by_id.get(_normalize_name(standalone))
                return ResolvedDestination(
                    raw_query=standalone,
                    display_name=standalone,
                    tier="supported",
                    destination_id=dest_id,
                    similar=similar_destinations(standalone),
                )
            return ResolvedDestination(
                raw_query=standalone,
                display_name=standalone,
                tier="draft_eligible",
                similar=similar_destinations(standalone),
            )

    # Follow-ups with no new place ("3 days", "add snorkeling") keep page region.
    if region and _is_supported_name(region, supported_names):
        dest_id = supported_by_id.get(_normalize_name(region))
        return ResolvedDestination(
            raw_query=region,
            display_name=region,
            tier="supported",
            destination_id=dest_id,
            similar=similar_destinations(region),
        )

    return ResolvedDestination(tier="unknown", similar=_DEFAULT_SIMILAR[:3])


def resolve_destination_with_history(
    message: str,
    history: list[dict] | None = None,
    *,
    region: str | None = None,
    supported_names: set[str] | None = None,
    supported_by_id: dict[str, str] | None = None,
    llm_destination_hint: str | None = None,
) -> ResolvedDestination:
    """Resolve place from the current message, then walk prior user turns.

    `llm_destination_hint` is a last-resort candidate from the LLM slot
    extractor (see llm_slot_extraction.py) for phrasings the regex patterns
    above don't recognize (e.g. "Zanzibar", "the Amalfi Coast"). It's only
    used once regex + history both come up empty, and is classified through
    the same supported/draft tier logic as every other candidate.
    """
    resolved = resolve_destination(
        message,
        region=region,
        supported_names=supported_names,
        supported_by_id=supported_by_id,
    )
    if resolved.display_name:
        return resolved

    for turn in reversed(history or []):
        if turn.get("role") != "user":
            continue
        prior = resolve_destination(
            turn["content"],
            region=region,
            supported_names=supported_names,
            supported_by_id=supported_by_id,
        )
        if prior.display_name:
            return prior

    if llm_destination_hint:
        candidate = _title_place(llm_destination_hint)
        if _is_valid_draft_place(candidate):
            if _is_supported_name(candidate, supported_names):
                dest_id = supported_by_id.get(_normalize_name(candidate))
                return ResolvedDestination(
                    raw_query=candidate,
                    display_name=candidate,
                    tier="supported",
                    destination_id=dest_id,
                    similar=similar_destinations(candidate),
                )
            return ResolvedDestination(
                raw_query=candidate,
                display_name=candidate,
                tier="draft_eligible",
                similar=similar_destinations(candidate),
            )

    return resolved
