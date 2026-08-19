"""Request/response models for the TravelNext Cruise router.

Like the other TravelNext products (transfers, rail, events, holidays), the
Cruise (cruisev2) API returns numeric-looking fields (ids, prices, durations)
as JSON strings rather than numbers, so the response models mirror that with
`str` typing. The provider's own docs are inconsistent/truncated in a few
places (noted inline below) — where the parameter table and the sample
response disagree, the sample response is treated as the source of truth,
and undocumented-but-plausible fields are modeled as `Optional[str] = None`
rather than required.

The `ports` and `shipData` fields on a search/details result are documented
as deeply nested structures whose real shape is unclear from the truncated
provider docs, so they're modeled permissively as `Optional[list[dict]] =
None` rather than speculatively typed.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------

class CruiseSearchRequest(BaseModel):
    startDate: str
    endDate: str
    toNights: str
    destinationPortIds: List[str]
    cruiseLines: List[str]
    cruiseShipsIds: List[str]
    embarkationPortsIds: List[str]
    portOfCallIds: List[str]
    NumberOfCabin: str
    searchType: str
    fromNights: Optional[str] = None
    marketingCode: Optional[str] = None
    vendorSailingIdentifier: Optional[str] = None
    fromPrice: Optional[str] = None
    toPrice: Optional[str] = None


class CruiseSailingPrice(BaseModel):
    id: Optional[str] = None
    SailingID: Optional[str] = None
    SailingPriceID: Optional[str] = None
    MarketName: Optional[str] = None
    CurrencyCode: Optional[str] = None
    RateCode: Optional[str] = None
    CategoryCode: Optional[str] = None
    AdultFare: Optional[str] = None
    NCCF: Optional[str] = None
    IsNCCFIncluded: Optional[str] = None
    Tax: Optional[str] = None
    IsTaxIncluded: Optional[str] = None
    CabinCategory: Optional[str] = None
    CabinPriceDesc: Optional[str] = None

    class Config:
        extra = "allow"


class CruiseSailing(BaseModel):
    title: Optional[str] = None
    cruise_sailing_name: Optional[str] = None
    SailingID: Optional[str] = None
    SailingPlanID: Optional[str] = None
    SailingPlanCode: Optional[str] = None
    MarketName: Optional[str] = None
    ShipID: Optional[str] = None
    ShipName: Optional[str] = None
    DepartureDate: Optional[str] = None
    Duration: Optional[str] = None
    PackageID: Optional[str] = None
    SailingName: Optional[str] = None
    DestinationID: Optional[str] = None
    DeparturePortCode: Optional[str] = None
    DeparturePortID: Optional[str] = None
    ReturnPortCode: Optional[str] = None
    ReturnPortID: Optional[str] = None
    PackageTypeID: Optional[str] = None
    TourOnly: Optional[str] = None
    Segment: Optional[str] = None
    No_of_sailings: Optional[str] = None
    session_id: Optional[str] = None
    sailing_prices: Optional[List[CruiseSailingPrice]] = None
    # Deeply nested and inconsistently documented by the provider — kept as
    # permissive passthrough rather than speculatively typed.
    ports: Optional[list[dict]] = None
    shipData: Optional[list[dict]] = None

    class Config:
        extra = "allow"


# --------------------------------------------------------------------------
# Details
# --------------------------------------------------------------------------

class CruiseDetailsRequest(BaseModel):
    session_id: str
    id: str


# Details returns the same shape as a single search result item.
CruiseDetailsResponse = CruiseSailing


# --------------------------------------------------------------------------
# Reference data (all auth-only requests)
# --------------------------------------------------------------------------

class CruiseDestination(BaseModel):
    portId: Optional[str] = None
    portCode: Optional[str] = None
    portName: Optional[str] = None
    # Mentioned in the parameter table but absent from the sample response.
    referenceid: Optional[str] = None


class CruiseLine(BaseModel):
    cruise_sailing_name: Optional[str] = None
    # Mentioned in the docs but absent from the sample response.
    cruise_type: Optional[str] = None
    referenceid: Optional[str] = None


class CruiseShip(BaseModel):
    ShipID: Optional[str] = None
    Name: Optional[str] = None
    # Mentioned in the parameter table but absent from the sample response.
    portCode: Optional[str] = None


class CruiseMarket(BaseModel):
    # Docs use "Name" in the parameter table but the sample response uses
    # "MarketName" — trusting the sample as the real field name.
    MarketName: Optional[str] = None


class CruiseVendor(BaseModel):
    VendorID: Optional[str] = None
    Name: Optional[str] = None
    Code: Optional[str] = None
    ShortName: Optional[str] = None
