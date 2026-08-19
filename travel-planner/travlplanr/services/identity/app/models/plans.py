"""
E11 — plans + subscriptions: plan tiers + usage/quota metering.
Powers the sidebar "Premium 45/50 = 90%" card.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

import sys
from pathlib import Path
from shared.database import Base


class PlanCode(str, enum.Enum):
    FREE = "free"
    INDIVIDUAL = "individual"
    TRAVEL_PARTNER = "travel_partner"


class Plan(Base):
    """Plan tier definition."""

    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    plans_limit: Mapped[int] = mapped_column(Integer, nullable=False)


class Subscription(Base):
    """
    Per-user subscription — metered server-side from generation_events.

    plans_used is server-metered off generation.completed events
    (no client-trusted increment).
    """

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    plan_code: Mapped[str] = mapped_column(
        String, ForeignKey("plans.code"), nullable=False
    )
    plans_used: Mapped[int] = mapped_column(Integer, default=0)
    plans_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="subscriptions")
    plan: Mapped[Plan] = relationship()


from app.models.users import User  # noqa: E402
