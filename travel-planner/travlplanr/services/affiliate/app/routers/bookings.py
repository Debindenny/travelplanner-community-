"""Bookings CRUD — affiliate service."""

from __future__ import annotations

import uuid
from datetime import date
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bookings import (
    Booking,
    BookingFlightSegment,
    BookingHotelStay,
    BookingPassenger,
    BookingStatus,
    PassengerType,
)
from shared.auth_dependencies import require_customer
from shared.events import DomainEvent, EventType, STREAM_AFFILIATE
from shared.redis_client import emit_event

from decimal import Decimal

router = APIRouter()

class CreateBookingRequest(BaseModel):
    tripId: Optional[str] = None
    packageId: Optional[str] = None
    amount: Decimal = Field(default=Decimal("0.0"), ge=0, le=1_000_000)
    # ISO-4217-style 3-letter uppercase code (rejects "FAKE_CODE", lowercase, etc.)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")


class PassengerInput(BaseModel):
    firstName: str = Field(min_length=1, max_length=100)
    lastName: str = Field(min_length=1, max_length=100)
    dateOfBirth: Optional[date] = None
    passengerType: PassengerType = PassengerType.ADULT
    passportNumber: Optional[str] = Field(default=None, max_length=50)
    nationality: Optional[str] = Field(default=None, max_length=100)


class SavePassengersRequest(BaseModel):
    passengers: List[PassengerInput] = Field(max_length=20)


class FlightSegmentInput(BaseModel):
    carrier: str
    airlineCode: Optional[str] = None
    flightNo: Optional[str] = None
    class_: Optional[str] = Field(default=None, alias="class")
    depCode: str
    arrCode: str
    depDate: Optional[str] = None
    depTime: Optional[str] = None
    arrDate: Optional[str] = None
    arrTime: Optional[str] = None
    duration: Optional[str] = None
    stops: Optional[str] = None
    refundable: Optional[str] = None
    price: Optional[Decimal] = Field(default=None, ge=0, le=1_000_000)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    provider: Optional[str] = None
    id: Optional[str] = None

    model_config = {"populate_by_name": True}


class SaveFlightSegmentsRequest(BaseModel):
    segments: List[FlightSegmentInput] = Field(max_length=20)


class HotelStayInput(BaseModel):
    name: str
    rating: Optional[Decimal] = Field(default=None, ge=0, le=5)
    location: Optional[str] = None
    city: Optional[str] = None
    distance: Optional[str] = None
    maxGuests: Optional[int] = Field(default=None, ge=0, le=50)
    roomType: Optional[str] = None
    bedPreference: Optional[str] = None
    cancellation: Optional[str] = None
    parking: Optional[str] = None
    mealPlan: Optional[str] = None
    amenities: Optional[List[str]] = None
    price: Optional[Decimal] = Field(default=None, ge=0, le=1_000_000)
    taxes: Optional[Decimal] = Field(default=None, ge=0, le=1_000_000)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    imageUrl: Optional[str] = None
    provider: Optional[str] = None
    id: Optional[str] = None


class SaveHotelStaysRequest(BaseModel):
    stays: List[HotelStayInput] = Field(max_length=20)


async def _get_owned_booking(session, booking_id: str, auth: dict, *, for_update: bool = False) -> Booking:
    try:
        booking_uuid = uuid.UUID(booking_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid booking id")

    customer_id = uuid.UUID(auth.get("customer_id"))
    tenant_id = uuid.UUID(auth.get("tenant_id"))

    query = select(Booking).where(Booking.id == booking_uuid)
    if for_update:
        # Serializes concurrent replace-the-list calls (passengers/flight-segments/
        # hotel-stays) for the same booking — e.g. two browser tabs both landing on
        # the checkout-success redirect — so one delete-then-reinsert commits fully
        # before the next begins, instead of interleaving and duplicating rows.
        query = query.with_for_update()
    booking = (await session.execute(query)).scalar_one_or_none()
    if not booking or booking.customer_id != customer_id or booking.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@router.get("")
async def list_bookings(request: Request, auth: dict = Depends(require_customer)):
    """List bookings for the authenticated customer."""
    customer_id = uuid.UUID(auth.get("customer_id"))
    tenant_id = uuid.UUID(auth.get("tenant_id"))
    
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(Booking)
            .where(Booking.customer_id == customer_id, Booking.tenant_id == tenant_id)
            .order_by(Booking.created_at.desc())
        )
        rows = result.scalars().all()
        
        items = []
        for b in rows:
            items.append({
                "id": str(b.id),
                "tripId": str(b.trip_id) if b.trip_id else None,
                "packageId": b.package_id,
                "amount": float(b.amount),
                "currency": b.currency,
                "status": b.status.value,
                "createdAt": b.created_at.isoformat() if b.created_at else None
            })
            
        return {"items": items, "total": len(items)}


