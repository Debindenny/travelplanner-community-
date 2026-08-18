"""Ranked activity suggestions for chat — inventory + curated + RAG + acceptance."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trips import Trip, TripStatus
from app.services.chat_learning_service import load_acceptance_scores
from app.services.embedding_service import generate_embedding

logger = logging.getLogger(__name__)

_TIME_SLOTS = ("Morning", "Noon", "Evening", "Night")


def _city_for_day(trip: Trip, day: int) -> str:
    if trip.city_days:
        offset = 0
        for block in trip.city_days:
            nights = int(block.get("nights") or block.get("days") or 1)
            if day <= offset + nights:
                return str(block.get("city") or trip.destination)
            offset += nights
    if trip.days:
        for d in trip.days:
            if int(d.get("day") or 0) == day:
                return str(d.get("city") or trip.destination)
    return trip.destination


def _activities_from_trip_day(trip: Trip, day: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for segment in trip.segments or []:
        if int(segment.get("day") or 0) != day:
            continue
        if segment.get("type") != "activity":
            continue
        title = segment.get("title") or segment.get("name")
        if title:
            out.append(
                {
                    "title": str(title),
                    "timeOfDay": segment.get("timeOfDay") or "Morning",
                    "duration": segment.get("duration") or "2 hours",
                    "attractionType": segment.get("attractionType") or "Tour",
                    "source": "rag_trip",
                }
            )
    return out


async def rag_activities_for_day(session: AsyncSession, trip: Trip, day: int, limit: int = 6) -> list[dict[str, Any]]:
    """Pull activities from similar successful trips for the same day number.

    T2.3: Uses cosine distance (consistent with destinations search) and a
    max-distance threshold so trips that are semantically dissimilar don't
    bleed irrelevant activities into suggestions.
    """
    city = _city_for_day(trip, day)
    prompt = (
        f"Destination: {trip.destination}, City: {city}, Day: {day}, "
        f"Travelers: {trip.travelers}, Style: {trip.travel_style}, "
        f"Budget: {trip.budget}, Interests: {', '.join(trip.interests or [])}"
    )
    # Cosine distance threshold: 0 = identical, 1 = orthogonal, 2 = opposite.
    # 0.5 keeps only trips that share meaningful semantic overlap (same region,
    # comparable style/interests).  Adjust via env var for tuning.
    import os as _os
    max_cosine_dist = float(_os.environ.get("RAG_MAX_COSINE_DISTANCE", "0.5"))
    try:
        vector = await generate_embedding(prompt)
        if not vector:
            return []
        similar = await session.execute(
            select(Trip)
            .where(Trip.embedding.is_not(None))
            .where(Trip.embedding.cosine_distance(vector) < max_cosine_dist)
            .where(Trip.status == TripStatus.READY)
            .where(Trip.tenant_id == trip.tenant_id)
            .where(Trip.id != trip.id)
            .order_by(Trip.embedding.cosine_distance(vector))
            .limit(3)
        )
        candidates: list[dict[str, Any]] = []
        for other in similar.scalars():
            for act in _activities_from_trip_day(other, day):
                if act["title"].lower() not in {c["title"].lower() for c in candidates}:
                    candidates.append(act)
                if len(candidates) >= limit:
                    return candidates
    except Exception as exc:
        logger.warning("rag_activities_for_day failed: %s", exc)
    return []


def rank_suggestion_candidates(
    candidates: list[dict[str, Any]],
    *,
    acceptance: dict[str, float],
    profile_kept: list[str] | None,
    profile_avoided: list[str] | None,
    existing_titles: set[str],
    limit: int,
) -> list[dict[str, Any]]:
    kept_set = {t.lower() for t in (profile_kept or [])}
    avoided_set = set(profile_avoided or [])

    def score(item: dict[str, Any]) -> float:
        title = item.get("title") or ""
        tl = title.lower()
        if tl in existing_titles:
            return -999.0
        s = acceptance.get(title, 0.0)
        if tl in kept_set:
            s += 1.5
        if any(a in tl for a in avoided_set):
            s -= 2.0
        if item.get("source") == "rag_trip":
            s += 0.4
        if item.get("source") == "inventory":
            s += 0.2
        return s

    ranked = sorted(candidates, key=score, reverse=True)
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in ranked:
        tl = (item.get("title") or "").lower()
        if not tl or tl in seen or score(item) < -100:
            continue
        seen.add(tl)
        result.append(item)
        if len(result) >= limit:
            break
    return result


async def build_ranked_activity_suggestions(
    session: AsyncSession,
    *,
    trip: Trip,
    day: int,
    count: int,
    inventory_results: list[dict[str, Any]],
    curated: list[dict[str, Any]],
    existing_titles: set[str],
    profile_kept: list[str] | None = None,
    profile_avoided: list[str] | None = None,
) -> list[dict[str, Any]]:
    city = _city_for_day(trip, day)
    budget = (trip.budget or "standard").lower()
    candidates: list[dict[str, Any]] = []

    for i, r in enumerate(inventory_results):
        candidates.append(
            {
                "title": r.get("title") or r.get("name") or "Activity",
                "timeOfDay": _TIME_SLOTS[i % len(_TIME_SLOTS)],
                "duration": r.get("duration") or "2 hours",
                "attractionType": r.get("attractionType") or "Tour",
                "price": r.get("price"),
                "image": r.get("image"),
                "source": "inventory",
            }
        )

    for c in curated:
        if not any(x["title"].lower() == c["title"].lower() for x in candidates):
            candidates.append({**c, "source": "curated"})

    for rag in await rag_activities_for_day(session, trip, day, limit=count + 4):
        if not any(x["title"].lower() == rag["title"].lower() for x in candidates):
            candidates.append(rag)

    titles = [c["title"] for c in candidates]
    acceptance = await load_acceptance_scores(session, city=city, titles=titles, budget_tier=budget)
    return rank_suggestion_candidates(
        candidates,
        acceptance=acceptance,
        profile_kept=profile_kept,
        profile_avoided=profile_avoided,
        existing_titles=existing_titles,
        limit=count,
    )
