"""Booking lifecycle tests for the affiliate service.

Covers the two ways a Booking row comes into existence:

1. The customer-facing API (POST /api/v1/bookings) — creates a PENDING
   booking, idempotent on (tenant, customer, trip_id, package_id).
2. The event-driven consumer (app/consumers/booking_consumer.py) — creates a
   CONFIRMED booking directly from a TRIP_BOOKED domain event.

NOTE ON SCOPE: as of this writing, `app/routers/bookings.py` exposes only
GET (list) and POST (create) — there is no endpoint to transition a booking's
status (e.g. cancel, complete, refund) and no state-machine/transition
validation exists anywhere in the affiliate service. BookingStatus.CANCELLED
and BookingStatus.COMPLETED are defined on the enum but nothing in the
codebase ever sets them. So "invalid transition rejected" cannot be tested
against real code; see test_no_status_transition_endpoint_exists below, which
documents that gap instead of inventing a transition contract.
"""
from __future__ import annotations

import asyncio
import uuid

import pytest

from conftest import TENANT_ID, make_token

pytestmark = pytest.mark.asyncio


async def _fetch_booking(session_factory, booking_id: uuid.UUID):
    from app.models.bookings import Booking

    async with session_factory() as session:
        return await session.get(Booking, booking_id)


# --------------------------------------------------------------------------
# POST /api/v1/bookings — creation
# --------------------------------------------------------------------------


