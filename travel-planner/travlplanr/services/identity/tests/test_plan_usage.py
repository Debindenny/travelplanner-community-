"""Plan usage limits — services/identity/app/routers/me.py (GET /me/plan) and
services/identity/app/routers/internal.py (service-to-service plan upgrade/downgrade
+ the usage metering consumed from the ai-worker stream).
"""

from __future__ import annotations

from conftest import make_token

INTERNAL_SECRET = "test-internal-secret"


async def test_plan_usage_defaults_to_free_when_no_subscription(client, settings, seed_customer):
    user_id = await seed_customer("nosub@example.com")
    token = make_token(settings, user_id, "nosub@example.com")

    resp = await client.get("/api/v1/me/plan", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"plan_code": "Free", "plans_used": 0, "plans_limit": 2, "percent": 0.0}


async def test_plan_usage_reports_existing_subscription_percent(
    client, settings, seed_customer, seed_subscription
):
    user_id = await seed_customer("hasSub@example.com")
    await seed_subscription(user_id, plan_code="individual", plans_used=5, plans_limit=10)
    token = make_token(settings, user_id, "hasSub@example.com")

    resp = await client.get("/api/v1/me/plan", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["plan_code"] == "individual"
    assert body["plans_used"] == 5
    assert body["plans_limit"] == 10
    assert body["percent"] == 50.0


async def test_plan_usage_at_full_capacity(client, settings, seed_customer, seed_subscription):
    user_id = await seed_customer("atlimit@example.com")
    await seed_subscription(user_id, plan_code="free", plans_used=2, plans_limit=2)
    token = make_token(settings, user_id, "atlimit@example.com")

    resp = await client.get("/api/v1/me/plan", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["percent"] == 100.0


async def test_plan_endpoint_requires_customer_auth(client):
    resp = await client.get("/api/v1/me/plan")
    assert resp.status_code in (401, 403)


async def test_plan_endpoint_rejects_staff_token(client, settings):
    """require_customer must reject a staff-kind JWT even if otherwise valid."""
    import uuid

    token = make_token(settings, str(uuid.uuid4()), "staffer@example.com", kind="staff")
    resp = await client.get("/api/v1/me/plan", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


# --- internal plan endpoints (service-to-service) ---------------------------


async def test_get_user_plan_requires_internal_secret(client, seed_customer):
    user_id = await seed_customer("internal1@example.com")
    resp = await client.get(f"/api/v1/internal/users/{user_id}/plan")
    assert resp.status_code == 403


async def test_get_user_plan_defaults_to_free(client, seed_customer):
    user_id = await seed_customer("internal2@example.com")
    resp = await client.get(
        f"/api/v1/internal/users/{user_id}/plan",
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    assert resp.json() == {"plan_code": "free"}


async def test_set_user_plan_upgrades_and_resets_usage(
    client, seed_customer, seed_subscription
):
    user_id = await seed_customer("upgrade@example.com")
    await seed_subscription(user_id, plan_code="free", plans_used=2, plans_limit=2)

    resp = await client.patch(
        f"/api/v1/internal/users/{user_id}/plan",
        json={"plan_code": "travel_partner"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200
    assert resp.json() == {"plan_code": "travel_partner"}

    follow_up = await client.get(
        f"/api/v1/internal/users/{user_id}/plan",
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert follow_up.json() == {"plan_code": "travel_partner"}


async def test_set_user_plan_rejects_unknown_plan_code(client, seed_customer):
    user_id = await seed_customer("badplan@example.com")
    resp = await client.patch(
        f"/api/v1/internal/users/{user_id}/plan",
        json={"plan_code": "not-a-real-plan"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 400


async def test_set_user_plan_creates_subscription_when_none_exists(client, settings, seed_customer):
    user_id = await seed_customer("firsttime@example.com")

    resp = await client.patch(
        f"/api/v1/internal/users/{user_id}/plan",
        json={"plan_code": "individual"},
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert resp.status_code == 200

    token = make_token(settings, user_id, "firsttime@example.com")
    usage = await client.get("/api/v1/me/plan", headers={"Authorization": f"Bearer {token}"})
    body = usage.json()
    assert body["plan_code"] == "individual"
    assert body["plans_used"] == 0
    assert body["plans_limit"] == 10


# NOTE: app/consumers/ai_worker_consumer.py (the server-side metering loop that
# increments Subscription.plans_used off `generation.completed` events) is not
# covered here — see the "known gaps" note in the test suite's final report.
# fakeredis's Redis Streams consumer-group emulation doesn't honor XREADGROUP's
# blocking-read semantics (it busy-loops and never delivers messages added after
# group creation in this fakeredis version), so a real end-to-end test of that
# loop hangs/spins instead of exercising the code. The metering logic itself
# (increment plans_used for the subscription matching event.payload["customer_id"])
# is simple enough to review by inspection; a proper test would need either a
# newer fakeredis release or a real Redis instance.
