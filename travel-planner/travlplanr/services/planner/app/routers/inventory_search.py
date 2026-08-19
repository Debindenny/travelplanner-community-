"""Shared location / route normalization for inventory search."""

from __future__ import annotations

import re

from shared.airports import airport_code_for_place

# Country or region label → primary city used in seeded inventory
PLACE_ALIASES: dict[str, str] = {
    "belgium": "Brussels",
    "france": "Paris",
    "netherlands": "Amsterdam",
    "italy": "Rome",
    "indonesia": "Bali",
    "uae": "Dubai",
    "switzerland": "Zurich",
    "japan": "Tokyo",
    "spain": "Madrid",
    "uk": "London",
    "united kingdom": "London",
    "germany": "Berlin",
    "austria": "Vienna",
    "portugal": "Lisbon",
    "greece": "Athens",
    "thailand": "Bangkok",
    "malaysia": "Kuala Lumpur",
    "singapore": "Singapore",
    "australia": "Sydney",
    "usa": "New York",
    "united states": "New York",
}

LOCATION_NOISE = re.compile(
    r"\b(airport|international|downtown|city centre|city center|station|central|pickup|dropoff)\b",
    re.I,
)


def resolve_place_tokens(raw: str | None) -> list[str]:
    """Turn a free-text location/dep/arr into searchable tokens (city + codes)."""
    if not raw or not raw.strip():
        return []

    tokens: list[str] = []
    cleaned = LOCATION_NOISE.sub(" ", raw).strip()
    for part in re.split(r"[,/&\-\→]+", cleaned):
        part = part.strip()
        if len(part) < 2:
            continue
        tokens.append(part)
        alias = PLACE_ALIASES.get(part.lower())
        if alias and alias not in tokens:
            tokens.append(alias)
        code = airport_code_for_place(alias or part)
        if code and code not in tokens:
            tokens.append(code)

    # Whole-string alias (e.g. "Belgium Airport" → Brussels)
    whole = LOCATION_NOISE.sub(" ", raw).strip().lower()
    alias = PLACE_ALIASES.get(whole)
    if alias and alias not in tokens:
        tokens.append(alias)
    for word in whole.split():
        alias = PLACE_ALIASES.get(word)
        if alias and alias not in tokens:
            tokens.append(alias)
        code = airport_code_for_place(alias or word)
        if code and code not in tokens:
            tokens.append(code)

    # Deduplicate preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for t in tokens:
        key = t.lower()
        if key not in seen:
            seen.add(key)
            unique.append(t)
    return unique
