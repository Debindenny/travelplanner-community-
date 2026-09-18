"""
Server-side mirror of the itinerary timeline's client-side lock rules
(apps/web/src/app/itinerary/components/itinerary-timeline/itinerary-timeline.component.ts
isLockedReservation() / isLocked()).

Flights, hotels, trains, buses and their check-in/out/departure/arrival/
transfer markers are fixed reservations: they cannot be reordered or have
their content swapped for a different activity. The client already disables
those controls in the UI; this module lets the API reject the same actions
if a request reaches it directly (a stale client, a replay, or a bypassed
UI), instead of relying on client-side disabling alone.
"""
from __future__ import annotations

import re

LOCKED_SEGMENT_TYPES = {"flight", "hotel", "train", "bus"}

_TITLE_RE = re.compile(
    r"\b(hotel\s+check-?in|hotel\s+check-?out|flight\s+check-?in|flight\s+check-?out|"
    r"flight\s+departure|flight\s+arrival|train\s+check-?in|train\s+check-?out|"
    r"train\s+departure|train\s+arrival|bus\s+check-?in|bus\s+check-?out|"
    r"bus\s+departure|bus\s+arrival)\b",
    re.IGNORECASE,
)
_KEYWORD_RE = re.compile(
    r"\b(flight|train|bus|transport|transportation|transfer|hotel|accommodation|stay)\b.*"
    r"\b(booking|reservation)\b",
    re.IGNORECASE,
)
_STANDALONE_TRANSIT_RE = re.compile(r"^(arrival|departure)\s*(?:[—\-:]|$)", re.IGNORECASE)
_LEADING_MODE_RE = re.compile(r"^(flight|hotel)\b", re.IGNORECASE)
_TRANSFER_RE = re.compile(
    r"\bairport\b.*\b(shuttle|transfer|express|taxi|pickup|drop-?off)\b|"
    r"\b(bus|train)\b.*\b(transfer|shuttle|express|departure|arrival|check-?in|check-?out|reservation|booking)\b",
    re.IGNORECASE,
)


def is_locked_reservation_title(title: str | None) -> bool:
    if not title:
        return False
    t = title.strip()
    return bool(
        _TITLE_RE.search(t)
        or _KEYWORD_RE.search(t)
        or _STANDALONE_TRANSIT_RE.search(t)
        or _LEADING_MODE_RE.search(t)
        or _TRANSFER_RE.search(t)
    )


def is_locked_segment(seg: dict) -> bool:
    """`seg` is a real-trip segment dict (has "type"/"title"/"model")."""
    seg_type = (seg.get("type") or "").lower()
    if seg_type in LOCKED_SEGMENT_TYPES:
        return True
    return is_locked_reservation_title(seg.get("title") or seg.get("model"))


def is_locked_activity(kind: str | None, title: str | None) -> bool:
    """`kind`/`title` come from an EventItineraryActivity row."""
    if (kind or "").lower() in LOCKED_SEGMENT_TYPES:
        return True
    return is_locked_reservation_title(title)
