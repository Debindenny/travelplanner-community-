"""
Community hosted-journey itinerary, activity booking, transport and payment
participation models.

The event *catalog* (title/host/description — CommunityMeetup) is unrelated
here; these tables key on `event_id` as an opaque string matching the
frontend's CommunityEventCard.id (e.g. "evt-1"), not a FK into
community_meetups.id, since today's hosted-journey demo events have no row
there (see community-events-mock.store.ts — they are frontend-only seed
data). This lets the itinerary/booking/transport/payment interactions be
genuinely persisted without first migrating the whole event catalog.
"""
from __future__ import annotations
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base


class EventItineraryDay(Base):
    __tablename__ = "event_itinerary_days"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[str] = mapped_column(String(64), index=True)
    day_number: Mapped[int] = mapped_column(Integer)
    city: Mapped[str] = mapped_column(String(255))
    date_label: Mapped[str] = mapped_column(String(32))
    price: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("event_id", "day_number", name="uq_event_itinerary_days_event_day"),
    )


class EventItineraryActivity(Base):
    __tablename__ = "event_itinerary_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("event_itinerary_days.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    time: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(255))
    duration: Mapped[str] = mapped_column(String(32))
    rating: Mapped[float] = mapped_column(Float)
    image: Mapped[str] = mapped_column(String(2048))
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    booked_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    default_included: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class EventActivitySelection(Base):
    """Per-traveler include/exclude state for an itinerary activity — persists the toggle/change UI."""

    __tablename__ = "event_activity_selections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    event_id: Mapped[str] = mapped_column(String(64), index=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("event_itinerary_activities.id", ondelete="CASCADE"), index=True
    )
    included: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("customer_id", "activity_id", name="uq_event_activity_selections_customer_activity"),
    )


class EventActivityBooking(Base):
    """A traveler's real reservation of a priced activity — separate from the free include/exclude selection."""

    __tablename__ = "event_activity_bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    event_id: Mapped[str] = mapped_column(String(64), index=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("event_itinerary_activities.id", ondelete="CASCADE"), index=True
    )
    day_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="booked")
    participants: Mapped[int] = mapped_column(Integer, default=1)
    price_paid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    booked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("customer_id", "activity_id", name="uq_event_activity_bookings_customer_activity"),
    )


class EventTransportSegment(Base):
    """A traveler's personal "Add Transport" addition to the itinerary timeline."""

    __tablename__ = "event_transport_segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    event_id: Mapped[str] = mapped_column(String(64), index=True)
    after_day: Mapped[int] = mapped_column(Integer)
    mode: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(255))
    time: Mapped[str | None] = mapped_column(String(16), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EventJourneyParticipation(Base):
    """
    A traveler's join/payment state for a hosted journey — replaces passing the
    day-range selection through router state alone, and gives "Continue" a
    server-persisted record that survives a refresh. `trip_id` is filled in
    once the real Trip is created (see Trip.customizations["eventId"] for the
    matching link on the other side).
    """

    __tablename__ = "event_journey_participations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    event_id: Mapped[str] = mapped_column(String(64), index=True)
    mode: Mapped[str] = mapped_column(String(16))
    range_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    range_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payment_status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    amount_paid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    booking_reference: Mapped[str | None] = mapped_column(String(32), nullable=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("customer_id", "event_id", name="uq_event_journey_participations_customer_event"),
    )
