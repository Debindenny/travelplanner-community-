"""TravelNext (aeroVE5) flight API — thin REST wrappers over app.adapters.providers.travelnext.

Every route requires an authenticated customer. These endpoints expose the
full provider surface for future frontend integration (booking, ticketing,
post-booking servicing); today only flight *search* is wired into the
existing /inventory/search path (see app/adapters/inventory_manager.py).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext
from app.schemas.travelnext import (
    BookingNotesRequest,
    CreateBookingRequest,
    ExtraServicesRequest,
    FareRulesRequest,
    ReissueQuoteRequest,
    ReissueRequest,
    RevalidateRequest,
    SearchRequest,
    VoidOrRefundRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext is not configured")


@router.post("/search")
async def search(body: SearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.search_availability(
        body.journeyType,
        [seg.model_dump(exclude_none=True) for seg in body.originDestinationInfo],
        cabin_class=body.cabinClass,
        adults=body.adults,
        childs=body.childs,
        infants=body.infants,
        airline_code=body.airlineCode,
        direct_flight=body.directFlight,
        multiple_branded_fares=body.multipleBrandedFares,
        fare_type=body.fareType,
        required_currency=body.requiredCurrency,
    )


@router.post("/revalidate")
async def revalidate(body: RevalidateRequest, auth: dict = Depends(require_customer)):
    return await travelnext.revalidate(body.sessionId, body.fareSourceCode, body.fareSourceCodeInbound)


@router.post("/extra-services")
async def extra_services(body: ExtraServicesRequest, auth: dict = Depends(require_customer)):
    return await travelnext.get_extra_services(body.sessionId, body.fareSourceCode)


@router.post("/fare-rules")
async def fare_rules(body: FareRulesRequest, auth: dict = Depends(require_customer)):
    return await travelnext.get_fare_rules(body.sessionId, body.fareSourceCode, body.fareSourceCodeInbound)


@router.post("/bookings")
async def create_booking(body: CreateBookingRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    try:
        return await travelnext.create_booking(body.flightBookingInfo, body.paxInfo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/bookings/{unique_id}/ticket")
async def issue_ticket(unique_id: str, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.issue_ticket(unique_id)


@router.get("/bookings/{unique_id}")
async def trip_details(unique_id: str, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.get_trip_details(unique_id)


@router.post("/bookings/{unique_id}/cancel")
async def cancel_booking(unique_id: str, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.cancel_booking(unique_id)


@router.post("/bookings/{unique_id}/notes")
async def booking_notes(unique_id: str, body: BookingNotesRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.add_booking_notes(unique_id, body.notes)


@router.get("/bookings/{unique_id}/ptr-status")
async def ptr_status(unique_id: str, ptr_unique_id: str, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.get_post_ticket_status(unique_id, ptr_unique_id)


@router.post("/bookings/{unique_id}/void/quote")
async def void_quote(unique_id: str, body: VoidOrRefundRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.void_ticket_quote(
        unique_id, [p.model_dump(exclude_none=True) for p in body.paxDetails]
    )


@router.post("/bookings/{unique_id}/void")
async def void(unique_id: str, body: VoidOrRefundRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.void_ticket(
        unique_id, [p.model_dump(exclude_none=True) for p in body.paxDetails], body.remark
    )


@router.post("/bookings/{unique_id}/refund/quote")
async def refund_quote(unique_id: str, body: VoidOrRefundRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.refund_ticket_quote(
        unique_id, [p.model_dump(exclude_none=True) for p in body.paxDetails], body.remark
    )


@router.post("/bookings/{unique_id}/refund")
async def refund(unique_id: str, body: VoidOrRefundRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.refund_ticket(
        unique_id, [p.model_dump(exclude_none=True) for p in body.paxDetails], body.remark
    )


@router.post("/bookings/{unique_id}/reissue/quote")
async def reissue_quote(unique_id: str, body: ReissueQuoteRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.reissue_ticket_quote(
        unique_id,
        [p.model_dump(exclude_none=True) for p in body.paxDetails],
        body.originDestinationInfo,
    )


@router.post("/bookings/{unique_id}/reissue")
async def reissue(unique_id: str, body: ReissueRequest, auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.reissue_ticket(unique_id, body.ptrUniqueId, body.preferenceOption, body.remark)


@router.get("/airports")
async def airport_list(auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.get_airport_list()


@router.get("/airlines")
async def airline_list(auth: dict = Depends(require_customer)):
    if not travelnext.has_travelnext_credentials():
        _unavailable()
    return await travelnext.get_airline_list()
