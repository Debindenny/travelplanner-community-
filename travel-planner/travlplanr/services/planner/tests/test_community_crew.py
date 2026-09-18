"""Integration tests for crew matching (GET /api/v1/community/crew/match and
the join/leave/invite endpoints in app/routers/community_crew.py).

Drives the real community_crew router over ASGI against a real Postgres
schema and a fake Redis. Builds its own minimal app (trips are seeded
directly, not through the trips router) since the shared `planner_app`
fixture in conftest.py only mounts trips + collaboration.

    PLANNER_TEST_DATABASE_URL=postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_test \\
        pytest services/planner/tests/test_community_crew.py -q
"""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")
pytest.importorskip("httpx")
pytest.importorskip("fakeredis")
if not os.getenv("PLANNER_TEST_DATABASE_URL"):
    pytest.skip(
        "PLANNER_TEST_DATABASE_URL not set; skipping DB integration tests",
        allow_module_level=True,
    )

from conftest import TENANT_ID, TEST_DB_URL, make_token  # noqa: E402  (after the skip guards)

pytestmark = pytest.mark.asyncio


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def crew_app():
    from fastapi import FastAPI
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    import fakeredis.aioredis as fakeaioredis

    from shared.config import ServiceSettings
    from shared.database import Base
    from shared.middleware import install_middleware

    import app.models.trips  # noqa: F401
    import app.models.community  # noqa: F401
    from app.routers import community_crew

    settings = ServiceSettings(
        service_name="planner",
        database_url=TEST_DB_URL,
        jwt_secret="test-secret",
        environment="development",
    )

    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    redis = fakeaioredis.FakeRedis(decode_responses=True)

    application = FastAPI()
    install_middleware(application, settings)
    application.include_router(community_crew.router, prefix="/api/v1/community/crew")
    application.state.settings = settings
    application.state.session_factory = session_factory
    application.state.redis = redis

    try:
        yield application, session_factory, settings
    finally:
        await redis.aclose()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture
async def crew_client(crew_app):
    import httpx

    application = crew_app[0]
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def crew_settings(crew_app):
    return crew_app[2]


@pytest.fixture
def seed_crew_trip(crew_app):
    """Insert a trip directly (bypasses the trips router, which isn't mounted here)."""
    session_factory = crew_app[1]

    async def _seed(owner_id: str, owner_email: str, destination: str, start_date: str, end_date: str) -> str:
        from app.models.trips import Trip, TripStatus

        trip_id = uuid.uuid4()
        async with session_factory() as s:
            s.add(Trip(
                id=trip_id,
                tenant_id=uuid.UUID(TENANT_ID),
                customer_id=uuid.UUID(owner_id),
                customer_name=owner_email.split("@")[0],
                display_code="ITIN-TEST",
                title="Test Trip",
                destination=destination,
                start_date=start_date,
                end_date=end_date,
                travelers=1,
                status=TripStatus.READY,
                days=[],
                city_days=[],
            ))
            await s.commit()
        return str(trip_id)

    return _seed


async def test_match_creates_new_crew_space(crew_client, crew_settings, seed_crew_trip):
    user_id = str(uuid.uuid4())
    tok = make_token(crew_settings, user_id, "traveler@example.com")
    await seed_crew_trip(user_id, "traveler@example.com", "Lisbon", "2026-05-01", "2026-05-08")

    resp = await crew_client.get("/api/v1/community/crew/match", headers=_auth(tok))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["personalized"] is True
    assert len(body["matches"]) == 1
    match = body["matches"][0]
    assert "Lisbon" in match["name"]
    assert match["is_joined"] is False
    assert match["member_count"] == 0
    assert body["invite"] is None


