"""Chat learning flywheel — record interactions, feedback, outcomes, and
aggregate acceptance stats + customer travel profiles."""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_learning import (
    ActivityAcceptanceStat,
    ActivityOutcome,
    ChatInteraction,
    CustomerTravelProfile,
    PromptVersion,
)

logger = logging.getLogger(__name__)

_ACCEPTANCE_FIELD = {
    "suggested": "times_suggested",
    "kept": "times_kept",
    "removed": "times_removed",
    "swapped": "times_swapped",
    "booked": "times_booked",
}


def _normalize_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _customer_uuid(auth: dict | None) -> uuid.UUID | None:
    if not auth:
        return None
    raw = auth.get("customer_id") or auth.get("sub")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None


def _trip_uuid(trip_id: str | None) -> uuid.UUID | None:
    if not trip_id:
        return None
    try:
        return uuid.UUID(str(trip_id))
    except ValueError:
        return None


def _infer_outcome_status(actions: list[dict], edits: list[dict], intent: str) -> str | None:
    if not actions and intent == "modify_itinerary" and not edits:
        return "failed"
    if actions:
        return "applied"
    if intent in {"create_trip", "group_trip", "show_itinerary"}:
        return "clarified"
    return None


async def record_chat_interaction(
    session: AsyncSession,
    *,
    auth: dict | None,
    user_message: str,
    assistant_reply: str,
    trip_id: str | None,
    page_path: str | None,
    region: str | None,
    regex_intent: str,
    final_intent: str,
    provider: str | None,
    parsed_edits: list[dict] | None,
    actions_emitted: list[dict] | None,
    llm_hints: dict | None,
    llm_edit_used: bool,
    shadow_llm_edits: list[dict] | None,
    session_id: str | None = None,
    active_day: int | None = None,
    llm_latency_ms: int | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> ChatInteraction:
    interaction = ChatInteraction(
        customer_id=_customer_uuid(auth),
        trip_id=_trip_uuid(trip_id),
        session_id=session_id,
        user_message=user_message,
        assistant_reply=assistant_reply,
        page_path=page_path,
        region=region,
        active_day=active_day,
        regex_intent=regex_intent,
        final_intent=final_intent,
        provider=provider,
        latency_ms=llm_latency_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        parsed_edits=parsed_edits,
        actions_emitted=actions_emitted,
        llm_hints=llm_hints,
        llm_edit_used=llm_edit_used,
        shadow_llm_edits=shadow_llm_edits,
        outcome_status=_infer_outcome_status(actions_emitted or [], parsed_edits or [], final_intent),
    )
    session.add(interaction)
    await session.flush()
    await _bump_prompt_interaction(session)
    return interaction


async def _bump_prompt_interaction(session: AsyncSession) -> None:
    row = await session.scalar(select(PromptVersion).where(PromptVersion.active.is_(True)).limit(1))
    if row:
        row.interaction_count = (row.interaction_count or 0) + 1


async def submit_chat_feedback(
    session: AsyncSession,
    *,
    interaction_id: uuid.UUID,
    customer_id: uuid.UUID | None,
    feedback: str,
    note: str | None = None,
) -> bool:
    interaction = await session.get(ChatInteraction, interaction_id)
    if not interaction:
        return False
    if customer_id and interaction.customer_id and interaction.customer_id != customer_id:
        return False
    interaction.explicit_feedback = feedback
    interaction.feedback_note = (note or "").strip() or None
    active = await session.scalar(select(PromptVersion).where(PromptVersion.active.is_(True)).limit(1))
    if active:
        if feedback == "up":
            active.thumbs_up = (active.thumbs_up or 0) + 1
        elif feedback == "down":
            active.thumbs_down = (active.thumbs_down or 0) + 1
    return True


async def record_activity_outcome(
    session: AsyncSession,
    *,
    auth: dict | None,
    city: str,
    activity_title: str,
    event_type: str,
    budget_tier: str = "standard",
    trip_id: str | None = None,
    interaction_id: uuid.UUID | None = None,
    day_number: int | None = None,
    source: str = "chat",
) -> None:
    if event_type not in _ACCEPTANCE_FIELD:
        return
    customer_id = _customer_uuid(auth)
    outcome = ActivityOutcome(
        customer_id=customer_id,
        trip_id=_trip_uuid(trip_id),
        interaction_id=interaction_id,
        city=city.strip(),
        activity_title=activity_title.strip(),
        budget_tier=budget_tier or "standard",
        day_number=day_number,
        event_type=event_type,
        source=source,
    )
    session.add(outcome)
    await _bump_acceptance_stat(session, city, activity_title, budget_tier, event_type)
    if customer_id and event_type in {"kept", "booked"}:
        await _update_travel_profile_kept(session, customer_id, city, activity_title, budget_tier)
    elif customer_id and event_type == "removed":
        await _update_travel_profile_avoided(session, customer_id, activity_title)


async def _get_or_create_stat(
    session: AsyncSession, city: str, title: str, budget_tier: str
) -> ActivityAcceptanceStat:
    city_n = _normalize_key(city)
    title_n = _normalize_key(title)
    tier = (budget_tier or "standard").lower()
    row = await session.scalar(
        select(ActivityAcceptanceStat).where(
            ActivityAcceptanceStat.city_normalized == city_n,
            ActivityAcceptanceStat.title_normalized == title_n,
            ActivityAcceptanceStat.budget_tier == tier,
        )
    )
    if row:
        return row
    row = ActivityAcceptanceStat(city_normalized=city_n, title_normalized=title_n, budget_tier=tier)
    session.add(row)
    await session.flush()
    return row


async def _bump_acceptance_stat(
    session: AsyncSession, city: str, title: str, budget_tier: str, event_type: str
) -> None:
    field = _ACCEPTANCE_FIELD.get(event_type)
    if not field:
        return
    row = await _get_or_create_stat(session, city, title, budget_tier)
    setattr(row, field, getattr(row, field, 0) + 1)
    row.updated_at = datetime.now(timezone.utc)


def acceptance_score(stat: ActivityAcceptanceStat) -> float:
    """Wilson-ish score: positive signals weighted over exposure."""
    positive = stat.times_kept + stat.times_booked * 2
    negative = stat.times_removed + stat.times_swapped
    exposure = max(stat.times_suggested, 1)
    return (positive - negative * 0.5) / exposure


async def load_acceptance_scores(
    session: AsyncSession,
    *,
    city: str,
    titles: list[str],
    budget_tier: str = "standard",
) -> dict[str, float]:
    if not titles:
        return {}
    city_n = _normalize_key(city)
    tier = (budget_tier or "standard").lower()
    normalized = {_normalize_key(t): t for t in titles}
    rows = (
        await session.execute(
            select(ActivityAcceptanceStat).where(
                ActivityAcceptanceStat.city_normalized == city_n,
                ActivityAcceptanceStat.budget_tier == tier,
                ActivityAcceptanceStat.title_normalized.in_(list(normalized.keys())),
            )
        )
    ).scalars().all()
    out: dict[str, float] = {}
    for row in rows:
        original = normalized.get(row.title_normalized)
        if original:
            out[original] = acceptance_score(row)
    return out


async def get_customer_travel_profile(session: AsyncSession, customer_id: uuid.UUID) -> CustomerTravelProfile | None:
    return await session.get(CustomerTravelProfile, customer_id)


async def _update_travel_profile_kept(
    session: AsyncSession, customer_id: uuid.UUID, city: str, title: str, budget_tier: str
) -> None:
    profile = await session.get(CustomerTravelProfile, customer_id)
    if not profile:
        profile = CustomerTravelProfile(customer_id=customer_id, kept_activities_by_city={})
        session.add(profile)
    kept = dict(profile.kept_activities_by_city or {})
    city_key = city.strip()
    titles = list(kept.get(city_key, []))
    if title not in titles:
        titles.append(title)
        kept[city_key] = titles[-20:]
    profile.kept_activities_by_city = kept
    profile.typical_budget_tier = budget_tier or profile.typical_budget_tier
    profile.updated_at = datetime.now(timezone.utc)


async def _update_travel_profile_avoided(session: AsyncSession, customer_id: uuid.UUID, title: str) -> None:
    profile = await session.get(CustomerTravelProfile, customer_id)
    if not profile:
        profile = CustomerTravelProfile(customer_id=customer_id, avoided_types=[])
        session.add(profile)
    avoided = list(profile.avoided_types or [])
    token = _normalize_key(title)[:80]
    if token not in avoided:
        avoided.append(token)
        profile.avoided_types = avoided[-30:]
    profile.updated_at = datetime.now(timezone.utc)


async def ensure_active_prompt_version(session: AsyncSession, system_prompt: str, name: str = "travel_assistant_v1") -> None:
    """Seed the active prompt version row on first chat if missing."""
    existing = await session.scalar(select(PromptVersion).where(PromptVersion.active.is_(True)).limit(1))
    if existing:
        return
    prompt_hash = hashlib.sha256(system_prompt.encode()).hexdigest()[:16]
    by_name = await session.scalar(select(PromptVersion).where(PromptVersion.name == name))
    if by_name:
        by_name.active = True
        by_name.deployed_at = datetime.now(timezone.utc)
        return
    session.add(
        PromptVersion(
            name=name,
            system_prompt_hash=prompt_hash,
            active=True,
            deployed_at=datetime.now(timezone.utc),
        )
    )


async def learning_dashboard_stats(session: AsyncSession, *, days: int = 30) -> dict[str, Any]:
    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # coarse window — good enough for admin dashboard
    total = await session.scalar(select(func.count()).select_from(ChatInteraction))
    thumbs_up = await session.scalar(
        select(func.count()).select_from(ChatInteraction).where(ChatInteraction.explicit_feedback == "up")
    )
    thumbs_down = await session.scalar(
        select(func.count()).select_from(ChatInteraction).where(ChatInteraction.explicit_feedback == "down")
    )
    modify_fail = await session.scalar(
        select(func.count())
        .select_from(ChatInteraction)
        .where(ChatInteraction.final_intent == "modify_itinerary", ChatInteraction.outcome_status == "failed")
    )
    top_cities = (
        await session.execute(
            select(ActivityAcceptanceStat.city_normalized, func.sum(ActivityAcceptanceStat.times_suggested))
            .group_by(ActivityAcceptanceStat.city_normalized)
            .order_by(func.sum(ActivityAcceptanceStat.times_suggested).desc())
            .limit(8)
        )
    ).all()
    low_acceptance = (
        await session.execute(
            select(
                ActivityAcceptanceStat.city_normalized,
                ActivityAcceptanceStat.title_normalized,
                ActivityAcceptanceStat.times_suggested,
                ActivityAcceptanceStat.times_removed,
            )
            .where(ActivityAcceptanceStat.times_suggested >= 3)
            .order_by(
                (
                    ActivityAcceptanceStat.times_removed
                    + ActivityAcceptanceStat.times_swapped
                ).desc()
            )
            .limit(10)
        )
    ).all()
    # T3.3: latency percentiles
    latency_stats = (
        await session.execute(
            select(
                func.avg(ChatInteraction.latency_ms).label("avg_ms"),
                func.percentile_cont(0.5).within_group(ChatInteraction.latency_ms).label("p50_ms"),
                func.percentile_cont(0.95).within_group(ChatInteraction.latency_ms).label("p95_ms"),
            ).where(ChatInteraction.latency_ms.is_not(None))
        )
    ).one_or_none()
    provider_breakdown = (
        await session.execute(
            select(ChatInteraction.provider, func.count().label("n"))
            .where(ChatInteraction.provider.is_not(None))
            .group_by(ChatInteraction.provider)
            .order_by(func.count().desc())
        )
    ).all()
    return {
        "interactions_total": total or 0,
        "thumbs_up": thumbs_up or 0,
        "thumbs_down": thumbs_down or 0,
        "modify_itinerary_failures": modify_fail or 0,
        "top_cities_by_suggestions": [{"city": c, "suggested": int(n or 0)} for c, n in top_cities],
        "low_acceptance_activities": [
            {
                "city": r.city_normalized,
                "title": r.title_normalized,
                "suggested": r.times_suggested,
                "removed": r.times_removed,
            }
            for r in low_acceptance
        ],
        "latency": {
            "avg_ms": round(float(latency_stats.avg_ms or 0), 1) if latency_stats else None,
            "p50_ms": round(float(latency_stats.p50_ms or 0), 1) if latency_stats else None,
            "p95_ms": round(float(latency_stats.p95_ms or 0), 1) if latency_stats else None,
        },
        "provider_breakdown": [{"provider": p, "count": int(n)} for p, n in provider_breakdown],
        "window_days": days,
    }