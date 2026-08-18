"""
E18 — staff_customer_counts: Reporting model for staff assignment counts.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

import sys
from pathlib import Path
from shared.database import Base


class StaffCustomerCount(Base):
    """
    Tracks number of customers and trips assigned to a staff member.
    Updated by identity_consumer.
    """

    __tablename__ = "staff_customer_counts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    
    count_customers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_itineraries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_pending: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_booked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
