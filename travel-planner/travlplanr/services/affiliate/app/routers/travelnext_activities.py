"""TravelNext Activities API — thin REST wrappers over
app.adapters.providers.travelnext_activities.

Search is also wired into the unified `/inventory/search` flow for bookable
activities.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext_activities
from app.schemas.travelnext_activities import (
    ActivityBookingRequest,
    ActivityConfirmationRequest,
    ActivityDetailsRequest,
    ActivitySearchRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext Activities is not configured")


@router.post("/search")
async def search(body: ActivitySearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_activities.has_travelnext_activities_credentials():
        _unavailable()
    return await travelnext_activities.search_activities(
        city_code=body.cityCode,
        hotel_code=body.hotelCode,
        geo_code=body.geoCode.model_dump() if body.geoCode else None,
        adults=body.adults,
        children=body.children,
        child_ages=body.childAges,
        currency=body.currency,
        from_date=body.fromDate,
        to_date=body.toDate,
        language=body.language,
        price_min=body.priceMin,
        price_max=body.priceMax,
    )


@router.post("/details")
async def details(body: ActivityDetailsRequest, auth: dict = Depends(require_customer)):
    if not travelnext_activities.has_travelnext_activities_credentials():
        _unavailable()
    return await travelnext_activities.get_activity_details(body.sessionId, body.activityCode, body.optionCode)


@router.post("/bookings")
async def create_booking(body: ActivityBookingRequest, auth: dict = Depends(require_customer)):
    if not travelnext_activities.has_travelnext_activities_credentials():
        _unavailable()
    return await travelnext_activities.create_booking(
        body.sessionId,
        body.clientReference,
        body.leadPassenger,
        body.activities,
    )


@router.get("/bookings/{confirmation_id}")
async def booking_details(confirmation_id: str, auth: dict = Depends(require_customer)):
    if not travelnext_activities.has_travelnext_activities_credentials():
        _unavailable()
    return await travelnext_activities.get_booking_details(confirmation_id)
