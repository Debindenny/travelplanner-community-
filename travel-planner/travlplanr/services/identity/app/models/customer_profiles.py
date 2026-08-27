"""
E2 — customer_profiles: traveler-facing profile + preferences.
1:1 with a 'customer' user. Merges UserProfile, TravelPreferences, admin Customer fields.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

import sys
from pathlib import Path
from shared.database import Base


class CustomerType(str, enum.Enum):
    """User-set profile attribute (NOT derived from trips). §2.2"""

    COUPLE = "Couple"
    SOLO = "Solo"
    FAMILY = "Family"
    FRIENDS = "Friends"


class CustomerProfile(Base):
    """
    Traveler profile — powers /customer admin page and customer app profile.

    display_code = CUSxxxxxx (admin Customer ID).
    customer_type is an explicit user-set attribute, not derived.
    """

    __tablename__ = "customer_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), unique=True, nullable=False
    )
    display_code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String)
    country_code: Mapped[str | None] = mapped_column(String, default="+91")
    customer_type: Mapped[CustomerType | None] = mapped_column(
        Enum(CustomerType, name="customer_type_enum")
    )

    # Profile fields from UserProfile
    gender: Mapped[str | None] = mapped_column(String)
    date_of_birth: Mapped[str | None] = mapped_column(String)
    nationality: Mapped[str | None] = mapped_column(String)
    avatar_url: Mapped[str | None] = mapped_column(String)
    cover_url: Mapped[str | None] = mapped_column(String)

    # Preference fields from TravelPreferences
    currency: Mapped[str | None] = mapped_column(String, default="INR")
    fav_destinations: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    pref_activities: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    pref_dietary: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    pref_travel_style: Mapped[str | None] = mapped_column(String)
    pref_accommodation: Mapped[str | None] = mapped_column(String)
    pref_transport: Mapped[str | None] = mapped_column(String)

    # Admin display fields
    date_joined: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)

    # Relationship (same-DB)
    user: Mapped["User"] = relationship(back_populates="customer_profile")

    # Assignments (same-DB, E15)
    assignments: Mapped[list["CustomerAssignment"]] = relationship(
        back_populates="customer", foreign_keys="CustomerAssignment.customer_id"
    )


from app.models.users import User  # noqa: E402
from app.models.customer_assignments import CustomerAssignment  # noqa: E402
