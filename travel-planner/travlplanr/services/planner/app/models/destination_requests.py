"""User requests for destinations not yet in the catalog."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base


class DestinationRequest(Base):
    __tablename__ = "destination_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    place_name: Mapped[str] = mapped_column(String(120), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open", server_default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