async def test_match_reuses_overlapping_space_but_not_disjoint_one(crew_client, crew_settings, seed_crew_trip):
    user_a, user_b, user_c = (str(uuid.uuid4()) for _ in range(3))
    tok_a = make_token(crew_settings, user_a, "a@example.com")
    tok_b = make_token(crew_settings, user_b, "b@example.com")
    tok_c = make_token(crew_settings, user_c, "c@example.com")

    await seed_crew_trip(user_a, "a@example.com", "Rome", "2026-07-01", "2026-07-10")
    resp_a = await crew_client.get("/api/v1/community/crew/match", headers=_auth(tok_a))
    space_id = resp_a.json()["matches"][0]["id"]

    # Overlaps user A's window by several days -> same space reused.
    await seed_crew_trip(user_b, "b@example.com", "rome", "2026-07-05", "2026-07-15")
    resp_b = await crew_client.get("/api/v1/community/crew/match", headers=_auth(tok_b))
    assert resp_b.json()["matches"][0]["id"] == space_id

    # No overlap at all -> a distinct space.
    await seed_crew_trip(user_c, "c@example.com", "Rome", "2026-09-01", "2026-09-05")
    resp_c = await crew_client.get("/api/v1/community/crew/match", headers=_auth(tok_c))
    assert resp_c.json()["matches"][0]["id"] != space_id


async def test_request_join_then_leave(crew_client, crew_settings, seed_crew_trip):
    user_id = str(uuid.uuid4())
    tok = make_token(crew_settings, user_id, "traveler@example.com")
    await seed_crew_trip(user_id, "traveler@example.com", "Tokyo", "2026-04-01", "2026-04-10")
    space_id = (await crew_client.get("/api/v1/community/crew/match", headers=_auth(tok))).json()["matches"][0]["id"]

    resp = await crew_client.post(f"/api/v1/community/crew/{space_id}/request-join", headers=_auth(tok))
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "success", "action": "joined", "member_count": 1}

    # Idempotent — joining again doesn't double-insert.
    resp = await crew_client.post(f"/api/v1/community/crew/{space_id}/request-join", headers=_auth(tok))
    assert resp.json()["member_count"] == 1

    resp = await crew_client.post(f"/api/v1/community/crew/{space_id}/leave", headers=_auth(tok))
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "success", "action": "left", "member_count": 0}


async def test_request_join_rejects_non_crew_space(crew_client, crew_settings):
    user_id = str(uuid.uuid4())
    tok = make_token(crew_settings, user_id, "traveler@example.com")
    resp = await crew_client.post(f"/api/v1/community/crew/{uuid.uuid4()}/request-join", headers=_auth(tok))
    assert resp.status_code == 404


async def test_invite_accept_flow(crew_client, crew_settings, seed_crew_trip):
    sender_id, receiver_id = str(uuid.uuid4()), str(uuid.uuid4())
    sender_tok = make_token(crew_settings, sender_id, "sender@example.com")
    receiver_tok = make_token(crew_settings, receiver_id, "receiver@example.com")

    await seed_crew_trip(sender_id, "sender@example.com", "Berlin", "2026-08-01", "2026-08-07")
    space_id = (await crew_client.get("/api/v1/community/crew/match", headers=_auth(sender_tok))).json()["matches"][0]["id"]
    await crew_client.post(f"/api/v1/community/crew/{space_id}/request-join", headers=_auth(sender_tok))

    resp = await crew_client.post(
        f"/api/v1/community/crew/{space_id}/invite",
        headers=_auth(sender_tok),
        json={"receiver_customer_id": receiver_id},
    )
    assert resp.status_code == 200, resp.text
    invitation_id = resp.json()["id"]

    match_resp = await crew_client.get("/api/v1/community/crew/match", headers=_auth(receiver_tok))
    invite = match_resp.json()["invite"]
    assert invite is not None
    assert invite["id"] == invitation_id
    assert invite["space_id"] == space_id

    resp = await crew_client.post(f"/api/v1/community/crew/invitations/{invitation_id}/accept", headers=_auth(receiver_tok))
    assert resp.status_code == 200, resp.text
    assert resp.json()["member_count"] == 2

    # Already-resolved invitation can't be accepted again.
    resp = await crew_client.post(f"/api/v1/community/crew/invitations/{invitation_id}/accept", headers=_auth(receiver_tok))
    assert resp.status_code == 400


