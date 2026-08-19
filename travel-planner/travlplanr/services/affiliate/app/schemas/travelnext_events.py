"""Request models for the TravelNext Events router."""

from typing import List, Optional

from pydantic import BaseModel


class EventCountrySearchRequest(BaseModel):
    countryId: str
    countryName: str
    currency: str = "USD"
    perPage: str = "20"
    currentPage: str = "1"


class EventCitySearchRequest(BaseModel):
    cityId: str
    cityName: str
    currency: str = "USD"
    perPage: str = "20"
    currentPage: str = "1"


class EventTeamSearchRequest(BaseModel):
    teamId: str
    currency: str = "USD"
    perPage: str = "20"
    currentPage: str = "1"


class EventTournamentTeamSearchRequest(BaseModel):
    tournamentId: str
    currency: str = "USD"
    perPage: str = "20"
    currentPage: str = "1"


class EventCityIdSearchRequest(BaseModel):
    cityId: str
    currency: str = "USD"
    perPage: str = "20"
    currentPage: str = "1"


class EventArtistSearchRequest(BaseModel):
    artistId: str
    currency: str = "USD"
    perPage: str = "20"
    currentPage: str = "1"


class EventTournamentSearchRequest(BaseModel):
    tournamentId: str
    currency: str = "USD"
    perPage: str = "20"
    currentPage: str = "1"
    fromDate: Optional[str] = None
    untilDate: Optional[str] = None


class TicketDetailsRequest(BaseModel):
    eventId: str
    sessionId: str
    currency: str = "USD"


class EventAttendee(BaseModel):
    nationalityCountryid: str
    cityofBirth: str
    passportNumber: str
    birthDate: str
    fullName: str


class EventOrderRequest(BaseModel):
    sessionId: str
    email: str
    phone: str
    shippingAddress: str
    ticketId: str
    ticketQty: str
    eventId: str
    provShipid: str
    attendeeDetails: List[EventAttendee]
