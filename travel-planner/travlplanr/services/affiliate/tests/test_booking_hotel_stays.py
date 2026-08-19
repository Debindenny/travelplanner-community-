"""Booking hotel-stays persistence — PUT /bookings/{id}/hotel-stays.

Mirrors the passengers/flight-segments replace-semantics: each call deletes
all existing BookingHotelStay rows for the booking and reinserts the given
list, matching the frontend's "swappedHotels" customizations flow (see
travlplanr-hotel-api-spec memory notes on checkout-success wiring).
"""
from __future__ import annotations

import uuid

import pytest

from conftest import make_token

pytestmark = pytest.mark.asyncio


async def _create_booking(client, token, trip_id=None, package_id=None):
    resp = await client.post(
        "/api/v1/bookings",
        json={"tripId": trip_id, "packageId": package_id, "amount": "500.00", "currency": "USD"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    return resp.json()["bookingId"]


async def test_save_hotel_stays_persists_and_returns_in_detail(client, settings):
    customer_id = str(uuid.uuid4())
    token = make_token(settings, customer_id, "traveler@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    booking_id = await _create_booking(client, token, trip_id=str(uuid.uuid4()))

    resp = await client.put(
        f"/api/v1/bookings/{booking_id}/hotel-stays",
        json={
            "stays": [
                {
                    "id": "H1",
                    "name": "Canal House Hotel",
                    "rating": 4.5,
                    "location": "Amsterdam",
                    "city": "Amsterdam",
                    "distance": "1.2 km",
                    "maxGuests": 2,
                    "roomType": "Deluxe Double",
                    "bedPreference": "Queen",
                    "cancellation": "Free cancellation",
                    "parking": "Free parking",
                    "mealPlan": "Breakfast included",
                    "amenities": ["WiFi", "Pool"],
                    "price": 145.50,
                    "taxes": 12.30,
                    "currency": "USD",
                    "imageUrl": "https://example.com/h.jpg",
                    "provider": "travelnext",
                }
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["count"] == 1

    detail = await client.get(f"/api/v1/bookings/{booking_id}", headers=headers)
    assert detail.status_code == 200
    stays = detail.json()["hotelStays"]
    assert len(stays) == 1
    stay = stays[0]
    assert stay["name"] == "Canal House Hotel"
    assert stay["rating"] == 4.5
    assert stay["amenities"] == ["WiFi", "Pool"]
    assert stay["price"] == 145.50
    assert stay["provider"] == "travelnext"


async def test_save_hotel_stays_replaces_previous_list(client, settings):
    customer_id = str(uuid.uuid4())
    token = make_token(settings, customer_id, "traveler@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    booking_id = await _create_booking(client, token, package_id="pkg-hotel")

    await client.put(
        f"/api/v1/bookings/{booking_id}/hotel-stays",
        json={"stays": [{"name": "First Hotel", "price": 100}]},
        headers=headers,
    )
    resp = await client.put(
        f"/api/v1/bookings/{booking_id}/hotel-stays",
        json={"stays": [{"name": "Second Hotel", "price": 200}]},
        headers=headers,
    )
    assert resp.status_code == 200

    detail = await client.get(f"/api/v1/bookings/{booking_id}", headers=headers)
    stays = detail.json()["hotelStays"]
    assert len(stays) == 1
    assert stays[0]["name"] == "Second Hotel"


async def test_save_hotel_stays_requires_owned_booking(client, settings):
    owner_token = make_token(settings, str(uuid.uuid4()), "owner@example.com")
    other_token = make_token(settings, str(uuid.uuid4()), "other@example.com")
    booking_id = await _create_booking(client, owner_token, trip_id=str(uuid.uuid4()))

    resp = await client.put(
        f"/api/v1/bookings/{booking_id}/hotel-stays",
        json={"stays": [{"name": "Hotel"}]},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404
