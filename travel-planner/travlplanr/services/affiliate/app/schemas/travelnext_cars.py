"""Request models for the TravelNext Cars router. Nested provider-specific
structures (pax_details, payment_details, extra_services, airline_details)
are passed through as plain dicts — see travelnext_cars.py's module docstring
for why strict validation isn't worth it here.
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class CarSearchRequest(BaseModel):
    pickupId: str
    dropoffId: str
    pickupDate: str
    dropoffDate: str
    pickupTime: str = "10:00"
    dropoffTime: str = "10:00"
    driverAge: int = Field(default=30, ge=18, le=99)
    countryRes: str = "US"
    currency: str = "USD"
    pickupLocation: Optional[str] = None
    dropoffLocation: Optional[str] = None
    sorting: Optional[str] = None
    language: Optional[str] = None


class RentalConditionRequest(BaseModel):
    sessionId: str
    referenceId: str


class CarInsuranceRequest(BaseModel):
    sessionId: str
    referenceId: str
    firstName: str
    lastName: str


class CarBookRequest(BaseModel):
    sessionId: str
    referenceId: str
    noOfPassenger: str
    paxDetails: dict
    paymentDetails: dict
    clientReference: Optional[str] = None
    remark: Optional[str] = None
    insurancePlanId: Optional[str] = None
    extraServices: Optional[List[dict]] = None
    airlineDetails: Optional[dict] = None
