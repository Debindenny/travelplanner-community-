"""Auth + shape coverage for the internal (service-to-service) stats endpoints."""

from __future__ import annotations

import uuid

from conftest import TENANT_ID


async def test_customer_stats_requires_internal_secret(client):
    resp = await client.get(
        f"/api/v1/internal/stats/customer/{uuid.uuid4()}", params={"tenant_id": TENANT_ID}
    )
    assert resp.status_code == 403


async def test_customer_stats_rejects_wrong_secret(client):
    resp = await client.get(
        f"/api/v1/internal/stats/customer/{uuid.uuid4()}",
        params={"tenant_id": TENANT_ID},
        headers={"X-Internal-Secret": "wrong-secret"},
    )
    assert resp.status_code == 403


async def test_customer_stats_defaults_when_no_data(client, settings):
    customer_id = str(uuid.uuid4())
    resp = await client.get(
        f"/api/v1/internal/stats/customer/{customer_id}",
        params={"tenant_id": TENANT_ID},
        headers={"X-Internal-Secret": settings.internal_api_secret},
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "cancelled": 0,
        "itineraries": 0,
        "booked": 0,
        "pending": 0,
        "created": 0,
        "ltv": 0.0,
        # `SELECT sum(...)` with no matching rows still returns one row of NULLs
        # (not None), so get_customer_stats falls through to the segment
        # heuristic rather than its `if not row` "New" branch: 0 bookings, 0
        # cancellations -> "Prospect".
        "segment": "Prospect",
    }


async def test_customer_stats_aggregates_trip_status_counts(client, settings, db):
    from app.models.trip_status_counts import TripStatusCount

    customer_id = uuid.uuid4()
    tenant_id = uuid.UUID(TENANT_ID)
    async with db() as session:
        session.add(
            TripStatusCount(
                tenant_id=tenant_id,
                customer_id=customer_id,
                destination="Paris",
                count_created=1,
                count_booked=3,
            )
        )
        session.add(
            TripStatusCount(
                tenant_id=tenant_id,
                customer_id=customer_id,
                destination="Tokyo",
                count_pending=2,
            )
        )
        await session.commit()

    resp = await client.get(
        f"/api/v1/internal/stats/customer/{customer_id}",
        params={"tenant_id": TENANT_ID},
        headers={"X-Internal-Secret": settings.internal_api_secret},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 1
    assert body["booked"] == 3
    assert body["pending"] == 2
    assert body["itineraries"] == 6
    assert body["segment"] == "High Value"  # booked >= 3


async def test_staff_stats_defaults_when_no_data(client, settings):
    staff_id = str(uuid.uuid4())
    resp = await client.get(
        f"/api/v1/internal/stats/staff/{staff_id}",
        params={"tenant_id": TENANT_ID},
        headers={"X-Internal-Secret": settings.internal_api_secret},
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "customers": 0,
        "itineraries": 0,
        "booked": 0,
        "pending": 0,
        "created": 0,
    }
