"""TravelNext Cars (carsv3) API — thin REST wrappers over
app.adapters.providers.travelnext_cars.

Every route requires an authenticated customer. Today only car *search* is
wired into the existing /inventory/search path (see
app/adapters/inventory_manager.py); the rest is exposed for future frontend
integration (rental conditions, insurance, booking, cancel, booking details).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext_cars
from app.schemas.travelnext_cars import (
    CarBookRequest,
    CarInsuranceRequest,
    CarSearchRequest,
    RentalConditionRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext Cars is not configured")


@router.get("/languages")
async def languages(auth: dict = Depends(require_customer)):
    if not travelnext_cars.has_travelnext_cars_credentials():
        _unavailable()
    return await travelnext_cars.get_languages()


@router.get("/destinations")
async def destinations(auth: dict = Depends(require_customer)):
    if not travelnext_cars.has_travelnext_cars_credentials():
        _unavailable()
    return await travelnext_cars.get_destinations()


@router.post("/search")
async def search(body: CarSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_cars.has_travelnext_cars_credentials():
        _unavailable()
    return await travelnext_cars.search_availability(
        body.pickupId,
        body.dropoffId,
        body.pickupDate,
        body.dropoffDate,
        pickup_time=body.pickupTime,
        dropoff_time=body.dropoffTime,
        driver_age=body.driverAge,
        country_res=body.countryRes,
        currency=body.currency,
        pickup_location=body.pickupLocation,
        dropoff_location=body.dropoffLocation,
        sorting=body.sorting,
        language=body.language,
    )


@router.post("/rental-conditions")
async def rental_conditions(body: RentalConditionRequest, auth: dict = Depends(require_customer)):
    return await travelnext_cars.get_rental_condition_details(body.sessionId, body.referenceId)


@router.post("/insurance")
async def insurance(body: CarInsuranceRequest, auth: dict = Depends(require_customer)):
    return await travelnext_cars.get_car_insurance(body.sessionId, body.referenceId, body.firstName, body.lastName)


@router.post("/bookings")
async def book(body: CarBookRequest, auth: dict = Depends(require_customer)):
    if not travelnext_cars.has_travelnext_cars_credentials():
        _unavailable()
    return await travelnext_cars.book_car(
        body.sessionId,
        body.referenceId,
        body.noOfPassenger,
        body.paxDetails,
        body.paymentDetails,
        client_reference=body.clientReference,
        remark=body.remark,
        insurance_plan_id=body.insurancePlanId,
        extra_services=body.extraServices,
        airline_details=body.airlineDetails,
    )


@router.post("/bookings/{confirmation_id}/cancel")
async def cancel(confirmation_id: str, auth: dict = Depends(require_customer)):
    if not travelnext_cars.has_travelnext_cars_credentials():
        _unavailable()
    return await travelnext_cars.cancel_booking(confirmation_id)


@router.get("/bookings/{confirmation_id}")
async def booking_details(confirmation_id: str, auth: dict = Depends(require_customer)):
    if not travelnext_cars.has_travelnext_cars_credentials():
        _unavailable()
    return await travelnext_cars.get_booking_details(confirmation_id)
