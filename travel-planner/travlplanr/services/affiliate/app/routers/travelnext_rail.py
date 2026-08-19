"""TravelNext Rail API — thin REST wrappers over
app.adapters.providers.travelnext_rail.

Every route requires an authenticated customer. Search is also wired into the
existing `/inventory/search` path via `inventory_manager`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext_rail
from app.schemas.travelnext_rail import (
    RailBookingRequest,
    RailFareRulesRequest,
    RailRevalidateRequest,
    RailSearchRequest,
    RailUniqueIdRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext Rail is not configured")


@router.post("/search")
async def search(body: RailSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_rail.has_travelnext_rail_credentials():
        _unavailable()
    return await travelnext_rail.search_availability(
        [seg.model_dump(exclude_none=True) for seg in body.OriginDestinationInfo],
        adults=body.adults,
        childs=body.childs,
        infants=body.infants,
        cabin_class=body.class_,
        required_currency=body.requiredCurrency,
    )


@router.post("/revalidate")
async def revalidate(body: RailRevalidateRequest, auth: dict = Depends(require_customer)):
    return await travelnext_rail.revalidate(body.sessionId, body.fareSourceCode)


@router.post("/fare-rules")
async def fare_rules(body: RailFareRulesRequest, auth: dict = Depends(require_customer)):
    return await travelnext_rail.get_fare_rules(body.sessionId, body.fareSourceCode)


@router.post("/bookings")
async def create_booking(body: RailBookingRequest, auth: dict = Depends(require_customer)):
    if not travelnext_rail.has_travelnext_rail_credentials():
        _unavailable()
    return await travelnext_rail.create_booking(body.bookingInfo, body.paxInfo)


@router.post("/bookings/ticket")
async def issue_ticket(body: RailUniqueIdRequest, auth: dict = Depends(require_customer)):
    if not travelnext_rail.has_travelnext_rail_credentials():
        _unavailable()
    return await travelnext_rail.issue_ticket(body.uniqueId)


@router.post("/bookings/details")
async def booking_details(body: RailUniqueIdRequest, auth: dict = Depends(require_customer)):
    if not travelnext_rail.has_travelnext_rail_credentials():
        _unavailable()
    return await travelnext_rail.get_trip_details(body.uniqueId)
