"""
E18 — trip_status_counts: Reporting model for trip statuses.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

import sys
from pathlib import Path
from shared.database import Base


class TripStatusCount(Base):
    """
    Tracks trip counts by status and destination for reporting/dashboard.
    Updated incrementally by the planner_consumer.
    """

    __tablename__ = "trip_status_counts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    
    # We store destination as a string for simplicity of group-by in donut chart
    destination: Mapped[str] = mapped_column(String, nullable=False, index=True)
    
    # Status counts for this customer and destination
    count_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_pending: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_booked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    count_cancelled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
