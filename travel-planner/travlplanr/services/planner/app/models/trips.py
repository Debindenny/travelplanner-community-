"""
Planner models — Trips and Itineraries.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

import sys
from pathlib import Path
from shared.database import Base


class TripStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"
    PENDING = "pending"
    BOOKED = "booked"
    CANCELLED = "cancelled"
    CREATED = "created"


class Trip(Base):
    """
    Trip / Itinerary entity.
    Stores the structured data for a trip plan.
    Supports collaborative sharing, expense tracking, and comments.
    """

    __tablename__ = "trips"

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    __mapper_args__ = {
        "version_id_col": version
    }

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String, default="Unknown Customer")
    display_code: Mapped[str] = mapped_column(String, default="ITIN-0000")

    title: Mapped[str] = mapped_column(String, nullable=False)
    destination: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[str] = mapped_column(String, nullable=False)
    end_date: Mapped[str] = mapped_column(String, nullable=False)
    travelers: Mapped[int] = mapped_column(Integer, nullable=False)

    travel_style: Mapped[str | None] = mapped_column(String)
    travel_method: Mapped[str | None] = mapped_column(String)
    budget: Mapped[str | None] = mapped_column(String)

    interests: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    food_preferences: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus, name="trip_status_enum", create_type=True),
        nullable=False,
        default=TripStatus.READY,
    )
    image: Mapped[str | None] = mapped_column(String)

    # Use JSONB for simple nested structures
    days: Mapped[list[dict] | None] = mapped_column(JSONB)
    city_days: Mapped[list[dict] | None] = mapped_column(JSONB)
    segments: Mapped[list[dict] | None] = mapped_column(JSONB)
    customizations: Mapped[dict | None] = mapped_column(JSONB)
    section_versions: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, server_default='{}', default=dict
    )

    # RAG Vector Embedding
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Collaborative itineraries — locked plan unlocks expenses
    is_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    coverage_tier: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="full", default="full"
    )


class TripVersion(Base):
    """
    Immutable snapshot of a trip's itinerary, taken before each AI regeneration
    (see app.services.trip_versions.snapshot_trip). Lets a customer see what
    changed and revert to an earlier plan — see DESIGN_ENHANCEMENT_PLAN.md
    "Version history".
    """

    __tablename__ = "trip_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(64))

    title: Mapped[str | None] = mapped_column(String)
    days: Mapped[list[dict] | None] = mapped_column(JSONB)
    city_days: Mapped[list[dict] | None] = mapped_column(JSONB)
    segments: Mapped[list[dict] | None] = mapped_column(JSONB)
    customizations: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("trip_id", "version_number", name="uq_trip_versions_trip_id_number"),
    )



