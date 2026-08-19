"""TravelNext Transfers (taxi/transfer booking) API — thin REST wrappers over
app.adapters.providers.travelnext_transfers.

Not wired into the unified /inventory/search path — transfers are a distinct
product from flights/hotels/cars/events/holidays, so these routes are exposed
directly for a future dedicated transfers flow.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext_transfers
from app.schemas.travelnext_transfers import (
    TransferBookingDetailsRequest,
    TransferBookingRequest,
    TransferCancelRequest,
    TransferDestinationSearchRequest,
    TransferSearchRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext Transfers is not configured")


@router.post("/destinations")
async def destinations(body: TransferDestinationSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_transfers.has_travelnext_transfers_credentials():
        _unavailable()
    return await travelnext_transfers.search_destinations(body.destination)


@router.post("/search")
async def search(body: TransferSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_transfers.has_travelnext_transfers_credentials():
        _unavailable()
    return await travelnext_transfers.search_transfers(
        body.journey_type,
        body.pickup_location,
        body.dropoff_location,
        body.adults,
        search_currency=body.search_currency,
        children=body.children,
        infants=body.infants,
        arrival_date=body.arrival_date,
        arrival_time=body.arrival_time,
        departure_date=body.departure_date,
        departure_time=body.departure_time,
        pickup_date=body.pickup_date,
        pickup_time=body.pickup_time,
        return_pickup_date=body.return_pickup_date,
        return_pickup_time=body.return_pickup_time,
        pickup_location_code=body.pickup_location_code,
        pickup_location_type=body.pickup_location_type,
        dropoff_location_code=body.dropoff_location_code,
        dropoff_location_type=body.dropoff_location_type,
        sorting=body.sorting,
    )


@router.post("/bookings")
async def book(body: TransferBookingRequest, auth: dict = Depends(require_customer)):
    if not travelnext_transfers.has_travelnext_transfers_credentials():
        _unavailable()
    return await travelnext_transfers.book_transfer(
        body.session_id,
        body.product_id,
        body.booking_type_id,
        body.pax_details.model_dump(),
        body.accomodation_details.model_dump(),
        client_reference=body.client_reference,
        payment_details=body.payment_details.model_dump() if body.payment_details else None,
        departure_airline=body.departure_airline.model_dump() if body.departure_airline else None,
        arrival_airline=body.arrival_airline.model_dump() if body.arrival_airline else None,
        extras=[extra.model_dump() for extra in body.extras] if body.extras else None,
        remark=body.remark,
    )


@router.post("/bookings/cancel")
async def cancel(body: TransferCancelRequest, auth: dict = Depends(require_customer)):
    if not travelnext_transfers.has_travelnext_transfers_credentials():
        _unavailable()
    return await travelnext_transfers.cancel_transfer(body.confirmation_id)


@router.post("/bookings/details")
async def booking_details(body: TransferBookingDetailsRequest, auth: dict = Depends(require_customer)):
    if not travelnext_transfers.has_travelnext_transfers_credentials():
        _unavailable()
    return await travelnext_transfers.get_booking_details(body.confirmation_id)
