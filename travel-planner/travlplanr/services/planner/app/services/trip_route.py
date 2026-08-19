"""Parse origin/destination routes and map cities to airport codes."""

from __future__ import annotations

import re

_ROUTE_RE = re.compile(
    r"\bfrom\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)\s+to\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?:\s+for\b|\s*$|[.!?])",
    re.I,
)
# "trip to Goa from Bangalore" — arrival first, then origin.
_ROUTE_TO_FROM_RE = re.compile(
    r"\bto\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)\s+from\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?:\s+for\b|,|\s+with\b|\s*$|[.!?])",
    re.I,
)
_ROUTE_BARE_RE = re.compile(
    r"^\s*([A-Za-z][A-Za-z\s\-'.]{1,40}?)\s+to\s+([A-Za-z][A-Za-z\s\-'.]{1,40}?)(?:\s+for\b|\s*$|[.!?])",
    re.I,
)
_TRAILING_TIME_PHRASE_RE = re.compile(
    r"\s+(?:from|starting|on)\s+(?:next\s+|this\s+)?"
    r"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|weekend|today|tomorrow)\b.*$",
    re.I,
)
# Phrases like "plan a trip to Paris" are destination requests, not origin→destination routes.
_NON_CITY_ROUTE_PREFIX_RE = re.compile(
    r"\b(plan|make|build|create|draft|start|book|show|open|visit|explore|go)\b",
    re.I,
)

# The bare "CityA to CityB" pattern has no "from" anchor to lean on, so a plain
# infinitive sentence like "I want to relax on a beach" also satisfies its shape
# ("I want" [to] "relax on a beach") and gets misread as a route. Real city
# names essentially never contain a pronoun or common verb, so reject the
# match if either side does.
_NON_ROUTE_WORDS = frozenset(
    {
        "i", "you", "we", "they", "it", "he", "she", "someone", "somewhere",
        "want", "wants", "wanted", "like", "likes", "liked", "love", "loves", "loved",
        "need", "needs", "needed", "have", "has", "had", "get", "gets", "got",
        "hope", "hopes", "hoping", "wish", "wishes", "wishing",
        "try", "tries", "trying", "used", "able",
        "am", "is", "are", "was", "were", "be", "being", "been",
        "relax", "relaxing", "chill", "chilling", "unwind", "unwinding",
        "travel", "traveling", "travelling", "goes", "going", "come", "coming",
    }
)


def _looks_like_bare_route(departure_raw: str, arrival_raw: str) -> bool:
    dep_tokens = departure_raw.lower().split()
    arr_tokens = arrival_raw.lower().split()
    if any(tok in _NON_ROUTE_WORDS for tok in dep_tokens):
        return False
    if any(tok in _NON_ROUTE_WORDS for tok in arr_tokens):
        return False
    return True

# Towns that should use a nearby commercial airport in flight segments.
NEAREST_AIRPORT_CITY: dict[str, str] = {
    "chalakudy": "Kochi",
    "chalakudi": "Kochi",
    "alleppey": "Kochi",
    "alappuzha": "Kochi",
    "munnar": "Kochi",
    "thekkady": "Kochi",
    "kumarakom": "Kochi",
    "varkala": "Thiruvananthapuram",
    "kovalam": "Thiruvananthapuram",
    "agra": "Delhi",
    "gurgaon": "Delhi",
    "gurugram": "Delhi",
    "noida": "Delhi",
    "faridabad": "Delhi",
}


def title_place(name: str) -> str:
    cleaned = re.sub(_TRAILING_TIME_PHRASE_RE, "", name.strip(" .!?,"))
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.title() if cleaned else cleaned


def extract_trip_route(message: str) -> tuple[str, str] | None:
    """Return (departure_city, arrival_city) from phrases like 'from Delhi to Chalakudy'."""
    stripped = message.strip()
    match = _ROUTE_RE.search(stripped)
    if match:
        departure = title_place(match.group(1))
        arrival = title_place(match.group(2))
        if departure and arrival and not (
            _NON_CITY_ROUTE_PREFIX_RE.search(departure) or re.search(r"\btrip\b", departure, re.I)
        ):
            return departure, arrival

    to_from = _ROUTE_TO_FROM_RE.search(stripped)
    if to_from:
        arrival = title_place(to_from.group(1))
        departure = title_place(to_from.group(2))
        if (
            departure
            and arrival
            and _looks_like_bare_route(departure, arrival)
            and not (_NON_CITY_ROUTE_PREFIX_RE.search(departure) or re.search(r"\btrip\b", departure, re.I))
            and not (_NON_CITY_ROUTE_PREFIX_RE.search(arrival) or re.search(r"\btrip\b", arrival, re.I))
        ):
            return departure, arrival

    bare = _ROUTE_BARE_RE.search(stripped)
    if not bare:
        return None
    departure_raw = bare.group(1).strip()
    arrival_raw = bare.group(2).strip()
    # Reject "plan a trip to Bangalore" — only accept bare "CityA to CityB" routes.
    if _NON_CITY_ROUTE_PREFIX_RE.search(departure_raw) or re.search(r"\btrip\b", departure_raw, re.I):
        return None
    if not _looks_like_bare_route(departure_raw, arrival_raw):
        return None
    departure = title_place(departure_raw)
    arrival = title_place(arrival_raw)
    if not departure or not arrival:
        return None
    if _NON_CITY_ROUTE_PREFIX_RE.search(departure) or re.search(r"\btrip\b", departure, re.I):
        return None
    return departure, arrival


