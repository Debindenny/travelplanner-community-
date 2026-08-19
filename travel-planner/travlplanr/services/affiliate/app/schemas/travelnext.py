"""Request models for the TravelNext router.

Nested provider-specific structures (paxInfo, flightBookingInfo,
OriginDestinationInfo segments, paxDetails) are accepted as plain dicts/lists
where the wire format varies. The adapter normalizes common aliases:

  flightBookingInfo:
    sessionId|session_id → flight_session_id
    fareSourceCode → fare_source_code
    fareType: Public|Private|WebFare (or search ints 1–3)
    IsPassportMandatory, areaCode, countryCode (defaults applied)

  paxInfo:
    either provider shape (customerEmail/customerPhone/paxDetails), or
    simplified adults[]/childs[]/infants[] list-of-objects (converted).

  reissue_ticket_quote paxDetails:
    type (ADT|CHD|INF) — required; aliases passengerType/paxType/Type normalized
    cabinPreference — optional on pax; also required on OriginDestinationInfo
  reissue OriginDestinationInfo:
    cabinPreference, flightNumber, airlineCode (provider validates in that order)
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class OriginDestinationSegment(BaseModel):
    departureDate: str
    airportOriginCode: str
    airportDestinationCode: str
    returnDate: Optional[str] = None


class SearchRequest(BaseModel):
    journeyType: str = Field(pattern="^(OneWay|Return|Circle)$")
    originDestinationInfo: List[OriginDestinationSegment] = Field(min_length=1)
    cabinClass: str = "Economy"
    adults: int = Field(default=1, ge=1, le=9)
    childs: int = Field(default=0, ge=0, le=9)
    infants: int = Field(default=0, ge=0, le=9)
    airlineCode: Optional[str] = None
    directFlight: Optional[int] = Field(default=None, ge=0, le=1)
    multipleBrandedFares: Optional[bool] = None
    # Search filter enum (provider): typically 1=Public, 2=Private, 3=WebFare
    fareType: Optional[int] = Field(default=None, ge=1, le=4)
    requiredCurrency: str = "USD"


class RevalidateRequest(BaseModel):
    sessionId: str
    fareSourceCode: str
    fareSourceCodeInbound: Optional[str] = None


class ExtraServicesRequest(BaseModel):
    sessionId: str
    fareSourceCode: str


class FareRulesRequest(BaseModel):
    sessionId: str
    fareSourceCode: str
    fareSourceCodeInbound: Optional[str] = None


class CreateBookingRequest(BaseModel):
    flightBookingInfo: dict
    paxInfo: dict


class BookingNotesRequest(BaseModel):
    notes: str = Field(min_length=1, max_length=1000)


class PaxDetailEntry(BaseModel):
    type: str = Field(pattern="^(ADT|CHD|INF)$")
    title: str
    firstName: str
    lastName: str
    eTicket: str
    # Required by reissue_ticket_quote; optional for void/refund.
    cabinPreference: Optional[str] = None


class VoidOrRefundRequest(BaseModel):
    paxDetails: List[PaxDetailEntry] = Field(min_length=1)
    remark: Optional[str] = None


class ReissueQuoteRequest(BaseModel):
    paxDetails: List[PaxDetailEntry] = Field(min_length=1)
    originDestinationInfo: List[dict] = Field(min_length=1)


class ReissueRequest(BaseModel):
    ptrUniqueId: str
    preferenceOption: int
    remark: Optional[str] = None
