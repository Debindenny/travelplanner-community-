"""AI learning flywheel — chat interaction logs, activity acceptance stats,
customer travel preferences, and prompt version tracking."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base


class ChatInteraction(Base):
    """One user message → assistant reply turn with decode/action metadata."""

    __tablename__ = "chat_interactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    assistant_reply: Mapped[str] = mapped_column(Text, nullable=False)
    page_path: Mapped[str | None] = mapped_column(String(512))
    region: Mapped[str | None] = mapped_column(String(120))
    active_day: Mapped[int | None] = mapped_column(Integer)

    regex_intent: Mapped[str | None] = mapped_column(String(64))
    final_intent: Mapped[str | None] = mapped_column(String(64))
    provider: Mapped[str | None] = mapped_column(String(32))

    # T3.3: cost/latency observability
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    parsed_edits: Mapped[list | None] = mapped_column(JSONB)
    actions_emitted: Mapped[list | None] = mapped_column(JSONB)
    llm_hints: Mapped[dict | None] = mapped_column(JSONB)
    llm_edit_used: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    shadow_llm_edits: Mapped[list | None] = mapped_column(JSONB)

    explicit_feedback: Mapped[str | None] = mapped_column(String(8))  # up | down
    feedback_note: Mapped[str | None] = mapped_column(Text)
    outcome_status: Mapped[str | None] = mapped_column(String(32))  # applied | partial | failed | clarified

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class ActivityOutcome(Base):
    """Implicit learning signal — what happened to a suggested/added activity."""

    __tablename__ = "activity_outcomes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    interaction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chat_interactions.id", ondelete="SET NULL"), nullable=True, index=True
    )

    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    activity_title: Mapped[str] = mapped_column(String(255), nullable=False)
    budget_tier: Mapped[str] = mapped_column(String(32), default="standard", server_default="standard")
    day_number: Mapped[int | None] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)  # suggested|kept|removed|swapped|booked
    source: Mapped[str] = mapped_column(String(32), default="chat", server_default="chat")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


class ActivityAcceptanceStat(Base):
    """Aggregated acceptance rates per city + activity + budget tier."""

    __tablename__ = "activity_acceptance_stats"
    __table_args__ = (
        UniqueConstraint("city_normalized", "title_normalized", "budget_tier", name="uq_activity_acceptance"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    city_normalized: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    title_normalized: Mapped[str] = mapped_column(String(255), nullable=False)
    budget_tier: Mapped[str] = mapped_column(String(32), default="standard", server_default="standard")

    times_suggested: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    times_kept: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    times_removed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    times_swapped: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    times_booked: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class CustomerTravelProfile(Base):
    """Per-customer inferred preferences from chat + itinerary behavior."""

    __tablename__ = "customer_travel_profiles"

    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    preferred_pace: Mapped[str | None] = mapped_column(String(32))  # relaxed | balanced | packed
    typical_budget_tier: Mapped[str | None] = mapped_column(String(32))
    interests: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    avoided_types: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    kept_activities_by_city: Mapped[dict | None] = mapped_column(JSONB)  # {city: [titles]}

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class PromptVersion(Base):
    """Versioned system prompts with measured quality metrics."""

    __tablename__ = "prompt_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    system_prompt_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    thumbs_up: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    thumbs_down: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    interaction_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
