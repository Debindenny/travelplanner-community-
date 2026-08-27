"""
E15 — customer_assignments: maps which staff onboarded/manages which customer.
Projected from planner events. Powers "Onboard by" and staff per-record "Total Customer".
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

import sys
from pathlib import Path
from shared.database import Base


class AssignmentRole(str, enum.Enum):
    ONBOARDED_BY = "onboarded_by"
    MANAGES = "manages"


class CustomerAssignment(Base):
    """
    Staff-customer relationship.

    onboarded_by: first-writer-wins, set when a staff first creates a trip for a customer.
    manages: explicit assignment/reassignment by Manager/Admin.
    """

    __tablename__ = "customer_assignments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("customer_profiles.id"), nullable=False
    )
    staff_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("staff.id"), nullable=False
    )
    role: Mapped[AssignmentRole] = mapped_column(
        Enum(AssignmentRole, name="assignment_role_enum", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships (same-DB)
    customer: Mapped["CustomerProfile"] = relationship(
        back_populates="assignments", foreign_keys=[customer_id]
    )
    staff: Mapped["StaffProfile"] = relationship(
        back_populates="assignments", foreign_keys=[staff_id]
    )


from app.models.customer_profiles import CustomerProfile  # noqa: E402
from app.models.staff import StaffProfile  # noqa: E402