# Origin-only statements ("I'm starting from Bangalore") — not a destination change.
_DEPARTURE_ONLY_RE = re.compile(
    r"\b(?:i(?:'m|\s+am)?\s+)?"
    r"(?:starting|departing|leaving|flying|travel(?:l?ing)?|coming)\s+from\s+"
    r"([A-Za-z][A-Za-z\s\-'.]{1,40})"
    r"|\b(?:start|depart|leave|fly|travel)\s+from\s+"
    r"([A-Za-z][A-Za-z\s\-'.]{1,40})"
    r"|\b(?:my\s+)?(?:origin|departure(?:\s+city)?)\s+(?:is|as|:)\s+"
    r"([A-Za-z][A-Za-z\s\-'.]{1,40})",
    re.I,
)
_DEPARTURE_TRAILER_RE = re.compile(
    r"\s+(?:for|on|with|and|to|in|at|by|via|instead|please|thanks?)\b.*$",
    re.I,
)


def extract_departure_city(message: str) -> str | None:
    """Return origin city from phrases like 'starting from Delhi'.

    Full routes ('from Delhi to Dubai') return None — use extract_trip_route.
    """
    if extract_trip_route(message):
        return None
    match = _DEPARTURE_ONLY_RE.search(message.strip())
    if not match:
        return None
    raw = next((g for g in match.groups() if g), None)
    if not raw:
        return None
    cleaned = _DEPARTURE_TRAILER_RE.sub("", raw.strip(" .!?,"))
    place = title_place(cleaned)
    if not place or _NON_CITY_ROUTE_PREFIX_RE.search(place):
        return None
    if re.search(r"\b(trip|itinerar|package|day|days|plan)\b", place, re.I):
        return None
    return place


def nearest_airport_city(city: str) -> str:
    key = city.lower().strip()
    return NEAREST_AIRPORT_CITY.get(key, city)


def extract_flight_correction(message: str) -> tuple[str, str] | None:
    """Detect requests to fix/correct flight routing or natural travel-from statements."""
    text = message.lower()
    explicit_fix = bool(
        re.search(r"\b(fix|correct|change|update|wrong)\b", text)
        and re.search(r"\b(flight|flights|airport|transport|flying)\b", text)
    )
    travel_statement = bool(
        re.search(
            r"\b(?:i\s+will\s+be\s+)?(?:travell?ing|flying|departing|leaving|coming)\s+from\b",
            text,
        )
    )
    if not explicit_fix and not travel_statement:
        return None
    route = extract_trip_route(message)
    if route:
        return route
    loose = re.search(
        r"\b(?:should be|must be|need(?:s)? to be|make(?:\s+them)?|route)\s+"
        r"([A-Za-z][A-Za-z\s\-'.]{1,30}?)\s+to\s+([A-Za-z][A-Za-z\s\-'.]{1,30})",
        message.strip(),
        re.I,
    )
    if loose:
        return title_place(loose.group(1)), title_place(loose.group(2))
    loose2 = re.search(
        r"\bfrom\s+([A-Za-z][A-Za-z\s\-'.]{1,30}?)\s+to\s+([A-Za-z][A-Za-z\s\-'.]{1,30})",
        message.strip(),
        re.I,
    )
    if loose2:
        return title_place(loose2.group(1)), title_place(loose2.group(2))
    return None


def flight_correction_hint(departure: str, arrival: str) -> str:
    dep_air = nearest_airport_city(departure)
    arr_air = nearest_airport_city(arrival)
    return (
        f"All outbound and return flights must route {departure} ({dep_air}) to {arrival} ({arr_air}) "
        f"using correct IATA airport codes. Ground transfers may continue to the final town."
    )
