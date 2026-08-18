"""Request/response models for the TravelNext Transfers router.

The TravelNext Transfers (transfersv2) API is inconsistently typed — the
provider's own example payloads return numeric-looking fields (prices,
durations, distances) as JSON strings, not numbers. The response models
below mirror the example values as `str` and mark most nested fields
Optional, matching the response-schema conventions established in
`schemas/travelnext_events.py` and `schemas/travelnext_holidays.py`.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


# --------------------------------------------------------------------------
# Destinations
# --------------------------------------------------------------------------

class TransferDestinationSearchRequest(BaseModel):
    destination: str


class TransferDestination(BaseModel):
    id: Optional[str] = None
    longitude: Optional[str] = None
    latitude: Optional[str] = None
    place: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    locationCode: Optional[str] = None


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------

class TransferSearchRequest(BaseModel):
    search_currency: str = "USD"
    journey_type: str  # "OneWay" | "Return"
    pickup_location: str
    dropoff_location: str
    adults: int
    children: int = 0
    infants: int = 0

    # Airport legs
    arrival_date: Optional[str] = None
    arrival_time: Optional[str] = None
    departure_date: Optional[str] = None
    departure_time: Optional[str] = None

    # Accommodation-to-accommodation legs
    pickup_date: Optional[str] = None
    pickup_time: Optional[str] = None
    return_pickup_date: Optional[str] = None
    return_pickup_time: Optional[str] = None

    # Geo-code search
    pickup_location_code: Optional[str] = None
    pickup_location_type: Optional[str] = None
    dropoff_location_code: Optional[str] = None
    dropoff_location_type: Optional[str] = None

    sorting: Optional[str] = None


class TransferProductGeneral(BaseModel):
    productId: Optional[str] = None
    productName: Optional[str] = None
    vehicleType: Optional[str] = None
    vehicleClass: Optional[str] = None
    maxPassengers: Optional[str] = None
    maxLuggage: Optional[str] = None
    supplierName: Optional[str] = None
    duration: Optional[str] = None
    distance: Optional[str] = None
    image: Optional[str] = None
    description: Optional[str] = None
    bookingTypeId: Optional[str] = None
    cancellationPolicy: Optional[str] = None

    class Config:
        extra = "allow"


class TransferProductPricing(BaseModel):
    totalPrice: Optional[str] = None
    currency: Optional[str] = None
    basePrice: Optional[str] = None
    tax: Optional[str] = None

    class Config:
        extra = "allow"


class TransferProduct(BaseModel):
    general: Optional[TransferProductGeneral] = None
    pricing: Optional[TransferProductPricing] = None


class TransferTravelling(BaseModel):
    products: Optional[List[TransferProduct]] = None


class TransferSearchResponse(BaseModel):
    sessionId: Optional[str] = None
    searchResult: Optional[str] = None
    travelling: Optional[TransferTravelling] = None


# --------------------------------------------------------------------------
# Booking
# --------------------------------------------------------------------------

class TransferPaxDetails(BaseModel):
    lead_title: str
    lead_first_name: str
    lead_last_name: str
    phone: str
    email_id: str
    address01: str
    zip_code: str
    address02: Optional[str] = None


class TransferAccomodationDetails(BaseModel):
    accomodation_name: str
    accomodation_address01: str
    accomodation_address02: Optional[str] = None


class TransferPaymentDetails(BaseModel):
    card_type: Optional[str] = None
    card_no: Optional[str] = None
    card_cvv: Optional[str] = None
    expiry_date: Optional[str] = None
    card_holder_name: Optional[str] = None


class TransferAirlineDetails(BaseModel):
    airport_code: Optional[str] = None
    airline_code: Optional[str] = None
    airline_number: Optional[str] = None


class TransferExtraItem(BaseModel):
    code: str
    quantity: int


class TransferBookingRequest(BaseModel):
    session_id: str
    product_id: str
    booking_type_id: str
    client_reference: Optional[str] = None
    pax_details: TransferPaxDetails
    accomodation_details: TransferAccomodationDetails
    payment_details: Optional[TransferPaymentDetails] = None
    departure_airline: Optional[TransferAirlineDetails] = None
    arrival_airline: Optional[TransferAirlineDetails] = None
    extras: Optional[List[TransferExtraItem]] = None
    remark: Optional[str] = None


class TransferCompanyDetails(BaseModel):
    supplierName: Optional[str] = None
    contactNumber: Optional[str] = None
    email: Optional[str] = None

    class Config:
        extra = "allow"


class TransferLegDetails(BaseModel):
    transferDetails: Optional[dict] = None
    companyDetails: Optional[TransferCompanyDetails] = None


class TransferDescription(BaseModel):
    supplierName: Optional[str] = None
    outboundDetails: Optional[TransferLegDetails] = None
    returnDetails: Optional[TransferLegDetails] = None


class TransferBookingResponse(BaseModel):
    status: Optional[str] = None
    confirmationNumber: Optional[str] = None
    customerName: Optional[str] = None
    transferDescription: Optional[TransferDescription] = None


# --------------------------------------------------------------------------
# Cancel / booking details
# --------------------------------------------------------------------------

class TransferCancelRequest(BaseModel):
    confirmation_id: str


class TransferCancelResponse(BaseModel):
    status: Optional[str] = None
    confirmationNumber: Optional[str] = None
    customerName: Optional[str] = None


class TransferBookingDetailsRequest(BaseModel):
    confirmation_id: str


# Booking details returns the same shape as the booking confirmation response.
TransferBookingDetailsResponse = TransferBookingResponse
