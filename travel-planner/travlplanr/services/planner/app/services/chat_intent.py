"""Infer UI actions from chat messages so the site can update behind the assistant."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from app.services.trip_route import (
    extract_departure_city,
    extract_flight_correction,
    extract_trip_route,
    flight_correction_hint,
)

if TYPE_CHECKING:
    from app.services.destination_resolver import ResolvedDestination

# (regex, canonical display name)
DESTINATION_PATTERNS: list[tuple[str, str]] = [
    (r"\bdubai\b", "Dubai"),
    (r"\babu\s*dhabi\b", "Abu Dhabi"),
    (r"\bbali\b", "Bali"),
    (r"\bparis\b", "Paris"),
    (r"\bbarcelona\b", "Barcelona"),
    (r"\bmadrid\b", "Madrid"),
    (r"\blondon\b", "London"),
    (r"\brome\b", "Italy"),
    (r"\bitaly\b", "Italy"),
    (r"\bfrance\b", "France"),
    (r"\bsingapore\b", "Singapore"),
    (r"\bthailand\b", "Thailand"),
    (r"\bbangkok\b", "Thailand"),
    (r"\bjapan\b", "Japan"),
    (r"\btokyo\b", "Japan"),
    (r"\baustralia\b", "Australia"),
    (r"\bsydney\b", "Australia"),
    (r"\bmelbourne\b", "Australia"),
    (r"\bmalaysia\b", "Malaysia"),
    (r"\bmaldives\b", "Maldives"),
    (r"\bswitzerland\b", "Switzerland"),
    (r"\bgreece\b", "Greece"),
    (r"\bspain\b", "Spain"),
    (r"\bbelgium\b", "Belgium"),
    (r"\baustria\b", "Austria"),
    (r"\bnorway\b", "Norway"),
    (r"\bfinland\b", "Finland"),
    (r"\bchina\b", "China"),
    (r"\bindia\b", "India"),
    (r"\bbangalore\b", "Bangalore"),
    (r"\bbengaluru\b", "Bangalore"),
    (r"\bbanagalore\b", "Bangalore"),
    (r"\bgoa\b", "Goa"),
    (r"\bmumbai\b", "Mumbai"),
    (r"\bbombay\b", "Mumbai"),
    (r"\bdelhi\b", "Delhi"),
    (r"\bnew\s*delhi\b", "Delhi"),
    (r"\bkochi\b", "Kochi"),
    (r"\bcochin\b", "Kochi"),
    (r"\bqatar\b", "Qatar"),
    (r"\bdoha\b", "Qatar"),
    (r"\bbahrain\b", "Bahrain"),
    (r"\bsaudi\b", "Saudi Arabia"),
    (r"\bkuwait\b", "Kuwait"),
    (r"\bmuscat\b", "Muscat"),
    (r"\bmorocco\b", "Morocco"),
    (r"\begypt\b", "Egypt"),
    (r"\bnew\s*york\b", "New York"),
    (r"\borlando\b", "Orlando"),
    (r"\blos\s*angeles\b", "Los Angeles"),
    (r"\bkenya\b", "Kenya"),
    (r"\bfiji\b", "Fiji"),
    (r"\bseychelles\b", "Seychelles"),
    (r"\bphilippines\b", "Philippines"),
    (r"\bsri\s*lanka\b", "Sri Lanka"),
    (r"\beurope\b", "Europe"),
    (r"\buae\b", "Dubai"),
    (r"\bemirates\b", "Dubai"),
]

_TRANSPORT_WORDS = frozenset({"train", "bus", "flight", "car", "transfer", "transportation", "transport"})


def extract_destination(message: str) -> str | None:
    text = message.lower()
    for pattern, name in DESTINATION_PATTERNS:
        if re.search(pattern, text):
            return name
    return None


def _strip_place_trailer(name: str) -> str:
    """Drop conversational trailers glued onto a place name ('Chalakudy for 5 days')."""
    cleaned = (name or "").strip(" .!?,")
    cleaned = re.sub(
        r"\s+(?:for|with|and|in|on|from|starting|please|thanks?)\b.*$",
        "",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(
        r"\s+\d+\s*(?:day|days|night|nights|week|weeks|month|months)\b.*$",
        "",
        cleaned,
        flags=re.I,
    )
    return re.sub(r"\s+", " ", cleaned).strip(" .!?,")


def _guess_unrecognized_place(message: str) -> str | None:
    """Best-effort extraction of the place-like phrase the user typed when it
    doesn't match our curated destination list, so a fallback reply can name
    it instead of a vague placeholder or a silently wrong default."""
    stripped = message.strip()
    duration_tail = re.compile(r"\b(week|weeks|day|days|month|months|night|nights)\b", re.I)
    for pattern in (
        r"\bin\s+([A-Za-z][A-Za-z\s\-'.]{1,40})\s*$",
        r"\bto\s+([A-Za-z][A-Za-z\s\-'.]{1,40})\s*$",
    ):
        m = re.search(pattern, stripped, re.I)
        if not m:
            continue
        candidate = m.group(1).strip(" .!?")
        if duration_tail.search(candidate):
            continue
        return candidate
    return None


def extract_duration_days(message: str) -> int | None:
    text = message.lower()
    for pattern in (
        r"\b(\d+)\s*(?:day|days)\b",
        r"\bnext\s+(\d+)\s+days?\b",
        r"\bfor\s+(\d+)\s+days?\b",
        r"\b(\d+)\s*day\s+trip\b",
    ):
        match = re.search(pattern, text)
        if match:
            return max(1, min(int(match.group(1)), 30))
    return None


def extract_budget_tier(message: str) -> str | None:
    text = message.lower()
    if re.search(r"\b(budget|cheap|backpack|economy|affordable|low\s+cost)\b", text):
        return "budget"
    if re.search(r"\b(premium|luxury|deluxe|high[\s-]?end|splurge)\b", text):
        return "premium"
    if re.search(r"\b(standard|mid[\s-]?range|moderate|mid\s+budget)\b", text):
        return "standard"
    return None


def extract_travel_style(message: str) -> str | None:
    text = message.lower()
    if re.search(r"\b(solo|alone|by\s+myself|just\s+me)\b", text):
        return "solo"
    if re.search(r"\b(couple|honeymoon|partner|wife|husband|boyfriend|girlfriend)\b", text):
        return "couple"
    if re.search(r"\b(family|kids|children|child)\b", text):
        return "family"
    if re.search(r"\b(friends|group|buddies|mates)\b", text):
        return "friends"
    return None


_INTEREST_KEYWORDS: list[tuple[str, str]] = [
    (r"\bfood\b|\bcuisine\b|\beating\b|\brestaurant", "food"),
    (r"\bculture\b|\bmuseum\b|\bheritage\b|\bhistory\b", "culture"),
    (r"\badventure\b|\bhiking\b|\btrek\b|\boutdoor", "adventure"),
    (r"\bbeach\b|\bcoast\b|\bsea\b", "beach"),
    (r"\bnightlife\b|\bparty\b|\bclubs?\b", "nightlife"),
    (r"\bshopping\b|\bmarkets?\b", "shopping"),
    (r"\bnature\b|\bwildlife\b|\bparks?\b", "nature"),
    (r"\brelax\b|\brelaxed\b|\bchill\b|\bleisure", "relaxation"),
    (r"\bsightseeing\b|\blandmarks?\b|\biconic\b", "sightseeing"),
    (r"\bspiritual\b|\btemple\b|\breligious\b", "spiritual"),
]


def extract_interests(message: str) -> list[str]:
    text = message.lower()
    found: list[str] = []
    for pattern, label in _INTEREST_KEYWORDS:
        if re.search(pattern, text) and label not in found:
            found.append(label)
    return found


def extract_budget_amount(message: str) -> int | None:
    """Parse budget amounts like $2000, ₹50000, 2000 dollars, budget of 1.5L."""
    text = message.lower().replace(",", "")
    if not re.search(r"\b(budget|afford|spend|under|₹|\$|usd|dollar|inr|rs)\b", text):
        if not re.search(r"\bplan\s+a\s+(?:₹|\$|usd|\d)", text):
            return None
    # Ignore day counts — "plan a 5 day trip" is not a budget
    if re.search(r"\bplan\s+a\s+\d+\s*(?:day|days)\b", text):
        return None
    match = re.search(
        r"(?:₹|rs\.?|inr|usd|\$|€|£)\s*(\d+(?:\.\d+)?)|"
        r"\b(?:budget|afford|spend|under)\s+(?:of\s+)?(?:₹|rs\.?|inr|usd|\$)?\s*(\d+(?:\.\d+)?)",
        text,
    )
    if not match:
        match = re.search(
            r"\bplan\s+a\s+(?:₹|\$|usd)\s*(\d+(?:\.\d+)?)",
            text,
        )
    if not match:
        return None
    raw = match.group(1) or match.group(2)
    if not raw:
        return None
    amount = float(raw)
    if re.search(r"\b(\d+(?:\.\d+)?)\s*(?:l|lac|lakh)\b", text):
        amount *= 100_000
    elif re.search(r"\b(\d+(?:\.\d+)?)\s*k\b", text) or "thousand" in text:
        amount *= 1_000
    elif re.search(r"\$|usd|dollar", text):
        amount *= 83  # rough USD → INR for package filtering
    return int(amount)


def extract_travelers(message: str) -> int | None:
    text = message.lower()
    patterns = [
        r"\b(?:we\s+are|group\s+of|party\s+of|for)\s+(\d+)\s+(?:people|persons|travelers|travellers|guests|adults)\b",
        r"\b(\d+)\s+(?:people|persons|travelers|travellers|guests|adults)\b",
        r"\b(\d+)\s+(?:of\s+us|friends|couples)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return max(1, min(int(match.group(1)), 20))
    return None


def extract_multi_city_route(message: str) -> list[str] | None:
    """Parse multi-city routes like Paris → Rome → Barcelona or Paris to Rome to Barcelona."""
    text = message.strip()
    arrow_split = re.split(r"\s*(?:→|->|—|–)\s*", text)
    if len(arrow_split) >= 2:
        cities = [_canonical_city(c.strip()) for c in arrow_split if c.strip()]
        cities = [c for c in cities if c]
        if len(cities) >= 2:
            return cities

    to_chain = re.search(
        r"\b([A-Za-z][A-Za-z\s]+?)\s+to\s+([A-Za-z][A-Za-z\s]+?)\s+to\s+([A-Za-z][A-Za-z\s]+?)(?:\s+in\b|\s*$)",
        text,
        re.I,
    )
    if to_chain:
        return [_canonical_city(to_chain.group(i)) for i in range(1, 4)]

    comma_cities = re.findall(
        r"\b(paris|rome|barcelona|madrid|london|dubai|bali|tokyo|singapore|amsterdam|prague|vienna|berlin|milan|florence|venice|lisbon|athens|budapest|zurich|geneva|munich|brussels)\b",
        text.lower(),
    )
    if len(comma_cities) >= 2 and re.search(r"\b(multi|city|cities|then)\b", text.lower()):
        return [_canonical_city(c) for c in comma_cities]
    return None


def _canonical_city(raw: str) -> str | None:
    cleaned = raw.strip().rstrip(".,!?")
    if not cleaned:
        return None
    for pattern, name in DESTINATION_PATTERNS:
        if re.search(pattern, cleaned.lower()):
            return name
    if len(cleaned) >= 3:
        return cleaned.title()
    return None


def extract_regenerate_day(message: str) -> tuple[int | None, str | None]:
    """Parse 'make day 3 more relaxing' → (3, 'relaxing')."""
    text = message.lower()
    if not re.search(r"\b(regenerat|rewrit|redo|make|more)\b", text):
        return None, None
    day_match = re.search(r"\bday\s*(\d+)\b", text)
    if not day_match:
        return None, None
    day = int(day_match.group(1))
    style_match = re.search(
        r"\bmore\s+(\w+)|(\w+)\s+day\s*\d+|(\w+)\s+activities\b", text
    )
    style = None
    if style_match:
        style = next((g for g in style_match.groups() if g), None)
    return day, style


def extract_trip_note(message: str) -> tuple[str | None, int | None]:
    """Parse 'remind me I want a sunset dinner on day 4'."""
    text = message.lower().strip()
    if not re.search(r"\b(remind|remember|note|annotate|save\s+(?:a\s+)?note)\b", text):
        return None, None
    note_match = re.search(
        r"(?:remind\s+me(?:\s+that)?|remember(?:\s+that)?|note(?:\s+that)?|save\s+(?:a\s+)?note(?:\s+that)?)\s+(.+)",
        text,
        re.I,
    )
    if not note_match:
        return None, None
    note = note_match.group(1).strip(" .")
    day = extract_day_number(message)
    return note, day


def extract_package_booking_target(message: str) -> str | None:
    text = message.lower()
    if not re.search(r"\b(book|checkout|reserve|purchase)\b", text):
        return None
    pkg_match = re.search(
        r"\b(?:book|checkout|reserve|purchase)\s+(?:the\s+)?(.+?)(?:\s+package|\s*$)",
        text,
    )
    if pkg_match:
        return pkg_match.group(1).strip(" .")
    return extract_destination(message)


_TENS_WORDS = {"twenty": 20, "thirty": 30}
_UNIT_CARDINALS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9,
}
_UNIT_ORDINALS = {
    "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
    "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9,
}
_CARDINAL_WORDS = {
    **_UNIT_CARDINALS,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20, "thirty": 30,
}
_ORDINAL_WORDS = {
    **_UNIT_ORDINALS,
    "tenth": 10, "eleventh": 11, "twelfth": 12, "thirteenth": 13, "fourteenth": 14,
    "fifteenth": 15, "sixteenth": 16, "seventeenth": 17, "eighteenth": 18,
    "nineteenth": 19, "twentieth": 20, "thirtieth": 30,
}
_DAY_NUMBER_WORDS = {**_CARDINAL_WORDS, **_ORDINAL_WORDS}

_DAY_WORD_ALT = "|".join(sorted(_DAY_NUMBER_WORDS, key=len, reverse=True))
# Trailing "... on/to/for [the] day <n>" / "... on the <ordinal> day" phrase,
# where <n> can be a digit, an ordinal digit (2nd), or a spelled-out number.
_TITLE_DAY_SUFFIX_RE = re.compile(
    rf"\s+(?:on|to|for|from|in)\s+(?:the\s+)?day\s*(?:\d+(?:st|nd|rd|th)?|(?:{_DAY_WORD_ALT})(?:[\s-](?:{_DAY_WORD_ALT}))?)$"
    rf"|\s+(?:on|to|for|from|in)\s+(?:the\s+)?(?:(?:{_DAY_WORD_ALT})(?:[\s-](?:{_DAY_WORD_ALT}))?|\d+(?:st|nd|rd|th))\s+day$"
    rf"|\s+(?:on|to|for|from|in)\s+day\s*\d+(?:st|nd|rd|th)?$"
    # Bare trailing "day N" with no connector ("activities day 3") — a numbered
    # day is never part of a real activity title, so strip it regardless.
    rf"|\s+(?:the\s+)?day\s*\d+(?:st|nd|rd|th)?$"
    rf"|\s+on\s+\d+(?:st|nd|rd|th)?$",
    re.I,
)


def _strip_day_suffix(title: str) -> str:
    return _TITLE_DAY_SUFFIX_RE.sub("", title).strip()


def _word_to_day_number(phrase: str | None) -> int | None:
    """Convert a spelled-out day number to an int, e.g. 'two' → 2,
    'twenty-one' → 21, 'second' → 2. Accepts both cardinals and ordinals so
    voice transcriptions like 'add a car to day two' resolve correctly."""
    if not phrase:
        return None
    tokens = phrase.strip().lower().replace("-", " ").split()
    if not tokens:
        return None
    if len(tokens) >= 2 and tokens[0] in _TENS_WORDS:
        unit = _UNIT_CARDINALS.get(tokens[1]) or _UNIT_ORDINALS.get(tokens[1])
        if unit:
            return _TENS_WORDS[tokens[0]] + unit
    return _DAY_NUMBER_WORDS.get(tokens[0])


def _ordinal_word_to_day_number(phrase: str | None) -> int | None:
    """Like _word_to_day_number but only for ordinals, used for the
    'the second day' phrasing. Restricting to ordinals avoids misreading a
    duration like 'a two day trip' as day 2."""
    if not phrase:
        return None
    tokens = phrase.strip().lower().replace("-", " ").split()
    if not tokens:
        return None
    if len(tokens) >= 2 and tokens[0] in _TENS_WORDS and tokens[1] in _UNIT_ORDINALS:
        return _TENS_WORDS[tokens[0]] + _UNIT_ORDINALS[tokens[1]]
    return _ORDINAL_WORDS.get(tokens[-1])


def extract_day_number(message: str) -> int | None:
    text = message.lower()
    # Allow a trailing ordinal ("day 3rd") so it isn't silently missed and
    # defaulted to day 1 — the ordinal suffix carries no extra information here.
    match = re.search(r"\bday\s*(\d+)(?:st|nd|rd|th)?\b", text)
    if match:
        return int(match.group(1))
    match = re.search(r"\b(\d+)(?:st|nd|rd|th)\s+day\b", text)
    if match:
        return int(match.group(1))
    match = re.search(r"\bday\s+([a-z]+(?:[\s-][a-z]+)?)\b", text)
    if match:
        word_day = _word_to_day_number(match.group(1))
        if word_day:
            return word_day
    match = re.search(r"\b([a-z]+(?:[\s-][a-z]+)?)\s+day\b", text)
    if match:
        word_day = _ordinal_word_to_day_number(match.group(1))
        if word_day:
            return word_day
    match = re.search(r"\bon\s+(\d+)(?:st|nd|rd|th)?\b", text)
    if match:
        return int(match.group(1))
    return None


_SPECIFIC_ASK_WORDS = re.compile(
    r"\b(recommend|suggest|what|which|any\s+good|know\s+of|specific|particular|"
    r"something\s+(?:fun|unique|special|unusual|different)|hidden\s+gem|"
    r"off\s+the\s+beaten|things?\s+to\s+do|activit\w*|experience|excursion|"
    r"near|close\s+to|around|tell\s+me\s+about)\b"
)


def _is_specific_request(text: str) -> bool:
    """True when the message reads like a targeted question (e.g. "suggest a
    quiet activity in Florence") rather than a bare destination opener like
    "Italy" or "I want to go to Rome" — the latter should still browse packages."""
    return bool(_SPECIFIC_ASK_WORDS.search(text))


_PLATFORM_QUESTION_RE = re.compile(
    r"\b(pricing|subscription|free\s+plan|paid\s+plan|upgrade\s+(?:my\s+)?plan|"
    r"how\s+much\s+(?:does|is)\s+(?:travl\s*planr|this\s+app|the\s+app|it)\s+cost|"
    r"how\s+does\s+(?:travl\s*planr|this\s+app|the\s+app|this\s+site|this)\s+work|how\s+it\s+works|"
    r"refund|cancel\s+my\s+(?:subscription|account|plan)|contact\s+support|customer\s+support|"
    r"is\s+(?:travl\s*planr|this)\s+free|do\s+i\s+need\s+an?\s+account|"
    r"privacy\s+polic|terms\s+of\s+service|"
    r"faq|frequently\s+asked)\b",
    re.I,
)


def infer_intent(message: str) -> str:
    text = message.lower()

    if parse_itinerary_edits(message):
        return "modify_itinerary"

    if extract_trip_note(message)[0]:
        return "save_note"

    if _PLATFORM_QUESTION_RE.search(text) and not extract_destination(message):
        return "platform_question"

    if re.search(r"\b(book|checkout|reserve|purchase)\b", text):
        if re.search(r"\b(package|standard|premium|deluxe)\b", text) or extract_destination(text):
            return "book_package"
        if re.search(r"\b(trip|itinerar\w*|plan)\b", text):
            return "book_trip"

    if re.search(r"\b(show\s+me|images?|photos?|pictures?)\b", text) and re.search(
        r"\b(beach|beaches|food|temple|mountain|sunset|view|scenery|gallery)\b", text
    ):
        return "show_images"

    if re.search(r"\b(cheapest|lowest\s+price|compare\s+prices?|price\s+comparison|best\s+deal|best\s+value)\b", text):
        return "compare_prices"

    budget = extract_budget_amount(message)
    if budget and re.search(r"\b(budget|afford|spend|under|plan\s+a|week|trip|package)\b", text):
        return "budget_filter"

    regen_day, _ = extract_regenerate_day(message)
    if regen_day and re.search(r"\b(regenerat|rewrit|redo|make|more\s+\w+|relaxing|adventur)\b", text):
        return "regenerate_day"

    if extract_multi_city_route(message) and re.search(r"\b(trip|itinerar\w*|vacation|holiday|plan|days?)\b", text):
        return "multi_city_trip"

    if extract_travelers(message) and re.search(r"\b(trip|plan|travel|vacation|holiday|group)\b", text):
        return "group_trip"

    if re.search(r"\b(weather|temperature|rain|forecast|climate|season|best\s+time(?:\s+to\s+visit)?|when\s+to\s+visit)\b", text):
        return "weather_query"

    if re.search(r"\b(tell\s+me\s+about|what\s+to\s+(?:see|do)|attractions?\s+in|overview\s+of)\b", text) and extract_destination(message):
        return "destination_info"

    if re.search(
        r"\b(fix|improve|update|change|redo|rebuild|refresh|correct|adjust|tweak)\b.*\b(itinerar\w*|plan|trip|schedule|days)\b",
        text,
    ) or re.search(
        r"\b(itinerar\w*|plan|trip)\b.*\b(fix|improve|update|change|redo|rebuild|refresh|correct|adjust|tweak)\b",
        text,
    ):
        return "fix_itinerary"

    # Origin / routing corrections — never treat the city as a new destination browse.
    if extract_departure_city(message) or extract_flight_correction(message):
        return "fix_itinerary"

    if re.search(r"\bfilter\b", text) and re.search(r"\b(package|day|days|night|tour)\b", text):
        return "filter_packages"
    if extract_duration_days(text) and re.search(r"\b(package|packages)\b", text):
        return "filter_packages"

    if re.search(
        r"\b(show|view|open|see|display|bring up)\b.*\b(itinerar\w*|trip plan|trip)\b",
        text,
    ) or re.search(r"\b(itinerar\w*)\b.*\b(show|view|open|see|display)\b", text):
        return "show_itinerary"
    # Follow-up chips like "Turn this into a full itinerary" — build the real
    # itinerary page from slots gathered across the conversation.
    if re.search(
        r"\b(turn|convert)\b.*\binto\b.*\b(full\s+)?(itinerar\w*|trip\s+plan)\b",
        text,
    ):
        return "show_itinerary"

    if re.search(r"\b(make|create|build|plan|generate|start|draft)\b", text) and re.search(
        r"\b(trip|itinerar\w*|vacation|holiday)\b", text
    ):
        return "create_trip"
    if extract_duration_days(text) and re.search(r"\b(trip|itinerar\w*|vacation|holiday)\b", text):
        return "create_trip"
    if extract_duration_days(text) and re.search(r"\b(?:in|to)\s+[a-z]", text):
        return "create_trip"

    if re.search(r"\b(package|packages|deal|deals|tour|tours|holiday)\b", text):
        return "browse_packages"
    if re.search(r"\b(plan|planning|wizard|custom|build|create)\b.*\b(trip|itinerar|vacation|holiday)\b", text):
        return "start_planning"
    if extract_destination(text) and not _is_specific_request(text):
        return "browse_packages"
    return "general"


_TRANSPORT_WORDS = frozenset({"train", "bus", "flight", "car", "transfer", "transportation", "transport", "rental"})


def _clean_title_match(raw: str) -> str:
    return re.sub(r"^the\s+", "", raw.strip(" ."), flags=re.I).strip()


def _parse_day_transport_subject(subject: str) -> tuple[int, str] | None:
    m = re.match(r"^day\s*(\d+)\s+(car|rental\s*car|train|bus|flight)$", subject.lower().strip())
    if not m:
        return None
    from_type = m.group(2).replace("rental car", "car").strip()
    return int(m.group(1)), from_type


def _normalize_from_title_match(raw: str | None) -> str | None:
    if not raw:
        return None
    if _parse_day_transport_subject(raw):
        return None
    cleaned = _clean_title_match(raw).lower()
    if cleaned in _TRANSPORT_WORDS or cleaned == "rental car":
        return None
    return _clean_title_match(raw)


def _parse_swap_transport(text: str, day: int | None) -> dict[str, Any] | None:
    day_explicit = re.search(
        r"\b(?:change|replace|swap|switch)\s+(?:on\s+)?day\s*(\d+)\s+"
        r"(car|rental\s*car|train|bus|flight)\s+(?:to|with)\s+(?:a\s+)?(?:any\s+)?(train|bus|flight|car)\b",
        text,
    )
    if day_explicit:
        from_type = day_explicit.group(2).replace("rental car", "car").strip()
        to_type = day_explicit.group(3)
        if to_type in {"transfer", "transportation"}:
            to_type = "car"
        return {
            "edit": "swap_transport",
            "fromType": from_type,
            "toType": to_type,
            "day": int(day_explicit.group(1)),
        }

    patterns: list[tuple[str, bool]] = [
        (r"(?:the\s+)?(.+?)\s+car\s+change\s+it\s+to\s+(?:any\s+)?(train|bus|flight|car)\b", True),
        (r"\b(?:change|replace|swap|switch)\s+(?:the\s+)?(.+?)\s+to\s+(?:a\s+)?(?:any\s+)?(train|bus|flight|car)\b", False),
        (
            r"\b(?:change|replace|swap)\s+(?:the\s+)?(car|rental\s*car|train|bus|flight)\s+"
            r"(?:to|with)\s+(?:a\s+)?(?:any\s+)?(train|bus|flight|car)\b",
            False,
        ),
    ]
    for pattern, car_title_first in patterns:
        m = re.search(pattern, text)
        if not m:
            continue
        subject = m.group(1).lower().strip()
        to_type = m.group(2)
        if to_type in {"transfer", "transportation"}:
            to_type = "car"
        from_type = "car"
        title_match: str | None = None
        day_transport = _parse_day_transport_subject(subject)
        if day_transport:
            swap_day, from_type = day_transport
            return {
                "edit": "swap_transport",
                "fromType": from_type,
                "toType": to_type,
                "day": swap_day,
            }
        if car_title_first or subject not in _TRANSPORT_WORDS:
            title_match = _normalize_from_title_match(m.group(1))
        elif subject.replace("rental ", "") in {"car", "train", "bus", "flight"}:
            from_type = subject.replace("rental ", "").strip()
        return {
            "edit": "swap_transport",
            "fromType": from_type,
            "toType": to_type,
            "fromTitleMatch": title_match,
            "day": day or 1,
        }
    return None


def extract_activity_add_count(message: str) -> int | None:
    text = message.lower()
    match = re.search(
        r"\badd\s+(\d+)\s+(?:more\s+)?(?:activities|activity|things(?:\s+to\s+do)?|experiences|sights|places|spots|excursions|tours)\b",
        text,
    )
    if match:
        return min(int(match.group(1)), 8)
    match = re.search(
        r"\badd\s+(one|two|three|four|five|six|seven|eight)\s+(?:more\s+)?(?:activities|activity|things(?:\s+to\s+do)?|experiences|sights|places|spots)\b",
        text,
    )
    if match:
        words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8}
        return words.get(match.group(1))
    match = re.search(r"\badd\s+(\d+)\s+more\b", text)
    if match and re.search(r"\b(activit|things|experiences|sights|places|spots|to\s+do)\b", text):
        return min(int(match.group(1)), 8)
    return None


# Generic "activity" nouns — a request naming only one of these (after
# quantifiers are stripped) wants real curated suggestions, not a card titled
# with the word itself.
_ACTIVITY_NOUN_RE = (
    r"activities|activity|things(?:\s+to\s+do)?|things|stuff|experiences|"
    r"sights|places|spots|excursions|tours|options|attractions"
)

# Leading quantifiers/fillers that don't make an activity request specific.
# "add some activities", "add a few things to do", "add a couple of tours" are
# all still generic bulk requests once these are removed.
_QUANTIFIER_FILLER_RE = re.compile(
    r"^(?:some|a\s+few|few|a\s+couple\s+of|a\s+couple|couple\s+of|several|"
    r"a\s+bunch\s+of|bunch\s+of|multiple|more|additional|extra|new|other|any)\s+",
    re.I,
)


def _is_generic_activity_title(title: str) -> bool:
    t = re.sub(r"[^a-z0-9\s]", " ", title.lower())
    t = re.sub(r"\s+", " ", t).strip()
    t = _QUANTIFIER_FILLER_RE.sub("", t).strip()
    return bool(
        re.match(r"^\d+\s+more\s+activit", t)
        or re.match(r"^\d+\s+activit", t)
        or re.match(r"^more\s+activit", t)
        or re.fullmatch(rf"(?:{_ACTIVITY_NOUN_RE})", t)
    )


def _infer_generic_activity_count(message: str) -> int:
    """How many activities a generic "add activities" ask should add. An
    explicit number wins; "a couple" → 2; a singular noun ("add an activity")
    → 1; a plural ask ("add activities") defaults to 3 rather than a lonely 1,
    since "activities" is plural and one card rarely satisfies the request."""
    explicit = extract_activity_add_count(message)
    if explicit:
        return explicit
    text = message.lower()
    if re.search(r"\b(a\s+couple|couple\s+of|both|two)\b", text):
        return 2
    singular_noun = r"activity|thing(?:\s+to\s+do)?|spot|place|experience|sight|excursion|tour|attraction|option"
    if re.search(rf"\badd\s+(?:an?\s+)(?:{singular_noun})\b", text):
        return 1
    if re.search(r"\bactivity\b", text) and not re.search(r"\bactivities\b", text):
        return 1
    return 3


def parse_itinerary_edits(message: str) -> list[dict[str, Any]]:
    """Structured add/remove/swap instructions for the open itinerary page."""
    text = message.lower().strip()
    edits: list[dict[str, Any]] = []
    day = extract_day_number(message)

    swap = _parse_swap_transport(text, day)
    if swap:
        return [swap]

    bulk_count = extract_activity_add_count(message)
    if bulk_count and bulk_count > 0 and re.search(
        r"\b(activities|activity|things(?:\s+to\s+do)?|experiences|sights|places|spots|excursions|tours)\b",
        text,
    ):
        return [{"edit": "add_activity", "day": day or 1, "count": bulk_count, "autoSuggest": True}]

    transport_match = re.search(r"\badd\s+(?:a\s+)?(train|bus|flight|car|transfer|transportation)\b", text)
    if transport_match:
        transport_type = transport_match.group(1)
        if transport_type in {"transfer", "transportation"}:
            transport_type = "car"
        edits.append({"edit": "add_transport", "transportType": transport_type, "day": day or 1})
        return edits

    if re.search(r"\b(add|insert|include|put)\b", text):
        add_match = re.search(
            r"\badd\s+(?:an?\s+)?(.+?)(?:\s+(?:on|to|for|in)\s+day\s*\d+(?:st|nd|rd|th)?|\s+on\s+\d+(?:st|nd|rd|th)?\b|$)",
            text,
        )
        if add_match:
            title = add_match.group(1).strip(" .")
            title = _strip_day_suffix(title)
            title = re.sub(r"^(?:can you|could you|please)\s+", "", title, flags=re.I).strip()
            if title and title not in _TRANSPORT_WORDS:
                # Route to real curated suggestions when the ask is generic
                # ("add some activities") OR when a stray "day N" survived the
                # suffix strip — never echo the command back as a card title.
                if _is_generic_activity_title(title) or re.search(r"\bday\s*\d+", title):
                    count = _infer_generic_activity_count(message)
                    return [{"edit": "add_activity", "day": day or 1, "count": count, "autoSuggest": True}]
                edits.append(
                    {
                        "edit": "add_activity",
                        "title": title.title(),
                        "day": day or 1,
                    }
                )
                return edits

    if re.search(r"\b(remove|delete|drop|cancel)\b", text):
        remove_match = re.search(
            r"\b(?:remove|delete|drop|cancel)\s+(?:the\s+)?(.+?)(?:\s+(?:from|on)\s+day\s*\d+|\s+on\s+\d+(?:st|nd|rd|th)?\b|$)",
            text,
        )
        if remove_match:
            title = remove_match.group(1).strip(" .")
            title = _strip_day_suffix(title)
            item_type = "transport" if any(w in title for w in ("train", "bus", "flight", "car", "transfer")) else "activity"
            edits.append(
                {
                    "edit": "remove_item",
                    "titleMatch": title,
                    "day": day,
                    "itemType": item_type,
                }
            )

    return edits


_MANUAL_ACTION_TYPES = frozenset({"request_destination", "show_similar_destinations"})

_ITINERARY_ACTION_TYPES = frozenset(
    {
        "create_trip",
        "create_draft_trip",
        "open_itinerary",
        "rebuild_itinerary",
        "regenerate_itinerary",
        "itinerary_edit",
    }
)


def _value_from_history(history: list[dict] | None, extractor) -> Any:
    for turn in reversed(history or []):
        if turn.get("role") != "user":
            continue
        value = extractor(turn["content"])
        if value:
            return value
    return None


def _route_from_history(history: list[dict] | None) -> tuple[str, str] | None:
    return _value_from_history(history, extract_trip_route)


def _duration_from_history(history: list[dict] | None) -> int | None:
    return _value_from_history(history, extract_duration_days)


def partition_chat_actions(actions: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    auto: list[dict[str, Any]] = []
    suggested: list[dict[str, Any]] = []
    for action in actions:
        payload = {k: v for k, v in action.items() if k != "auto"}
        if action.get("auto") is False or action.get("type") in _MANUAL_ACTION_TYPES:
            suggested.append(payload)
        else:
            auto.append(payload)
    return auto, suggested


def build_actions(
    message: str,
    *,
    trip_id: str | None = None,
    region: str | None = None,
    resolved: ResolvedDestination | None = None,
    history: list[dict] | None = None,
    llm_hints: dict[str, Any] | None = None,
    intent_override: str | None = None,
    known_slots: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """`intent_override` lets a caller that already promoted the intent (e.g.
    chat.py, when the LLM hint pass found real trip signal in a message the
    regex classifier called "general") make build_actions agree — otherwise
    it would silently recompute "general" here and never emit the trip
    action the caller's reply text claims it's taking."""
    intent = intent_override or infer_intent(message)
    destination = extract_destination(message)
    route = extract_trip_route(message)
    route_departure = route[0] if route else None
    route_arrival = route[1] if route else None
    hist_route = _route_from_history(history)
    if hist_route and not route:
        route_departure, route_arrival = hist_route
        route = hist_route
    actions: list[dict[str, Any]] = []

    flight_fix = extract_flight_correction(message)
    if trip_id and flight_fix:
        dep, arr = flight_fix
        actions.append({
            "type": "regenerate_itinerary",
            "tripId": trip_id,
            "style": flight_correction_hint(dep, arr),
            "departureLocation": dep,
            "arrivalLocation": arr,
            "useAi": True,
        })
        return actions

    # "I'm starting from Bangalore" on an open trip → update origin, keep destination.
    departure_only = extract_departure_city(message)
    if trip_id and departure_only:
        arrival = (
            (resolved.display_name if resolved else None)
            or region
            or (known_slots or {}).get("destination")
            or route_arrival
        )
        action: dict[str, Any] = {
            "type": "regenerate_itinerary",
            "tripId": trip_id,
            "departureLocation": departure_only,
            "useAi": True,
            "style": (
                flight_correction_hint(departure_only, arrival)
                if arrival
                else f"Update outbound flights to depart from {departure_only}."
            ),
        }
        if arrival:
            action["arrivalLocation"] = arrival
        actions.append(action)
        return actions

    if intent in {"browse_packages", "start_planning", "compare_prices", "budget_filter"} and destination:
        actions.append({"type": "navigate_packages", "destination": destination})

    if intent == "start_planning" and destination:
        actions.append({"type": "start_wizard", "destination": destination})

    if intent == "fix_itinerary":
        if trip_id and re.search(r"\b(flight|flights|transport|airport|flying)\b", message.lower()):
            hint = (
                flight_correction_hint(route_departure, route_arrival)
                if route_departure and route_arrival
                else "Regenerate flights and ground transport to match the trip's departure and destination."
            )
            action = {
                "type": "regenerate_itinerary",
                "tripId": trip_id,
                "style": hint,
                "useAi": True,
            }
            if route_departure:
                action["departureLocation"] = route_departure
            if route_arrival:
                action["arrivalLocation"] = route_arrival
            actions.append(action)
        elif re.search(
            r"\b(day\s+\d+|whole\s+trip|everything|rebuild|regenerate\s+(?:the\s+)?(?:whole|entire)|all\s+days)\b",
            message.lower(),
        ):
            action = {"type": "rebuild_itinerary"}
            if trip_id:
                action["tripId"] = trip_id
            actions.append(action)
        # Vague "fix my trip" — no auto-rebuild; enrich_reply asks what to fix.

    duration_days = extract_duration_days(message) or _duration_from_history(history)

    def _append_trip_actions(*, include_similar_chips: bool) -> None:
        from app.services.trip_planning_slots import (
            gather_trip_slots,
            ready_to_auto_create,
            slots_to_trip_action_fields,
        )

        slots = gather_trip_slots(
            message,
            history=history,
            region=region,
            resolved=resolved,
            llm_hints=llm_hints,
            known_slots=known_slots,
        )
        travelers = slots.travelers
        travel_style = slots.travel_style
        if intent == "group_trip":
            travelers = travelers or 2
            travel_style = travel_style or ("friends" if (travelers or 0) > 2 else "couple")

        place = slots.destination
        tier = slots.tier

        def _attach_route(action: dict[str, Any]) -> dict[str, Any]:
            if slots.departure_location:
                action["departureLocation"] = slots.departure_location
            if slots.arrival_location or place:
                action["arrivalLocation"] = slots.arrival_location or place
            if slots.budget:
                action["budget"] = slots.budget
            if slots.interests:
                action["interests"] = slots.interests
            return action

        if not ready_to_auto_create(slots):
            if tier == "unknown" and include_similar_chips:
                from app.services.destination_resolver import similar_destinations

                similar = resolved.similar if resolved else similar_destinations(None)
                actions.append(
                    {
                        "type": "show_similar_destinations",
                        "auto": False,
                        "similar": similar,
                    }
                )
            return

        fields = slots_to_trip_action_fields(slots)
        days = fields["durationDays"]
        if travel_style:
            fields["travelStyle"] = travel_style
        if travelers:
            fields["travelers"] = travelers

        if tier == "supported" and place:
            action: dict[str, Any] = _attach_route({
                "type": "create_trip",
                "destination": place,
                "durationDays": days,
                "travelers": fields["travelers"],
                "travelStyle": fields["travelStyle"],
                "coverageTier": "full",
                "budget": fields["budget"],
                "interests": fields["interests"],
            })
            actions.append(action)
        elif tier == "draft_eligible" and place:
            from app.services.destination_resolver import similar_destinations

            similar = resolved.similar if resolved else similar_destinations(place)
            draft_action: dict[str, Any] = _attach_route({
                "type": "create_draft_trip",
                "destination": place,
                "durationDays": days,
                "travelers": fields["travelers"],
                "travelStyle": fields["travelStyle"],
                "coverageTier": "draft",
                "budget": fields["budget"],
                "interests": fields["interests"],
            })
            actions.append(draft_action)
            if include_similar_chips:
                actions.append(
                    {
                        "type": "show_similar_destinations",
                        "auto": False,
                        "destination": place,
                        "similar": similar,
                    }
                )
                actions.append(
                    {
                        "type": "request_destination",
                        "auto": False,
                        "destination": place,
                    }
                )
        elif tier == "unknown" and include_similar_chips:
            from app.services.destination_resolver import similar_destinations

            similar = resolved.similar if resolved else similar_destinations(None)
            actions.append(
                {
                    "type": "show_similar_destinations",
                    "auto": False,
                    "similar": similar,
                }
            )

    if intent == "show_itinerary":
        if trip_id:
            actions.append({"type": "open_itinerary", "tripId": trip_id})
        else:
            _append_trip_actions(include_similar_chips=False)

    if intent in {"create_trip", "group_trip"}:
        _append_trip_actions(include_similar_chips=True)

    if intent == "filter_packages" and duration_days:
        actions.append({"type": "filter_packages", "durationDays": duration_days})
        if not any(a.get("type") == "navigate_packages" for a in actions):
            actions.append({"type": "navigate_packages", "destination": destination or region or "Europe"})

    if intent == "compare_prices":
        actions.append({
            "type": "sort_packages",
            "sortBy": "price_asc",
            "durationDays": duration_days,
            "destination": destination or region,
        })
        if duration_days:
            actions.append({"type": "filter_packages", "durationDays": duration_days})

    budget = extract_budget_amount(message)
    if intent == "budget_filter" and budget:
        actions.append({
            "type": "filter_budget",
            "maxBudget": budget,
            "durationDays": duration_days,
            "destination": destination or region,
        })

    if intent == "multi_city_trip":
        cities = extract_multi_city_route(message) or []
        total_days = duration_days or max(len(cities) * 3, 7)
        nights_each = max(1, total_days // max(len(cities), 1) - 1)
        city_days = [{"city": c, "nights": nights_each} for c in cities]
        actions.append({
            "type": "create_multi_city_trip",
            "destinations": cities,
            "cityDays": city_days,
            "durationDays": total_days,
            "travelers": extract_travelers(message),
        })

    if intent == "regenerate_day":
        day, style = extract_regenerate_day(message)
        action = {"type": "regenerate_itinerary", "day": day, "style": style, "useAi": True}
        if trip_id:
            action["tripId"] = trip_id
        actions.append(action)

    if intent == "save_note":
        note, day = extract_trip_note(message)
        if note:
            action = {"type": "save_trip_note", "note": note, "day": day}
            if trip_id:
                action["tripId"] = trip_id
            actions.append(action)

    if intent == "book_package":
        target = extract_package_booking_target(message)
        actions.append({
            "type": "book_package",
            "packageTitle": target,
            "destination": destination or region,
        })

    if intent == "book_trip":
        action = {"type": "book_trip"}
        if trip_id:
            action["tripId"] = trip_id
        actions.append(action)

    if intent == "show_images":
        actions.append({
            "type": "show_images",
            "query": message,
            "destination": destination or region,
        })

    if intent == "modify_itinerary":
        for edit in parse_itinerary_edits(message):
            action = {"type": "itinerary_edit", **edit}
            if trip_id:
                action["tripId"] = trip_id
            actions.append(action)

    return actions


def _pick(phrases: list[str]) -> str:
    """Vary a canned suffix so the assistant doesn't repeat the exact same
    sentence on every reply for a given intent — small pool, not randomness
    for its own sake."""
    return random.choice(phrases)


_PREMATURE_ACTION_CLAIM_PATTERNS = [
    # "I'm building/creating/putting together/sketching/opening a(n) ... itinerary ..."
    r"[^.!?]*\b(?:building|creating|putting together|sketching(?: out)?|starting to (?:build|sketch|create|put together)|opening|searching (?:the web|online) for)\b[^.!?]*\bitinerary[^.!?]*[.!?]+",
    # "you'll see it on your page / land on the itinerary page ..."
    r"[^.!?]*\byou(?:'ll| will) (?:see it|land)[^.!?]*\bpage[^.!?]*[.!?]+",
    # "I'm clearing out / scrapping the current itinerary ..."
    r"[^.!?]*\bI(?:'m| am) (?:clearing out|scrapping)[^.!?]*\bitinerary[^.!?]*[.!?]+",
]


def _strip_premature_action_claims(reply: str) -> str:
    """Remove any sentence where the model claims it's already building/opening
    an itinerary or updating the page — used whenever no such action was
    actually taken, so the reply doesn't contradict itself by asking a
    clarifying question and announcing the trip is already underway."""
    cleaned = reply
    for pattern in _PREMATURE_ACTION_CLAIM_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.I)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _tail_if_needed(reply: str, tails: list[str], already_said: list[str]) -> str:
    """Append a canned tail only when the model didn't already say the same thing."""
    lower = reply.lower()
    if any(phrase.lower() in lower for phrase in already_said):
        return reply.rstrip()
    return f"{reply.rstrip()} {_pick(tails)}"


@dataclass
class EnrichedReply:
    """Chat bubble text plus optional status chips shown above/beside the reply."""

    reply: str
    ui_status: list[str] = field(default_factory=list)


def _enriched(reply: str, *status: str) -> EnrichedReply:
    return EnrichedReply(reply=reply.rstrip(), ui_status=[s for s in status if s])


def _strip_open_followup_questions(reply: str) -> str:
    """Drop trailing clarifying questions that contradict a committed bulk edit."""
    cleaned = re.sub(
        r"(?:\s*[.!]?\s*)?(?:would you like|want me to|should i|or just slot)[^.?]*\?\s*$",
        "",
        reply,
        flags=re.I,
    )
    return cleaned.strip() or reply.rstrip()


def enrich_reply(
    reply: str,
    intent: str,
    destination: str | None,
    message: str = "",
    *,
    resolved: ResolvedDestination | None = None,
    auto_actions: list[dict[str, Any]] | None = None,
    history: list[dict] | None = None,
    region: str | None = None,
    llm_hints: dict[str, Any] | None = None,
    skip_duration_prompt: bool = False,
    locale: str | None = None,
    known_slots: dict[str, Any] | None = None,
) -> EnrichedReply:
    from app.services.trip_planning_slots import (
        collection_prompt,
        gather_trip_slots,
        ready_to_auto_create,
    )

    action_types = {a.get("type") for a in (auto_actions or [])}
    # Strip premature-action language from LLM replies before any intent-specific
    # routing so non-action paths can't claim itinerary-building they never triggered.
    if not (action_types & _ITINERARY_ACTION_TYPES):
        reply = _strip_premature_action_claims(reply)

    if intent == "general" and not (action_types & _ITINERARY_ACTION_TYPES):
        reply = re.sub(
            r"\s*I(?:'ve| have) updated your itinerary[^.!?]*[.!?]?",
            "",
            reply,
            flags=re.I,
        ).strip()
    if destination and intent == "browse_packages":
        return _enriched(
            _tail_if_needed(
                reply,
                [
                    f"I've pulled up {destination} packages on the page for you — take a look while we chat.",
                    f"Take a look at the {destination} packages I just brought up on the page.",
                    f"Pulled up some {destination} options on the page — see anything you like?",
                ],
                ["pulled up", "packages on the page", "brought up", "take a look"],
            )
        )
    if intent == "fix_itinerary":
        if not (action_types & {"rebuild_itinerary", "regenerate_itinerary"}):
            return _enriched(
                _tail_if_needed(
                    reply,
                    [
                        "What should I fix — the whole trip, flights/transport, or a specific day?",
                        "Want me to rebuild everything, just fix flights, or rework one day?",
                    ],
                    ["what should i fix", "whole trip", "specific day", "rebuild"],
                )
            )
        return _enriched(
            _tail_if_needed(
                reply,
                [
                    "I'm refreshing your itinerary in the background now.",
                    "Give me a moment — refreshing your itinerary now.",
                ],
                ["refreshing", "rebuilding", "regenerating"],
            ),
            "Refreshing itinerary",
        )
    if intent == "destination_info" and destination:
        return _enriched(
            _tail_if_needed(
                reply,
                [
                    f"Want me to turn this into a {destination} itinerary, or browse packages there?",
                    f"I can plan a trip to {destination} next — or pull up packages if you prefer.",
                ],
                ["itinerary", "packages", "plan a trip"],
            )
        )
    if intent == "regenerate_day":
        day, style = extract_regenerate_day(message)
        hint = f"day {day}" if day else "your itinerary"
        style_hint = f" with a {style} focus" if style else ""
        return _enriched(
            _tail_if_needed(
                reply,
                [
                    f"I'm regenerating {hint}{style_hint} using AI — this may take a moment.",
                    f"On it — reworking {hint}{style_hint} now, give it a moment.",
                ],
                ["regenerating", "reworking"],
            ),
            f"Regenerating {hint}",
        )
    if intent == "filter_packages":
        days = extract_duration_days(message)
        if days:
            return _enriched(
                _tail_if_needed(
                    reply,
                    [
                        f"I've filtered the packages list to about {days} days — check the page behind the chat.",
                        f"Filtered things down to roughly {days}-day trips — take a look behind the chat.",
                    ],
                    ["filtered", "filter"],
                )
            )
    if intent == "compare_prices":
        return _enriched(
            _tail_if_needed(
                reply,
                [
                    "I've sorted packages by lowest price — the best deals are at the top of the list.",
                    "Sorted by price now, cheapest first — top of the list is your best deal.",
                ],
                ["sorted", "lowest price", "cheapest"],
            )
        )
    if intent == "budget_filter":
        budget = extract_budget_amount(message)
        if budget:
            return _enriched(
                _tail_if_needed(
                    reply,
                    [
                        f"I've filtered packages within your ₹{budget:,} budget.",
                        f"Narrowed the list to packages under ₹{budget:,}.",
                    ],
                    ["filtered", "budget", "under"],
                )
            )
    if intent in {"create_trip", "group_trip"}:
        slots = gather_trip_slots(
            message,
            history=history,
            region=region,
            resolved=resolved,
            llm_hints=llm_hints,
            known_slots=known_slots,
        )
        place = slots.destination or destination
        travelers = slots.travelers
        days = slots.duration_days

        if not ready_to_auto_create(slots) or not (
            action_types & {"create_trip", "create_draft_trip"}
        ):
            reply = _strip_premature_action_claims(reply)
            prompt = collection_prompt(slots, locale=locale)
            if prompt:
                if (
                    skip_duration_prompt
                    and slots.destination
                    and (slots.duration_days is None or not slots.duration_confirmed)
                ):
                    return _enriched(reply)
                return _enriched(f"{reply} {prompt}".strip())
            if resolved and resolved.tier == "unknown":
                similar = ", ".join(resolved.similar[:3]) if resolved.similar else "Paris, Bali, or Dubai"
                return _enriched(
                    f"{reply} I couldn't pin down the destination — try naming a specific city or country. "
                    f"You can also browse similar supported places like {similar}."
                )
            if not place:
                guess = _guess_unrecognized_place(message)
                if guess:
                    return _enriched(
                        f'I don\'t have "{guess}" as a supported destination yet. '
                        "Try a well-known city or country, or browse Explore for places we currently cover."
                    )
                return _enriched(
                    f"{reply} I couldn't tell which destination you meant — "
                    "try naming a specific city or country."
                )

        reply = _strip_premature_action_claims(reply)

        group = f" for {travelers} travelers" if travelers else ""
        interest_hint = ""
        if slots.interests:
            interest_hint = f" focused on {', '.join(slots.interests[:3])}"

        if resolved and resolved.tier == "draft_eligible" and place and days:
            status = f"Building draft {days}-day {place} itinerary{group}{interest_hint}"
            return _enriched(reply or f"Great — drafting {place} now.", status)
        if resolved and resolved.tier == "unknown":
            similar = ", ".join(resolved.similar[:3]) if resolved.similar else "Paris, Bali, or Dubai"
            return _enriched(
                f"{reply} I couldn't pin down the destination — try naming a specific city or country. "
                f"You can also browse similar supported places like {similar}."
            )
        if not place:
            guess = _guess_unrecognized_place(message)
            if guess:
                return _enriched(
                    f'I don\'t have "{guess}" as a supported destination yet. '
                    "Try a well-known city or country, or browse Explore for places we currently cover."
                )
            return _enriched(
                f"{reply} I couldn't tell which destination you meant — "
                "try naming a specific city or country."
            )
        status = f"Building {days}-day {place} trip{group}{interest_hint}"
        return _enriched(reply or f"On it — planning {place}.", status)
    if intent == "multi_city_trip":
        cities = extract_multi_city_route(message) or []
        route = " → ".join(cities) if cities else "your cities"
        return _enriched(f"{reply.rstrip()} I'm planning a multi-city trip: {route}.")
    if intent == "show_itinerary":
        place = (resolved.display_name if resolved else None) or destination
        slots = gather_trip_slots(
            message,
            history=history,
            region=region,
            resolved=resolved,
            llm_hints=llm_hints,
            known_slots=known_slots,
        )
        days = slots.duration_days
        if "open_itinerary" in action_types:
            return _enriched(f"{reply.rstrip()} Opening your itinerary page now.", "Opening itinerary")
        if place and days and ("create_draft_trip" in action_types or "create_trip" in action_types):
            reply = _strip_premature_action_claims(reply)
            return _enriched(
                reply or f"Opening your {place} itinerary.",
                f"Opening {days}-day {place} itinerary",
            )
        if not place:
            return _enriched(
                f"{reply.rstrip()} I don't have a destination yet — "
                'try something like "plan a 5 day trip from Delhi to Chalakudy" first.'
            )
        reply = _strip_premature_action_claims(reply)
        prompt = collection_prompt(slots, locale=locale)
        if prompt:
            if (
                skip_duration_prompt
                and slots.destination
                and (slots.duration_days is None or not slots.duration_confirmed)
            ):
                return _enriched(reply)
            return _enriched(f"{reply} {prompt}".strip())
    if intent == "modify_itinerary":
        edits = parse_itinerary_edits(message)
        if not edits:
            # Keep the model's clarifying voice — don't claim failure when the
            # message was a vague ask rather than a structured edit.
            return _enriched(_strip_premature_action_claims(reply) or reply)
        bulk = next((e for e in edits if e.get("autoSuggest") and e.get("count")), None)
        if bulk:
            count = bulk.get("count", 1)
            day_num = bulk.get("day", 1)
            dest = destination or "your trip"
            cleaned = _strip_open_followup_questions(_strip_premature_action_claims(reply))
            return _enriched(
                cleaned or f"Adding {count} options to day {day_num}.",
                f"Adding {count} activities to day {day_num} · {dest}",
            )
        return _enriched(
            _strip_open_followup_questions(_strip_premature_action_claims(reply)) or reply,
            "Itinerary updated",
        )
    if intent == "save_note":
        return _enriched(f"{reply.rstrip()} I've saved that note on your itinerary.", "Note saved")
    if intent == "book_package":
        return _enriched(f"{reply.rstrip()} Taking you to checkout now.")
    if intent == "book_trip":
        return _enriched(f"{reply.rstrip()} Starting checkout for your trip.")
    if intent == "show_images":
        return _enriched(f"{reply.rstrip()} Here are some photos — scroll up in the chat to see them.")
    if intent == "group_trip":
        travelers = extract_travelers(message)
        if travelers:
            return _enriched(f"{reply.rstrip()} I've adjusted the plan for {travelers} travelers.")
    return _enriched(reply)
