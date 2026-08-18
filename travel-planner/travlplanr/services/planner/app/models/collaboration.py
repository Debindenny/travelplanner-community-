"""
Collaborative Itineraries — data models.

Five tables:
  - TripCollaborator  : durable membership (owner/editor/viewer)
  - TripInvite        : disposable, expiring, single-use invite token
  - TripActivity      : who-changed-what audit feed
  - TripExpense       : Splitwise-lite expense header (int cents, not float)
  - ExpenseShare      : per-member slice of an expense
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base


# ---------------------------------------------------------------------------
# Role and status constants — kept as plain strings (no Enum) so the schema
# migration stays simple and the values are self-documenting in the DB.
# ---------------------------------------------------------------------------

ROLES = ("owner", "editor", "viewer")
COLLAB_STATUSES = ("pending", "active", "declined", "removed")
INVITE_STATUSES = ("pending", "accepted", "declined", "expired")
SPLIT_METHODS = ("equal", "custom", "percentage")


class TripCollaborator(Base):
    """Durable membership row — one per (trip, email)."""

    __tablename__ = "trip_collaborators"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # null while invite is pending (unregistered user)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    # always set; normalized lowercase — invite anchor + dedupe key
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    # resolved display name from identity once registered
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # optional per-trip nickname override
    nickname: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("trip_id", "email", name="uq_trip_collaborator_email"),)


class TripInvite(Base):
    """Disposable, expiring, single-use tokenised accept flow."""

    __tablename__ = "trip_invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invitee_email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    # high-entropy, single-use
    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TripActivity(Base):
    """Append-only who-changed-what feed."""

    __tablename__ = "trip_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Unknown")
    # e.g. "joined" | "edited_day" | "added_expense" | "invited" | "confirmed"
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TripExpense(Base):
    """Splitwise-lite expense header. All money in smallest currency unit (int)."""

    __tablename__ = "trip_expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    # food | transport | lodging | activities | other
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # ALWAYS int (cents / paise / smallest unit) — never float
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    # must be an active collaborator's user_id
    paid_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    split_method: Mapped[str] = mapped_column(String(20), nullable=False, default="equal")
    settled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ExpenseShare(Base):
    """Per-member slice of an expense."""

    __tablename__ = "expense_shares"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip_expenses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    share_cents: Mapped[int] = mapped_column(Integer, nullable=False)


class TripComment(Base):
    """
    Per-segment threaded comment — distinct from TripActivity (an audit log
    of *changes*, not discussion). `segment_id` is the client-side day/segment
    identifier already used in Trip.segments/days JSON, not a separate FK
    table, since segments aren't normalized rows.
    """

    __tablename__ = "trip_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    segment_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Unknown")
    body: Mapped[str] = mapped_column(String(2000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