async def test_create_booking_requires_trip_or_package(client, settings):
    token = make_token(settings, str(uuid.uuid4()), "traveler@example.com")
    resp = await client.post(
        "/api/v1/bookings",
        json={"amount": "100.00", "currency": "USD"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_create_booking_persists_as_pending(client, settings, session_factory):
    customer_id = str(uuid.uuid4())
    token = make_token(settings, customer_id, "traveler@example.com")
    trip_id = str(uuid.uuid4())

    resp = await client.post(
        "/api/v1/bookings",
        json={"tripId": trip_id, "amount": "249.99", "currency": "USD"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"

    booking = await _fetch_booking(session_factory, uuid.UUID(body["bookingId"]))
    assert booking is not None
    assert booking.status.value == "pending"
    assert str(booking.customer_id) == customer_id
    assert str(booking.tenant_id) == TENANT_ID
    assert str(booking.trip_id) == trip_id
    assert float(booking.amount) == 249.99


async def test_create_booking_accepts_package_id_without_trip(client, settings):
    token = make_token(settings, str(uuid.uuid4()), "traveler@example.com")
    resp = await client.post(
        "/api/v1/bookings",
        json={"packageId": "pkg-123", "amount": "50", "currency": "USD"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["packageId"] == "pkg-123"


async def test_create_booking_rejects_malformed_currency(client, settings):
    token = make_token(settings, str(uuid.uuid4()), "traveler@example.com")
    resp = await client.post(
        "/api/v1/bookings",
        json={"packageId": "pkg-1", "amount": "10", "currency": "FAKE_CODE"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_create_booking_requires_auth(client):
    resp = await client.post("/api/v1/bookings", json={"packageId": "pkg-1"})
    assert resp.status_code in (401, 403)


# --------------------------------------------------------------------------
# Idempotency — a second POST for the same (customer, tenant, trip/package)
# returns the existing booking rather than creating a duplicate row.
# --------------------------------------------------------------------------


async def test_create_booking_is_idempotent_on_trip_id(client, settings, session_factory):
    from sqlalchemy import select
    from app.models.bookings import Booking

    customer_id = str(uuid.uuid4())
    token = make_token(settings, customer_id, "traveler@example.com")
    trip_id = str(uuid.uuid4())
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"tripId": trip_id, "amount": "100.00", "currency": "USD"}

    first = await client.post("/api/v1/bookings", json=payload, headers=headers)
    second = await client.post("/api/v1/bookings", json=payload, headers=headers)

    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["bookingId"] == second.json()["bookingId"]
    assert second.json()["message"] == "Booking already exists"

    async with session_factory() as session:
        rows = (
            (await session.execute(select(Booking).where(Booking.trip_id == uuid.UUID(trip_id))))
            .scalars()
            .all()
        )
    assert len(rows) == 1


async def test_different_customers_get_separate_bookings_for_same_trip(client, settings):
    # Same trip_id, different customers: should NOT be treated as the same
    # idempotency key (trip_id alone is not unique across customers).
    trip_id = str(uuid.uuid4())
    token_a = make_token(settings, str(uuid.uuid4()), "a@example.com")
    token_b = make_token(settings, str(uuid.uuid4()), "b@example.com")
    payload = {"tripId": trip_id, "amount": "100.00", "currency": "USD"}

    resp_a = await client.post(
        "/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {token_a}"}
    )
    resp_b = await client.post(
        "/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {token_b}"}
    )
    assert resp_a.json()["bookingId"] != resp_b.json()["bookingId"]


# --------------------------------------------------------------------------
# GET /api/v1/bookings — listing is scoped to the authenticated customer
# --------------------------------------------------------------------------


async def test_list_bookings_only_returns_own_bookings(client, settings):
    customer_a = str(uuid.uuid4())
    customer_b = str(uuid.uuid4())
    token_a = make_token(settings, customer_a, "a@example.com")
    token_b = make_token(settings, customer_b, "b@example.com")

    await client.post(
        "/api/v1/bookings",
        json={"packageId": "pkg-a", "amount": "10", "currency": "USD"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    await client.post(
        "/api/v1/bookings",
        json={"packageId": "pkg-b", "amount": "20", "currency": "USD"},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    resp = await client.get("/api/v1/bookings", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["packageId"] == "pkg-a"


# --------------------------------------------------------------------------
# Consumer-driven confirmation: TRIP_BOOKED event -> CONFIRMED booking.
# --------------------------------------------------------------------------


async def test_trip_booked_event_creates_confirmed_booking(session_factory, redis):
    from sqlalchemy import select
    from shared.events import DomainEvent, EventType, STREAM_AFFILIATE
    from shared.redis_client import emit_event
    from app.consumers.booking_consumer import start_booking_consumer
    from app.models.bookings import Booking

    consumer_task = asyncio.create_task(start_booking_consumer(redis, session_factory))
    try:
        # Give the consumer a moment to create its consumer group before we
        # publish — xgroup_create defaults to reading only new ("$") entries.
        await asyncio.sleep(0.2)

        customer_id = str(uuid.uuid4())
        trip_id = str(uuid.uuid4())
        event = DomainEvent(
            event_type=EventType.TRIP_BOOKED,
            subject_id=trip_id,
            tenant_id=TENANT_ID,
            actor_user_id=customer_id,
            payload={
                "trip_id": trip_id,
                "package_id": None,
                "customer_id": customer_id,
                "amount": 899.5,
                "currency": "EUR",
            },
        )
        await emit_event(redis, STREAM_AFFILIATE, event)

        booking = None
        for _ in range(40):  # poll up to ~2s
            async with session_factory() as session:
                booking = (
                    await session.execute(select(Booking).where(Booking.trip_id == uuid.UUID(trip_id)))
                ).scalar_one_or_none()
            if booking is not None:
                break
            await asyncio.sleep(0.05)

        assert booking is not None, "consumer did not create a booking from the TRIP_BOOKED event"
        assert booking.status.value == "confirmed"
        assert str(booking.customer_id) == customer_id
        assert float(booking.amount) == 899.5
        assert booking.currency == "EUR"
    finally:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass


async def test_trip_booked_event_is_idempotent_against_existing_booking(session_factory, redis):
    """A duplicate TRIP_BOOKED delivery (at-least-once semantics) must not
    create a second booking row for the same trip/customer/tenant."""
    from sqlalchemy import select
    from shared.events import DomainEvent, EventType, STREAM_AFFILIATE
    from shared.redis_client import emit_event
    from app.consumers.booking_consumer import start_booking_consumer
    from app.models.bookings import Booking

    consumer_task = asyncio.create_task(start_booking_consumer(redis, session_factory))
    try:
        await asyncio.sleep(0.2)

        customer_id = str(uuid.uuid4())
        trip_id = str(uuid.uuid4())

        def make_event():
            return DomainEvent(
                event_type=EventType.TRIP_BOOKED,
                subject_id=trip_id,
                tenant_id=TENANT_ID,
                actor_user_id=customer_id,
                payload={
                    "trip_id": trip_id,
                    "package_id": None,
                    "customer_id": customer_id,
                    "amount": 100.0,
                    "currency": "USD",
                },
            )

        await emit_event(redis, STREAM_AFFILIATE, make_event())
        await emit_event(redis, STREAM_AFFILIATE, make_event())

        await asyncio.sleep(1.0)  # let the consumer drain both messages

        async with session_factory() as session:
            rows = (
                await session.execute(select(Booking).where(Booking.trip_id == uuid.UUID(trip_id)))
            ).scalars().all()
        assert len(rows) == 1
    finally:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass


# --------------------------------------------------------------------------
# Documenting the missing status-transition surface (see module docstring).
# --------------------------------------------------------------------------


async def test_no_status_transition_endpoint_exists(client, settings):
    """There is no PATCH/PUT/DELETE on /api/v1/bookings/{id} in this codebase
    — booking status can only ever be PENDING (via POST) or CONFIRMED (via the
    consumer). Cancel/refund/complete transitions described conceptually by
    the BookingStatus enum have no implementation or validation to test.
    This test pins that fact so it's visible if/when the surface changes."""
    customer_id = str(uuid.uuid4())
    token = make_token(settings, customer_id, "traveler@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    create = await client.post(
        "/api/v1/bookings",
        json={"packageId": "pkg-x", "amount": "10", "currency": "USD"},
        headers=headers,
    )
    booking_id = create.json()["bookingId"]

    patch_resp = await client.patch(
        f"/api/v1/bookings/{booking_id}", json={"status": "cancelled"}, headers=headers
    )
    assert patch_resp.status_code in (404, 405)
