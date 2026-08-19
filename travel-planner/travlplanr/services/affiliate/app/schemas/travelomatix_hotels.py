"""Request models for the Travelomatix Hotels router."""

from typing import List, Optional

from pydantic import BaseModel, Field


class RoomGuest(BaseModel):
    NoOfAdults: int = 2
    NoOfChild: int = 0
    ChildAge: List[str] = Field(default_factory=list)


class HotelSearchRequest(BaseModel):
    CheckInDate: str  # dd-mm-yyyy
    NoOfNights: int = 1
    CountryCode: str
    CityId: int
    GuestNationality: str = "IN"
    NoOfRooms: int = 1
    RoomGuests: List[RoomGuest]


class ResultTokenRequest(BaseModel):
    ResultToken: str


class BlockRoomRequest(BaseModel):
    ResultToken: str
    RoomUniqueId: List[str]


class PassengerDetail(BaseModel):
    Title: str = "Mr"
    FirstName: str
    MiddleName: str = ""
    LastName: str
    Phoneno: str = "0000000000"
    Email: str
    PaxType: str = "1"
    LeadPassenger: bool = True
    Age: int = 30


class RoomDetail(BaseModel):
    PassengerDetails: List[PassengerDetail]


class CommitBookingRequest(BaseModel):
    ResultToken: str
    BlockRoomId: str
    AppReference: str
    RoomDetails: List[RoomDetail]


class HotelBookingRequest(BaseModel):
    """Convenience book: RoomList (if needed) → BlockRoom → CommitBooking."""

    ResultToken: str
    RoomUniqueId: Optional[List[str]] = None
    AppReference: Optional[str] = None
    customerEmail: str
    customerPhone: str = "0000000000"
    title: str = "Mr"
    firstName: str
    lastName: str
    PassengerDetails: Optional[List[PassengerDetail]] = None


class AppReferenceRequest(BaseModel):
    AppReference: str


class CancellationRefundRequest(BaseModel):
    ChangeRequestId: str
    AppReference: str
