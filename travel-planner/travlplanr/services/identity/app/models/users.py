"""
E1 — users: the auth principal.
Replaces the client-trusted AuthUser in localStorage.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

import sys
from pathlib import Path
from shared.database import Base


class UserKind(str, enum.Enum):
    CUSTOMER = "customer"
    STAFF = "staff"
    CORPORATE_ADMIN = "corporate_admin"
    TRAVEL_AGENT = "travel_agent"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class User(Base):
    """Auth principal — root of identity. One user = one customer_profile OR one staff."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_hash: Mapped[str | None] = mapped_column(String)
    user_kind: Mapped[UserKind] = mapped_column(
        Enum(UserKind, name="user_kind_enum"), nullable=False
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status_enum"), nullable=False, default=UserStatus.ACTIVE
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships (same-DB)
    customer_profile: Mapped[CustomerProfile | None] = relationship(
        back_populates="user", uselist=False
    )
    staff_profile: Mapped[StaffProfile | None] = relationship(
        back_populates="user", uselist=False
    )
    subscriptions: Mapped[list[Subscription]] = relationship(back_populates="user")


# Forward reference imports resolved at module level
from app.models.customer_profiles import CustomerProfile  # noqa: E402
from app.models.staff import StaffProfile  # noqa: E402
from app.models.plans import Subscription  # noqa: E402
