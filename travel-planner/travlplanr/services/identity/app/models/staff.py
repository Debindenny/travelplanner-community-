"""
E3 — staff: admin/agency operators (Staff/Manager/Admin).
1:1 with a 'staff' user. Backs the admin header identity and /team page.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

import sys
from pathlib import Path
from shared.database import Base


class StaffRole(str, enum.Enum):
    STAFF = "Staff"
    MANAGER = "Manager"
    ADMIN = "Admin"


class StaffProfile(Base):
    """
    Admin/agency operator — powers /team admin page and admin header.

    display_code = TPExxxxxx (Employee ID).
    """

    __tablename__ = "staff"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), unique=True, nullable=False
    )
    display_code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String)
    role: Mapped[StaffRole] = mapped_column(
        Enum(StaffRole, name="staff_role_enum"), nullable=False, default=StaffRole.STAFF
    )
    date_joined: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)

    # Relationship (same-DB)
    user: Mapped["User"] = relationship(back_populates="staff_profile")

    # Assignments (same-DB, E15)
    assignments: Mapped[list["CustomerAssignment"]] = relationship(
        back_populates="staff", foreign_keys="CustomerAssignment.staff_id"
    )


from app.models.users import User  # noqa: E402
from app.models.customer_assignments import CustomerAssignment  # noqa: E402