@router.post("")
async def create_booking(body: CreateBookingRequest, request: Request, auth: dict = Depends(require_customer)):
    """Create a booking. Idempotent based on trip_id / package_id."""
    if not body.tripId and not body.packageId:
        raise HTTPException(status_code=400, detail="Must provide tripId or packageId")
        
    customer_id = uuid.UUID(auth.get("customer_id"))
    tenant_id = uuid.UUID(auth.get("tenant_id"))
    trip_uuid = uuid.UUID(body.tripId) if body.tripId else None
    
    async with request.app.state.session_factory() as session:
        # Idempotency check: check both trip_id and package_id to prevent false duplicate matches
        query = select(Booking).where(
            Booking.customer_id == customer_id,
            Booking.tenant_id == tenant_id,
            Booking.trip_id == trip_uuid,
            Booking.package_id == body.packageId
        )
            
        existing = (await session.execute(query)).scalar_one_or_none()
        if existing:
            return {
                "status": "success",
                "message": "Booking already exists",
                "bookingId": str(existing.id),
                "tripId": body.tripId,
                "packageId": body.packageId
            }
            
        # Create new booking
        booking = Booking(
            tenant_id=tenant_id,
            customer_id=customer_id,
            trip_id=trip_uuid,
            package_id=body.packageId,
            amount=body.amount,
            currency=body.currency,
            status=BookingStatus.PENDING
        )
        session.add(booking)
        await session.commit()
        await session.refresh(booking)
        
        return {
            "status": "success",
            "bookingId": str(booking.id),
            "tripId": body.tripId,
            "packageId": body.packageId
        }


@router.get("/by-trip/{trip_id}")
async def get_booking_by_trip(trip_id: str, request: Request, auth: dict = Depends(require_customer)):
    """Resolve the caller's booking for a trip. 404 until the async booking consumer has created it."""
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip id")

    customer_id = uuid.UUID(auth.get("customer_id"))
    tenant_id = uuid.UUID(auth.get("tenant_id"))

    async with request.app.state.session_factory() as session:
        booking = (
            await session.execute(
                select(Booking)
                .where(
                    Booking.trip_id == trip_uuid,
                    Booking.customer_id == customer_id,
                    Booking.tenant_id == tenant_id,
                )
                .order_by(Booking.created_at.desc())
            )
        ).scalars().first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found for this trip")

        return {"bookingId": str(booking.id), "status": booking.status.value, "pnr": booking.pnr}


@router.get("/{booking_id}")
async def get_booking_detail(booking_id: str, request: Request, auth: dict = Depends(require_customer)):
    """Full booking detail: booking fields + passengers + flight segments."""
    async with request.app.state.session_factory() as session:
        booking = await _get_owned_booking(session, booking_id, auth)

        passengers = (
            await session.execute(
                select(BookingPassenger).where(BookingPassenger.booking_id == booking.id)
            )
        ).scalars().all()
        segments = (
            await session.execute(
                select(BookingFlightSegment).where(BookingFlightSegment.booking_id == booking.id)
            )
        ).scalars().all()
        hotel_stays = (
            await session.execute(
                select(BookingHotelStay).where(BookingHotelStay.booking_id == booking.id)
            )
        ).scalars().all()

        return {
            "id": str(booking.id),
            "tripId": str(booking.trip_id) if booking.trip_id else None,
            "packageId": booking.package_id,
            "amount": float(booking.amount),
            "currency": booking.currency,
            "status": booking.status.value,
            "pnr": booking.pnr,
            "createdAt": booking.created_at.isoformat() if booking.created_at else None,
            "passengers": [
                {
                    "id": str(p.id),
                    "firstName": p.first_name,
                    "lastName": p.last_name,
                    "dateOfBirth": p.date_of_birth.isoformat() if p.date_of_birth else None,
                    "passengerType": p.passenger_type.value,
                    "passportNumber": p.passport_number,
                    "nationality": p.nationality,
                }
                for p in passengers
            ],
            "flightSegments": [
                {
                    "id": str(s.id),
                    "carrier": s.carrier,
                    "airlineCode": s.airline_code,
                    "flightNo": s.flight_no,
                    "class": s.cabin_class,
                    "depCode": s.origin_code,
                    "arrCode": s.destination_code,
                    "depDate": s.dep_date,
                    "depTime": s.dep_time,
                    "arrDate": s.arr_date,
                    "arrTime": s.arr_time,
                    "duration": s.duration,
                    "stops": s.stops,
                    "refundable": s.refundable,
                    "price": float(s.price) if s.price is not None else None,
                    "currency": s.currency,
                    "provider": s.provider,
                }
                for s in segments
            ],
            "hotelStays": [
                {
                    "id": str(h.id),
                    "name": h.hotel_name,
                    "rating": float(h.rating) if h.rating is not None else None,
                    "location": h.location,
                    "city": h.city,
                    "distance": h.distance,
                    "maxGuests": h.max_guests,
                    "roomType": h.room_type,
                    "bedPreference": h.bed_preference,
                    "cancellation": h.cancellation,
                    "parking": h.parking,
                    "mealPlan": h.meal_plan,
                    "amenities": h.amenities.split(",") if h.amenities else [],
                    "price": float(h.price) if h.price is not None else None,
                    "taxes": float(h.taxes) if h.taxes is not None else None,
                    "currency": h.currency,
                    "imageUrl": h.image_url,
                    "provider": h.provider,
                }
                for h in hotel_stays
            ],
        }


