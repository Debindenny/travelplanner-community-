"""TravelNext Events (sports/concert tickets) API — thin REST wrappers over
app.adapters.providers.travelnext_events.

Not wired into the unified /inventory/search path — events tickets are a
distinct product from flights/hotels/cars/holidays, so these routes are
exposed directly for a future dedicated events flow.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.providers import travelnext_events
from app.schemas.travelnext_events import (
    EventArtistSearchRequest,
    EventCityIdSearchRequest,
    EventCitySearchRequest,
    EventCountrySearchRequest,
    EventOrderRequest,
    EventTeamSearchRequest,
    EventTournamentSearchRequest,
    EventTournamentTeamSearchRequest,
    TicketDetailsRequest,
)
from shared.auth_dependencies import require_customer

router = APIRouter()


def _unavailable() -> None:
    raise HTTPException(status_code=503, detail="TravelNext Events is not configured")


# --------------------------------------------------------------------------
# Event search
# --------------------------------------------------------------------------

@router.post("/search/country")
async def search_country(body: EventCountrySearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_by_country(
        body.countryId, body.countryName, currency=body.currency, per_page=body.perPage, current_page=body.currentPage
    )


@router.post("/search/city")
async def search_city(body: EventCitySearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_by_city(
        body.cityId, body.cityName, currency=body.currency, per_page=body.perPage, current_page=body.currentPage
    )


@router.post("/search/top-teams")
async def search_top_teams(body: EventTeamSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_top_teams(
        body.teamId, currency=body.currency, per_page=body.perPage, current_page=body.currentPage
    )


@router.post("/search/top-football")
async def search_top_football(body: EventTournamentTeamSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_top_football(
        body.tournamentId, currency=body.currency, per_page=body.perPage, current_page=body.currentPage
    )


@router.post("/search/usa-events")
async def search_usa_events(body: EventTeamSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_usa_events(
        body.teamId, currency=body.currency, per_page=body.perPage, current_page=body.currentPage
    )


@router.post("/search/top-cities")
async def search_top_cities(body: EventCityIdSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_top_cities(
        body.cityId, currency=body.currency, per_page=body.perPage, current_page=body.currentPage
    )


@router.post("/search/music-and-shows")
async def search_music_and_shows(body: EventArtistSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_music_and_shows(
        body.artistId, currency=body.currency, per_page=body.perPage, current_page=body.currentPage
    )


@router.post("/search/tournament")
async def search_tournament(body: EventTournamentSearchRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.search_tournament(
        body.tournamentId,
        currency=body.currency,
        per_page=body.perPage,
        current_page=body.currentPage,
        from_date=body.fromDate,
        until_date=body.untilDate,
    )


# --------------------------------------------------------------------------
# Tickets / booking
# --------------------------------------------------------------------------

@router.post("/tickets")
async def ticket_details(body: TicketDetailsRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_ticket_details(body.eventId, body.sessionId, currency=body.currency)


@router.post("/orders")
async def create_order(body: EventOrderRequest, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.create_order(
        body.sessionId,
        body.email,
        body.phone,
        body.shippingAddress,
        body.ticketId,
        body.ticketQty,
        body.eventId,
        body.provShipid,
        [attendee.model_dump() for attendee in body.attendeeDetails],
    )


@router.get("/orders/{confirmation_num}/{reference_num}")
async def booking_details(confirmation_num: str, reference_num: str, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_booking_details(confirmation_num, reference_num)


# --------------------------------------------------------------------------
# Static reference data
# --------------------------------------------------------------------------

@router.get("/static/countries")
async def static_countries(auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_countries()


@router.get("/static/sports")
async def static_sports(auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_sports()


@router.get("/static/cities/{country_id}")
async def static_cities(country_id: str, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_cities(country_id)


@router.get("/static/stadiums/{city_id}")
async def static_stadiums(city_id: str, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_stadiums(city_id)


@router.get("/static/tournaments/{sport_type_id}")
async def static_tournaments(sport_type_id: str, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_tournaments(sport_type_id)


@router.get("/static/competitors/{sport_type_id}")
async def static_competitors(sport_type_id: str, auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_competitors(sport_type_id)


@router.get("/static/top-teams")
async def static_top_teams(auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_top_teams()


@router.get("/static/top-football")
async def static_top_football(auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_top_football()


@router.get("/static/top-cities")
async def static_top_cities(auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_top_cities()


@router.get("/static/usa-events")
async def static_usa_events(auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_usa_events_static()


@router.get("/static/music-and-shows")
async def static_music_and_shows(auth: dict = Depends(require_customer)):
    if not travelnext_events.has_travelnext_events_credentials():
        _unavailable()
    return await travelnext_events.get_music_and_shows_static()
