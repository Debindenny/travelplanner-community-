"""
Reporting model for customer segments.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

import sys
from pathlib import Path
from shared.database import Base


class CustomerSegmentCount(Base):
    """
    Tracks customer counts by segment (e.g. Couple, Friends, Solo, Family) for the donut chart.
    Updated by identity_consumer.
    """

    __tablename__ = "customer_segment_counts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    
    segment: Mapped[str] = mapped_column(String, nullable=False, index=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
