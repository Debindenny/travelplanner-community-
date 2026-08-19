"""Auth + behavior coverage for the admin notifications endpoints."""

from __future__ import annotations

import uuid


async def test_list_notifications_requires_auth(client):
    resp = await client.get("/api/v1/admin/notifications")
    assert resp.status_code == 401


async def test_list_notifications_rejects_non_staff(client, customer_token):
    resp = await client.get(
        "/api/v1/admin/notifications",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert resp.status_code == 403


async def test_list_notifications_empty_shape(client, staff_token):
    resp = await client.get(
        "/api/v1/admin/notifications",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"unread_count": 0, "items": [], "total": 0, "page": 1, "page_size": 20}


async def test_list_notifications_returns_seeded_row(client, staff_token, db):
    from app.models.notifications import AdminNotification

    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    async with db() as session:
        session.add(
            AdminNotification(
                tenant_id=tenant_id,
                type="trip_created",
                title="New Itinerary Created",
                message="A new itinerary for Paris was created.",
            )
        )
        await session.commit()

    resp = await client.get(
        "/api/v1/admin/notifications",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["unread_count"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["title"] == "New Itinerary Created"
    assert body["items"][0]["is_read"] is False


async def test_mark_read_flips_flag_and_drops_unread_count(client, staff_token, db):
    from app.models.notifications import AdminNotification

    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    notif_id = uuid.uuid4()
    async with db() as session:
        session.add(
            AdminNotification(
                id=notif_id,
                tenant_id=tenant_id,
                type="trip_created",
                title="New Itinerary Created",
                message="msg",
            )
        )
        await session.commit()

    resp = await client.post(
        f"/api/v1/admin/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    listing = await client.get(
        "/api/v1/admin/notifications",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    body = listing.json()
    assert body["unread_count"] == 0
    assert body["items"][0]["is_read"] is True


async def test_mark_read_unknown_id_returns_404(client, staff_token):
    resp = await client.post(
        f"/api/v1/admin/notifications/{uuid.uuid4()}/read",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert resp.status_code == 404
