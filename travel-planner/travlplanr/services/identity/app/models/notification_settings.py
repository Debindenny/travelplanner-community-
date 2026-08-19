"""
E12 — notification_settings: per-user notification toggles.
Preferences only — distinct from the E17 notifications feed.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

import sys
from pathlib import Path
from shared.database import Base


class NotificationSetting(Base):
    """Per-user notification toggle (preference, not a feed item)."""

    __tablename__ = "notification_settings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    key: Mapped[str] = mapped_column(String, nullable=False)  # trip / deals / product
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
