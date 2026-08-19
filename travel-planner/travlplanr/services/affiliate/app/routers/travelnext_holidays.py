"""TravelNext Holidays API — thin REST wrappers over
app.adapters.providers.travelnext_holidays.

Not wired into the unified /inventory/search path — holiday packages are a
distinct product from flights/hotels/cars, so these routes are exposed
directly for a future dedicated holidays flow.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext_holidays
from app.schemas.travelnext_holidays import (
    HolidayBookingRequest,
    HolidayCountrySearchRequest,
    HolidayTravelStyleSearchRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext Holidays is not configured")


@router.get("/countries")
async def countries(auth: dict = Depends(require_customer)):
    if not travelnext_holidays.has_travelnext_holidays_credentials():
        _unavailable()
    return await travelnext_holidays.get_countries()


@router.get("/travel-styles")
async def travel_styles(auth: dict = Depends(require_customer)):
    if not travelnext_holidays.has_travelnext_holidays_credentials():
        _unavailable()
    return await travelnext_holidays.get_travel_styles()


@router.post("/search")
async def search(body: HolidayCountrySearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_holidays.has_travelnext_holidays_credentials():
        _unavailable()
    return await travelnext_holidays.search_by_country(
        body.country,
        body.fromDate,
        body.toDate,
        required_currency=body.requiredCurrency,
    )


@router.post("/search/travel-style")
async def search_travel_style(body: HolidayTravelStyleSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_holidays.has_travelnext_holidays_credentials():
        _unavailable()
    return await travelnext_holidays.search_by_travel_style(
        body.travelStyle,
        body.fromDate,
        body.toDate,
        required_currency=body.requiredCurrency,
        min_price=body.minPrice,
        max_price=body.maxPrice,
    )


@router.get("/packages/{holiday_code}")
async def package_details(holiday_code: str, required_currency: str = "USD", auth: dict = Depends(require_customer)):
    if not travelnext_holidays.has_travelnext_holidays_credentials():
        _unavailable()
    return await travelnext_holidays.get_holiday_details(holiday_code, required_currency=required_currency)


@router.post("/bookings")
async def book(body: HolidayBookingRequest, auth: dict = Depends(require_customer)):
    if not travelnext_holidays.has_travelnext_holidays_credentials():
        _unavailable()
    return await travelnext_holidays.create_booking(
        body.referenceCode,
        body.leadPassenger.model_dump(),
    )


@router.get("/bookings/{reference_code}")
async def booking_details(reference_code: str, auth: dict = Depends(require_customer)):
    if not travelnext_holidays.has_travelnext_holidays_credentials():
        _unavailable()
    return await travelnext_holidays.get_booking_details(reference_code)
