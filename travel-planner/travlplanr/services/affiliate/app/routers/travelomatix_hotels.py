"""Travelomatix Hotel API v3 — thin REST wrappers over
app.adapters.providers.travelomatix_hotels.

Inventory search (`/inventory/search?type=hotel`) uses
`search_hotels_travelomatix`. Dedicated routes expose the full booking pathway.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelomatix_hotels
from app.schemas.travelomatix_hotels import (
    AppReferenceRequest,
    BlockRoomRequest,
    CancellationRefundRequest,
    CommitBookingRequest,
    HotelBookingRequest,
    HotelSearchRequest,
    ResultTokenRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="Travelomatix Hotels is not configured")


@router.post("/search")
async def search(body: HotelSearchRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.search_hotels(
        check_in_date=body.CheckInDate,
        no_of_nights=body.NoOfNights,
        country_code=body.CountryCode,
        city_id=body.CityId,
        guest_nationality=body.GuestNationality,
        no_of_rooms=body.NoOfRooms,
        room_guests=[g.model_dump() for g in body.RoomGuests],
    )


@router.post("/details")
async def hotel_details(body: ResultTokenRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.get_hotel_details(body.ResultToken)


@router.post("/rooms")
async def room_list(body: ResultTokenRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.get_room_list(body.ResultToken)


@router.post("/block-room")
async def block_room(body: BlockRoomRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.block_room(body.ResultToken, body.RoomUniqueId)


@router.post("/bookings/commit")
async def commit_booking(body: CommitBookingRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.commit_booking(
        result_token=body.ResultToken,
        block_room_id=body.BlockRoomId,
        app_reference=body.AppReference,
        room_details=[r.model_dump() for r in body.RoomDetails],
    )


@router.post("/bookings")
async def book(body: HotelBookingRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    pax = [p.model_dump() for p in body.PassengerDetails] if body.PassengerDetails else None
    return await travelomatix_hotels.book_hotel(
        result_token=body.ResultToken,
        room_unique_ids=body.RoomUniqueId,
        app_reference=body.AppReference,
        passenger_details=pax,
        customer_email=body.customerEmail,
        customer_phone=body.customerPhone,
        title=body.title,
        first_name=body.firstName,
        last_name=body.lastName,
    )


@router.post("/bookings/hold-status")
async def hold_status(body: AppReferenceRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.update_hold_booking(body.AppReference)


@router.post("/bookings/cancel")
async def cancel(body: AppReferenceRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.cancel_booking(body.AppReference)


@router.post("/bookings/cancellation-refund")
async def cancellation_refund(body: CancellationRefundRequest, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        _unavailable()
    return await travelomatix_hotels.cancellation_refund_details(
        body.ChangeRequestId, body.AppReference
    )


@router.get("/cities")
async def cities(refresh: bool = False, auth: dict = Depends(require_customer)):
    if not travelomatix_hotels.has_travelomatix_hotels_credentials():
        return travelomatix_hotels.get_cities()
    if refresh:
        return await travelomatix_hotels.fetch_hotel_city_list(force_refresh=True)
    return await travelomatix_hotels.ensure_city_catalog()
