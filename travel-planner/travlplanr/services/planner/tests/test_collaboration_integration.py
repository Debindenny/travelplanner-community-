"""Integration tests for the Collaborative Itineraries feature.

These drive the real FastAPI routers (trips + collaboration) over ASGI against a
real Postgres schema and a fake Redis, with the cross-service identity lookup
stubbed. Fixtures live in conftest.py.

The whole module skips cleanly unless the integration deps are installed AND
``PLANNER_TEST_DATABASE_URL`` points at a throwaway Postgres database — so the
minimal-dependency unit-test CI stays green. To run:

    PLANNER_TEST_DATABASE_URL=postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_test \\
        pytest services/planner/tests/test_collaboration_integration.py -q

Covered: invite -> accept, the role permission matrix, expense add -> settle,
auto-claim of pending invites on registration, and optimistic section-version
conflicts (HTTP 409).
"""

from __future__ import annotations

import os
import uuid

import pytest

# Skip the entire module when the integration prerequisites are absent.
pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")
pytest.importorskip("httpx")
pytest.importorskip("fakeredis")
if not os.getenv("PLANNER_TEST_DATABASE_URL"):
    pytest.skip(
        "PLANNER_TEST_DATABASE_URL not set; skipping DB integration tests",
        allow_module_level=True,
    )

from conftest import make_token  # noqa: E402  (after the skip guards)

