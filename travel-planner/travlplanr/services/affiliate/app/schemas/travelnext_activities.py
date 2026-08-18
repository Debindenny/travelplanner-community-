"""Request models for the TravelNext Activities router. Nested
provider-specific structures (leadPassenger, activities booking lines) are
passed through as plain dicts — see travelnext_cars.py's schema module for
why strict validation isn't worth it for these.
"""

from typing import List, Optional

from pydantic import BaseModel


class GeoCode(BaseModel):
    latitude: str
    longitude: str


class ActivitySearchRequest(BaseModel):
    cityCode: Optional[str] = None
    hotelCode: Optional[str] = None
    geoCode: Optional[GeoCode] = None
    adults: int
    children: int = 0
    childAges: List[int] = []
    currency: str = "USD"
    fromDate: Optional[str] = None
    toDate: Optional[str] = None
    language: Optional[str] = None
    priceMin: Optional[int] = None
    priceMax: Optional[int] = None


class ActivityDetailsRequest(BaseModel):
    sessionId: str
    activityCode: str
    optionCode: str


class ActivityBookingRequest(BaseModel):
    sessionId: str
    clientReference: str
    leadPassenger: dict
    activities: List[dict]


class ActivityConfirmationRequest(BaseModel):
    confirmationId: str
