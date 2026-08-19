"""TravelNext Cruise API — thin REST wrappers over
app.adapters.providers.travelnext_cruise.

Cruise search is also wired into the unified `/inventory/search` flow.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext_cruise
from app.schemas.travelnext_cruise import CruiseDetailsRequest, CruiseSearchRequest
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext Cruise is not configured")


@router.post("/search")
async def search(body: CruiseSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_cruise.has_travelnext_cruise_credentials():
        _unavailable()
    return await travelnext_cruise.search_cruises(
        body.startDate,
        body.endDate,
        body.toNights,
        body.destinationPortIds,
        body.cruiseLines,
        body.cruiseShipsIds,
        body.embarkationPortsIds,
        body.portOfCallIds,
        body.NumberOfCabin,
        body.searchType,
        from_nights=body.fromNights,
        marketing_code=body.marketingCode,
        vendor_sailing_identifier=body.vendorSailingIdentifier,
        from_price=body.fromPrice,
        to_price=body.toPrice,
    )


@router.post("/details")
async def details(body: CruiseDetailsRequest, auth: dict = Depends(require_customer)):
    if not travelnext_cruise.has_travelnext_cruise_credentials():
        _unavailable()
    return await travelnext_cruise.get_cruise_details(body.session_id, body.id)


@router.get("/static/destinations")
async def destinations(auth: dict = Depends(require_customer)):
    if not travelnext_cruise.has_travelnext_cruise_credentials():
        _unavailable()
    return await travelnext_cruise.get_destinations()


@router.get("/static/cruise-lines")
async def cruise_lines(auth: dict = Depends(require_customer)):
    if not travelnext_cruise.has_travelnext_cruise_credentials():
        _unavailable()
    return await travelnext_cruise.get_cruise_lines()


@router.get("/static/ships")
async def ships(auth: dict = Depends(require_customer)):
    if not travelnext_cruise.has_travelnext_cruise_credentials():
        _unavailable()
    return await travelnext_cruise.get_ships()


@router.get("/static/markets")
async def markets(auth: dict = Depends(require_customer)):
    if not travelnext_cruise.has_travelnext_cruise_credentials():
        _unavailable()
    return await travelnext_cruise.get_markets()


@router.get("/static/vendors")
async def vendors(auth: dict = Depends(require_customer)):
    if not travelnext_cruise.has_travelnext_cruise_credentials():
        _unavailable()
    return await travelnext_cruise.get_vendors()