pytestmark = pytest.mark.asyncio


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_invite_accept_flow(client, seed_trip, settings):
    """Owner invites a viewer by email; viewer accepts and becomes active."""
    owner_id, viewer_id = str(uuid.uuid4()), str(uuid.uuid4())
    o_tok = make_token(settings, owner_id, "owner@example.com")
    v_tok = make_token(settings, viewer_id, "viewer@example.com")

    trip_id = await seed_trip(owner_id, "owner@example.com")

    # Owner invites the viewer.
    resp = await client.post(
        f"/api/v1/trips/{trip_id}/invites",
        headers=_auth(o_tok),
        json={"email": "viewer@example.com", "role": "viewer"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "invited"
    token = body["token"]

    # Viewer accepts (AcceptBody is optional -> send {}).
    resp = await client.post(
        f"/api/v1/trips/invites/{token}/accept",
        headers=_auth(v_tok),
        json={},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "viewer"

    # Viewer now appears as an active collaborator.
    resp = await client.get(
        f"/api/v1/trips/{trip_id}/collaborators", headers=_auth(o_tok)
    )
    assert resp.status_code == 200, resp.text
    collabs = resp.json()
    assert any(c["user_id"] == viewer_id and c["status"] == "active" for c in collabs)


async def test_permission_matrix(client, seed_trip, settings):
    """viewer cannot edit/invite; editor can edit."""
    owner_id, viewer_id, editor_id = (str(uuid.uuid4()) for _ in range(3))
    o_tok = make_token(settings, owner_id, "owner@example.com")
    v_tok = make_token(settings, viewer_id, "viewer@example.com")
    e_tok = make_token(settings, editor_id, "editor@example.com")

    trip_id = await seed_trip(owner_id, "owner@example.com")

    # Invite + accept a viewer and an editor.
    for email, role, tok in (
        ("viewer@example.com", "viewer", v_tok),
        ("editor@example.com", "editor", e_tok),
    ):
        r = await client.post(
            f"/api/v1/trips/{trip_id}/invites",
            headers=_auth(o_tok),
            json={"email": email, "role": role},
        )
        assert r.status_code == 201, r.text
        token = r.json()["token"]
        r = await client.post(
            f"/api/v1/trips/invites/{token}/accept", headers=_auth(tok), json={}
        )
        assert r.status_code == 200, r.text

    # Viewer cannot edit the itinerary.
    r = await client.put(
        f"/api/v1/trips/{trip_id}",
        headers=_auth(v_tok),
        json={"title": "Hijacked", "section_versions": {}},
    )
    assert r.status_code == 403, r.text

    # Editor can edit.
    r = await client.put(
        f"/api/v1/trips/{trip_id}",
        headers=_auth(e_tok),
        json={"title": "Editor Update", "section_versions": {}},
    )
    assert r.status_code == 200, r.text

    # Viewer cannot invite others.
    r = await client.post(
        f"/api/v1/trips/{trip_id}/invites",
        headers=_auth(v_tok),
        json={"email": "someone@example.com", "role": "viewer"},
    )
    assert r.status_code == 403, r.text


async def test_expense_settlement_flow(client, seed_trip, settings):
    """Confirm plan -> add an equal-split expense -> balances -> settle -> balances clear."""
    owner_id, editor_id = str(uuid.uuid4()), str(uuid.uuid4())
    o_tok = make_token(settings, owner_id, "owner@example.com")
    e_tok = make_token(settings, editor_id, "editor@example.com")

    trip_id = await seed_trip(owner_id, "owner@example.com")

    # Add an editor.
    r = await client.post(
        f"/api/v1/trips/{trip_id}/invites",
        headers=_auth(o_tok),
        json={"email": "editor@example.com", "role": "editor"},
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        f"/api/v1/trips/invites/{r.json()['token']}/accept",
        headers=_auth(e_tok),
        json={},
    )
    assert r.status_code == 200, r.text

    # Expenses require a confirmed plan.
    r = await client.post(f"/api/v1/trips/{trip_id}/confirm", headers=_auth(o_tok))
    assert r.status_code == 200, r.text

    # Owner pays $100 split equally between the two active members.
    r = await client.post(
        f"/api/v1/trips/{trip_id}/expenses",
        headers=_auth(o_tok),
        json={
            "description": "Dinner",
            "category": "food",
            "amount_cents": 10000,
            "currency": "USD",
            "paid_by": owner_id,
            "split_method": "equal",
        },
    )
    assert r.status_code == 201, r.text
    expense_id = r.json()["expense_id"]

    # Editor owes the owner 5000 cents.
    r = await client.get(
        f"/api/v1/trips/{trip_id}/expenses/balances", headers=_auth(o_tok)
    )
    assert r.status_code == 200, r.text
    settlements = r.json()["settlements"]
    assert any(
        s["from"] == editor_id and s["to"] == owner_id and s["amount_cents"] == 5000
        for s in settlements
    ), settlements

    # Settle the expense; balances clear.
    r = await client.post(
        f"/api/v1/trips/{trip_id}/expenses/{expense_id}/settle", headers=_auth(e_tok)
    )
    assert r.status_code == 200, r.text

    r = await client.get(
        f"/api/v1/trips/{trip_id}/expenses/balances", headers=_auth(o_tok)
    )
    assert r.status_code == 200, r.text
    assert r.json()["settlements"] == []


async def test_auto_claim_pending_invites(client, seed_trip, planner_app, settings):
    """A pending invite for an unregistered email is claimed when that user registers."""
    from app.consumers.identity_consumer import claim_pending_invites

    session_factory = planner_app[1]
    owner_id = str(uuid.uuid4())
    o_tok = make_token(settings, owner_id, "owner@example.com")
    trip_id = await seed_trip(owner_id, "owner@example.com")

    new_email = "newuser@example.com"
    new_user_id = str(uuid.uuid4())

    # Invite an unregistered email -> pending collaborator (user_id is null).
    r = await client.post(
        f"/api/v1/trips/{trip_id}/invites",
        headers=_auth(o_tok),
        json={"email": new_email, "role": "viewer"},
    )
    assert r.status_code == 201, r.text

    r = await client.get(f"/api/v1/trips/{trip_id}/collaborators", headers=_auth(o_tok))
    assert any(
        c["email"] == new_email and c["status"] == "pending" and c["user_id"] is None
        for c in r.json()
    ), r.json()

    # Simulate the identity CUSTOMER_CREATED handler running.
    claimed = await claim_pending_invites(
        session_factory, new_email, new_user_id, "New User"
    )
    assert claimed == 1

    # The collaborator is now active and linked to the new user.
    r = await client.get(f"/api/v1/trips/{trip_id}/collaborators", headers=_auth(o_tok))
    assert any(
        c["email"] == new_email
        and c["status"] == "active"
        and c["user_id"] == new_user_id
        for c in r.json()
    ), r.json()


async def test_section_versions_conflict(client, seed_trip, settings):
    """A stale section version on PUT returns HTTP 409."""
    owner_id = str(uuid.uuid4())
    o_tok = make_token(settings, owner_id, "owner@example.com")
    trip_id = await seed_trip(owner_id, "owner@example.com")

    # First edit at version 0 succeeds and bumps the section to version 1.
    r = await client.put(
        f"/api/v1/trips/{trip_id}",
        headers=_auth(o_tok),
        json={"title": "v1", "section_versions": {"accommodation": 0}},
    )
    assert r.status_code == 200, r.text

    # Re-submitting the now-stale version 0 conflicts.
    r = await client.put(
        f"/api/v1/trips/{trip_id}",
        headers=_auth(o_tok),
        json={"title": "stale", "section_versions": {"accommodation": 0}},
    )
    assert r.status_code == 409, r.text
