"""Request models for the TravelNext Holidays router."""

from typing import Optional

from pydantic import BaseModel


class HolidayCountrySearchRequest(BaseModel):
    country: str
    fromDate: str
    toDate: str
    requiredCurrency: str = "USD"


class HolidayTravelStyleSearchRequest(BaseModel):
    travelStyle: str
    fromDate: str
    toDate: str
    requiredCurrency: str = "USD"
    minPrice: Optional[float] = None
    maxPrice: Optional[float] = None


class HolidayLeadPassenger(BaseModel):
    title: str
    firstName: str
    lastName: str
    email: str
    address: str
    dob: str
    gender: str
    telephone: str
    countryCode: str
    requiredCurrency: str = "USD"


class HolidayBookingRequest(BaseModel):
    referenceCode: str
    leadPassenger: HolidayLeadPassenger
