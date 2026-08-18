"""Auth + shape coverage for the admin dashboard endpoints."""

from __future__ import annotations


async def test_summary_requires_auth(client):
    resp = await client.get("/api/v1/admin/dashboard/summary")
    assert resp.status_code == 401


async def test_summary_rejects_invalid_token(client):
    resp = await client.get(
        "/api/v1/admin/dashboard/summary",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert resp.status_code == 401


async def test_summary_rejects_non_staff_token(client, customer_token):
    resp = await client.get(
        "/api/v1/admin/dashboard/summary",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert resp.status_code == 403


async def test_summary_returns_expected_shape_for_staff(client, staff_token):
    resp = await client.get(
        "/api/v1/admin/dashboard/summary",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    for key in ("total_customers", "total_itinerary", "total_staff", "new_customers"):
        assert key in body
        kpi = body[key]
        assert "value" in kpi
        assert "change_pct" in kpi
        assert "is_positive" in kpi
        assert "sparkline" in kpi


async def test_summary_reflects_seeded_metrics(client, staff_token, db):
    import uuid
    from datetime import datetime, timezone

    from app.models.dashboard_metric_daily import DashboardMetricDaily

    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    today = datetime.now(timezone.utc).date()
    async with db() as session:
        session.add(
            DashboardMetricDaily(
                tenant_id=tenant_id,
                metric_date=today,
                metric_key="customers_total",
                value=7,
            )
        )
        await session.commit()

    resp = await client.get(
        "/api/v1/admin/dashboard/summary",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["total_customers"]["value"] == 7


async def test_popular_destinations_requires_staff(client):
    resp = await client.get("/api/v1/admin/dashboard/popular-destinations")
    assert resp.status_code == 401


async def test_popular_destinations_empty_shape(client, staff_token):
    resp = await client.get(
        "/api/v1/admin/dashboard/popular-destinations",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"total": 0, "segments": []}