async def test_invite_decline_leaves_membership_untouched(crew_client, crew_settings, seed_crew_trip):
    sender_id, receiver_id = str(uuid.uuid4()), str(uuid.uuid4())
    sender_tok = make_token(crew_settings, sender_id, "sender@example.com")
    receiver_tok = make_token(crew_settings, receiver_id, "receiver@example.com")

    await seed_crew_trip(sender_id, "sender@example.com", "Nairobi", "2026-03-01", "2026-03-07")
    space_id = (await crew_client.get("/api/v1/community/crew/match", headers=_auth(sender_tok))).json()["matches"][0]["id"]
    await crew_client.post(f"/api/v1/community/crew/{space_id}/request-join", headers=_auth(sender_tok))
    invitation_id = (await crew_client.post(
        f"/api/v1/community/crew/{space_id}/invite",
        headers=_auth(sender_tok),
        json={"receiver_customer_id": receiver_id},
    )).json()["id"]

    resp = await crew_client.post(f"/api/v1/community/crew/invitations/{invitation_id}/decline", headers=_auth(receiver_tok))
    assert resp.status_code == 200, resp.text

    match_resp = await crew_client.get("/api/v1/community/crew/match", headers=_auth(sender_tok))
    assert match_resp.json()["matches"][0]["member_count"] == 1  # receiver never joined


async def test_accept_rejects_non_receiver(crew_client, crew_settings, seed_crew_trip):
    sender_id, receiver_id, stranger_id = (str(uuid.uuid4()) for _ in range(3))
    sender_tok = make_token(crew_settings, sender_id, "sender@example.com")
    stranger_tok = make_token(crew_settings, stranger_id, "stranger@example.com")

    await seed_crew_trip(sender_id, "sender@example.com", "Oslo", "2026-02-01", "2026-02-07")
    space_id = (await crew_client.get("/api/v1/community/crew/match", headers=_auth(sender_tok))).json()["matches"][0]["id"]
    await crew_client.post(f"/api/v1/community/crew/{space_id}/request-join", headers=_auth(sender_tok))
    invitation_id = (await crew_client.post(
        f"/api/v1/community/crew/{space_id}/invite",
        headers=_auth(sender_tok),
        json={"receiver_customer_id": receiver_id},
    )).json()["id"]

    resp = await crew_client.post(f"/api/v1/community/crew/invitations/{invitation_id}/accept", headers=_auth(stranger_tok))
    assert resp.status_code == 404


async def test_match_falls_back_to_popular_crews_with_no_trips(crew_client, crew_settings, seed_crew_trip):
    """A user with no active trips sees existing crews ranked by size instead
    of an empty list, and can join one directly from that fallback."""
    traveler_id = str(uuid.uuid4())
    traveler_tok = make_token(crew_settings, traveler_id, "traveler@example.com")
    await seed_crew_trip(traveler_id, "traveler@example.com", "Athens", "2026-06-01", "2026-06-08")
    space_id = (await crew_client.get("/api/v1/community/crew/match", headers=_auth(traveler_tok))).json()["matches"][0]["id"]
    await crew_client.post(f"/api/v1/community/crew/{space_id}/request-join", headers=_auth(traveler_tok))

    no_trip_user = str(uuid.uuid4())
    no_trip_tok = make_token(crew_settings, no_trip_user, "notrip@example.com")

    resp = await crew_client.get("/api/v1/community/crew/match", headers=_auth(no_trip_tok))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["personalized"] is False
    assert any(m["id"] == space_id for m in body["matches"])
    fallback_match = next(m for m in body["matches"] if m["id"] == space_id)
    assert fallback_match["member_count"] == 1
    assert fallback_match["is_joined"] is False

    # Joining directly from the fallback list works exactly like a personalized match.
    resp = await crew_client.post(f"/api/v1/community/crew/{space_id}/request-join", headers=_auth(no_trip_tok))
    assert resp.status_code == 200, resp.text
    assert resp.json()["member_count"] == 2