@router.put("/{booking_id}/passengers")
async def save_booking_passengers(
    booking_id: str, body: SavePassengersRequest, request: Request, auth: dict = Depends(require_customer)
):
    """Replace the full passenger list for a booking."""
    async with request.app.state.session_factory() as session:
        booking = await _get_owned_booking(session, booking_id, auth, for_update=True)

        await session.execute(delete(BookingPassenger).where(BookingPassenger.booking_id == booking.id))
        for p in body.passengers:
            session.add(BookingPassenger(
                booking_id=booking.id,
                first_name=p.firstName,
                last_name=p.lastName,
                date_of_birth=p.dateOfBirth,
                passenger_type=p.passengerType,
                passport_number=p.passportNumber,
                nationality=p.nationality,
            ))
        await session.commit()

        return {"status": "success", "bookingId": str(booking.id), "count": len(body.passengers)}


@router.put("/{booking_id}/flight-segments")
async def save_booking_flight_segments(
    booking_id: str, body: SaveFlightSegmentsRequest, request: Request, auth: dict = Depends(require_customer)
):
    """Replace the full flight-segment list for a booking."""
    async with request.app.state.session_factory() as session:
        booking = await _get_owned_booking(session, booking_id, auth, for_update=True)

        await session.execute(delete(BookingFlightSegment).where(BookingFlightSegment.booking_id == booking.id))
        for s in body.segments:
            session.add(BookingFlightSegment(
                booking_id=booking.id,
                carrier=s.carrier,
                airline_code=s.airlineCode,
                flight_no=s.flightNo,
                cabin_class=s.class_,
                origin_code=s.depCode,
                destination_code=s.arrCode,
                dep_date=s.depDate,
                dep_time=s.depTime,
                arr_date=s.arrDate,
                arr_time=s.arrTime,
                duration=s.duration,
                stops=s.stops,
                refundable=s.refundable,
                price=s.price,
                currency=s.currency,
                provider=s.provider,
                provider_offer_id=s.id,
            ))
        await session.commit()

        return {"status": "success", "bookingId": str(booking.id), "count": len(body.segments)}


@router.put("/{booking_id}/hotel-stays")
async def save_booking_hotel_stays(
    booking_id: str, body: SaveHotelStaysRequest, request: Request, auth: dict = Depends(require_customer)
):
    """Replace the full hotel-stay list for a booking."""
    async with request.app.state.session_factory() as session:
        booking = await _get_owned_booking(session, booking_id, auth, for_update=True)

        await session.execute(delete(BookingHotelStay).where(BookingHotelStay.booking_id == booking.id))
        for h in body.stays:
            session.add(BookingHotelStay(
                booking_id=booking.id,
                hotel_name=h.name,
                rating=h.rating,
                location=h.location,
                city=h.city,
                distance=h.distance,
                max_guests=h.maxGuests,
                room_type=h.roomType,
                bed_preference=h.bedPreference,
                cancellation=h.cancellation,
                parking=h.parking,
                meal_plan=h.mealPlan,
                amenities=",".join(h.amenities) if h.amenities else None,
                price=h.price,
                taxes=h.taxes,
                currency=h.currency,
                image_url=h.imageUrl,
                provider=h.provider,
                provider_offer_id=h.id,
            ))
        await session.commit()

        return {"status": "success", "bookingId": str(booking.id), "count": len(body.stays)}
