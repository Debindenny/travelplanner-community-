"""
Affiliate models — Bookings.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from decimal import Decimal
from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, Uuid, func, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

import sys
from pathlib import Path
from shared.database import Base


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class PassengerType(str, enum.Enum):
    ADULT = "adult"
    CHILD = "child"
    INFANT = "infant"


class Booking(Base):
    """
    Booking entity representing a customer booking a trip/package.
    """

    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)

    trip_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    package_id: Mapped[str | None] = mapped_column(String, nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String, default="USD")

    status: Mapped[BookingStatus] = mapped_column(
        # values_callable stores the enum .value ("confirmed") to match the lowercase
        # Postgres enum labels; without it SQLAlchemy stores the NAME ("CONFIRMED")
        # and inserts fail with InvalidTextRepresentationError.
        Enum(
            BookingStatus,
            name="booking_status_enum",
            create_type=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=BookingStatus.PENDING,
    )

    stripe_session_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Booking reference, generated once the booking is CONFIRMED (see app/utils/pnr.py).
    # Nullable because PENDING bookings created via POST /bookings don't have one yet.
    pnr: Mapped[str | None] = mapped_column(String(6), unique=True, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    passengers: Mapped[list["BookingPassenger"]] = relationship(
        "BookingPassenger", cascade="all, delete-orphan", passive_deletes=True
    )
    flight_segments: Mapped[list["BookingFlightSegment"]] = relationship(
        "BookingFlightSegment", cascade="all, delete-orphan", passive_deletes=True
    )
    hotel_stays: Mapped[list["BookingHotelStay"]] = relationship(
        "BookingHotelStay", cascade="all, delete-orphan", passive_deletes=True
    )


class BookingPassenger(Base):
    """A single traveler attached to a booking."""

    __tablename__ = "booking_passengers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )

    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)

    passenger_type: Mapped[PassengerType] = mapped_column(
        Enum(
            PassengerType,
            name="passenger_type_enum",
            create_type=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=PassengerType.ADULT,
    )

    passport_number: Mapped[str | None] = mapped_column(String, nullable=True)
    nationality: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BookingFlightSegment(Base):
    """A flight segment attached to a booking, mirroring the frontend's AlternativeFlight shape."""

    __tablename__ = "booking_flight_segments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )

    carrier: Mapped[str] = mapped_column(String, nullable=False)
    airline_code: Mapped[str | None] = mapped_column(String, nullable=True)
    flight_no: Mapped[str | None] = mapped_column(String, nullable=True)
    cabin_class: Mapped[str | None] = mapped_column(String, nullable=True)

    origin_code: Mapped[str] = mapped_column(String, nullable=False)
    destination_code: Mapped[str] = mapped_column(String, nullable=False)
    dep_date: Mapped[str | None] = mapped_column(String, nullable=True)
    dep_time: Mapped[str | None] = mapped_column(String, nullable=True)
    arr_date: Mapped[str | None] = mapped_column(String, nullable=True)
    arr_time: Mapped[str | None] = mapped_column(String, nullable=True)
    duration: Mapped[str | None] = mapped_column(String, nullable=True)
    stops: Mapped[str | None] = mapped_column(String, nullable=True)
    refundable: Mapped[str | None] = mapped_column(String, nullable=True)

    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String, default="USD")

    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_offer_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BookingHotelStay(Base):
    """A hotel stay attached to a booking, mirroring the frontend's AlternativeHotel shape."""

    __tablename__ = "booking_hotel_stays"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )

    hotel_name: Mapped[str] = mapped_column(String, nullable=False)
    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 1), nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    distance: Mapped[str | None] = mapped_column(String, nullable=True)

    max_guests: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room_type: Mapped[str | None] = mapped_column(String, nullable=True)
    bed_preference: Mapped[str | None] = mapped_column(String, nullable=True)
    cancellation: Mapped[str | None] = mapped_column(String, nullable=True)
    parking: Mapped[str | None] = mapped_column(String, nullable=True)
    meal_plan: Mapped[str | None] = mapped_column(String, nullable=True)
    amenities: Mapped[str | None] = mapped_column(String, nullable=True)

    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    taxes: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String, default="USD")

    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_offer_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
