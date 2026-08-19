"""Request models for the TravelNext Rail router. Nested provider-specific
structures (bookingInfo, paxInfo) are passed through as plain dicts — see
travelnext_cars.py's schema module for why strict validation isn't worth it
for these.
"""

from typing import List

from pydantic import BaseModel


class OriginDestinationInfo(BaseModel):
    departureDate: str
    originCode: str
    destinationCode: str


class RailSearchRequest(BaseModel):
    OriginDestinationInfo: List[OriginDestinationInfo]
    adults: int = 1
    childs: int = 0
    infants: int = 0
    class_: str = "Economy"
    requiredCurrency: str = "AED"

    model_config = {"populate_by_name": True}


class RailRevalidateRequest(BaseModel):
    sessionId: str
    fareSourceCode: str


class RailFareRulesRequest(BaseModel):
    sessionId: str
    fareSourceCode: str


class RailBookingRequest(BaseModel):
    bookingInfo: dict
    paxInfo: dict


class RailUniqueIdRequest(BaseModel):
    uniqueId: str
