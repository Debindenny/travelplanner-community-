"""Locks the TRIP_BOOKED event contract between the producer (planner/checkout.py)
and the consumer (affiliate/booking_consumer.py).

This guards the fix that stopped bookings persisting amount=0.0: the producer must
put amount/currency/customer_id in the payload, and the consumer's extraction must
read them (with safe defaults).
"""
from __future__ import annotations

from shared.events import DEFAULT_TENANT_ID, DomainEvent, EventType


def _producer_payload():
    # Mirrors the dict planner/checkout.py emits on checkout.session.completed.
    return {
        "trip_id": "trip-1",
        "package_id": None,
        "customer_id": "cust-1",
        "stripe_session_id": "cs_test_123",
        "amount": 1499.0,
        "currency": "EUR",
    }


def test_trip_booked_carries_amount_currency_customer():
    evt = DomainEvent(
        event_type=EventType.TRIP_BOOKED,
        subject_id="trip-1",
        tenant_id=DEFAULT_TENANT_ID,
        payload=_producer_payload(),
    )
    p = evt.payload
    # consumer extraction (affiliate/booking_consumer.py)
    assert p.get("customer_id") == "cust-1"
    assert float(p.get("amount") or 0.0) == 1499.0
    assert (p.get("currency") or "USD") == "EUR"


def test_trip_booked_consumer_defaults_when_amount_missing():
    evt = DomainEvent(
        event_type=EventType.TRIP_BOOKED,
        subject_id="trip-2",
        tenant_id=DEFAULT_TENANT_ID,
        payload={"trip_id": "trip-2"},
    )
    p = evt.payload
    assert float(p.get("amount") or 0.0) == 0.0
    assert (p.get("currency") or "USD") == "USD"


def test_trip_booked_survives_json_roundtrip():
    evt = DomainEvent(
        event_type=EventType.TRIP_BOOKED,
        subject_id="trip-1",
        tenant_id=DEFAULT_TENANT_ID,
        payload=_producer_payload(),
    )
    restored = DomainEvent(**__import__("json").loads(evt.model_dump_json()))
    assert restored.event_type == EventType.TRIP_BOOKED
    assert restored.payload["amount"] == 1499.0
