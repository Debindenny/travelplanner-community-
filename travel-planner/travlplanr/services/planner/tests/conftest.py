"""Pytest fixtures for the planner service.

Lightweight, import-safe top level: only stdlib + pytest are imported here so
that loading this conftest never breaks the pure-logic unit tests (which run in
the minimal CI image without fastapi/sqlalchemy/redis installed). All heavy
imports happen lazily *inside* fixtures, so a test only pulls them in when it
actually asks for the integration harness.

The integration fixtures require a real Postgres database (the models use
Postgres-only types — JSONB/ARRAY), provided via the env var
``PLANNER_TEST_DATABASE_URL``, e.g.::

    PLANNER_TEST_DATABASE_URL=postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_test \\
        pytest services/planner/tests/test_collaboration_integration.py -q

and the test extras installed::

    pip install pytest pytest-asyncio fakeredis asyncpg \\
        fastapi sqlalchemy "python-jose[cryptography]" httpx redis pydantic-settings

When the env var or any dep is missing, the integration module skips cleanly.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio

# --- make `app.*` and `shared.*` importable regardless of pytest's cwd --------
_TESTS_DIR = Path(__file__).resolve().parent          # services/planner/tests
_PLANNER_DIR = _TESTS_DIR.parent                       # services/planner
_SERVICES_DIR = _PLANNER_DIR.parent                    # services
for _p in (str(_PLANNER_DIR), str(_SERVICES_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

TENANT_ID = "00000000-0000-0000-0000-000000000001"
TEST_DB_URL = os.getenv("PLANNER_TEST_DATABASE_URL")


def make_token(settings, user_id: str, email: str, kind: str = "customer") -> str:
    """Forge a JWT the planner's require_customer dependency will accept."""
    from jose import jwt

    payload = {
        "sub": user_id,
        "customer_id": user_id,
        "email": email,
        "customer_name": email.split("@")[0],
        "user_kind": kind,
        "tenant_id": TENANT_ID,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.fixture
def integration_env():
    """Skip the test unless the DB + all heavy deps are available."""
    if not TEST_DB_URL:
        pytest.skip("PLANNER_TEST_DATABASE_URL not set; skipping DB integration tests")
    pytest.importorskip("fastapi")
    pytest.importorskip("sqlalchemy")
    pytest.importorskip("httpx")
    pytest.importorskip("fakeredis")
    pytest.importorskip("jose")
    return True


@pytest_asyncio.fixture
async def planner_app(integration_env, monkeypatch):
    """Build a minimal planner app (trips + collaboration routers) wired to a
    fresh Postgres schema, a fake Redis, and stubbed identity calls.

    Yields ``(app, session_factory, settings, redis)``.
    """
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    import fakeredis.aioredis as fakeaioredis

    from shared.config import ServiceSettings
    from shared.database import Base
    from shared.middleware import install_middleware

    # Importing the model modules registers their tables on Base.metadata.
    import app.models.trips  # noqa: F401
    import app.models.collaboration  # noqa: F401
    import app.models.community  # noqa: F401
    from app.routers import trips as trips_router
    from app.routers import collaboration as collab_router

    # Stub the cross-service identity lookup so invites never hit the network.
    async def _fake_resolve_email(email, auth_header):  # noqa: ANN001
        return None

    monkeypatch.setattr(collab_router, "_resolve_email", _fake_resolve_email)

    settings = ServiceSettings(
        service_name="planner",
        database_url=TEST_DB_URL,
        jwt_secret="test-secret",
        environment="development",
    )

    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        # Importing app.models.trips pulls in the whole app.models package
        # (see app/models/__init__.py's eager imports), so create_all also
        # tries to create Trip.embedding (pgvector). The real deploy flow
        # gets this from Alembic migration 0008; this harness bypasses
        # Alembic entirely, so it needs the same "CREATE EXTENSION" itself —
        # requires a pgvector-enabled Postgres image (see docker-compose.yml).
        from sqlalchemy import text
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    redis = fakeaioredis.FakeRedis(decode_responses=True)

    application = FastAPI()
    install_middleware(application, settings)
    # Both routers mount under /api/v1/trips, exactly as production main.py does.
    application.include_router(trips_router.router, prefix="/api/v1/trips")
    application.include_router(collab_router.router, prefix="/api/v1/trips")
    application.state.settings = settings
    application.state.session_factory = session_factory
    application.state.redis = redis

    try:
        yield application, session_factory, settings, redis
    finally:
        await redis.aclose()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture
async def client(planner_app):
    import httpx

    application = planner_app[0]
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def settings(planner_app):
    return planner_app[2]


@pytest.fixture
def seed_trip(planner_app):
    """Insert a trip + its owner collaborator row directly (bypasses the
    identity-coupled POST /trips path). Returns an async callable -> trip_id str."""
    session_factory = planner_app[1]

    async def _seed(owner_id: str, owner_email: str, *, is_confirmed: bool = False) -> str:
        from app.models.trips import Trip, TripStatus
        from app.models.collaboration import TripCollaborator

        trip_id = uuid.uuid4()
        owner_uuid = uuid.UUID(owner_id)
        async with session_factory() as s:
            trip = Trip(
                id=trip_id,
                tenant_id=uuid.UUID(TENANT_ID),
                customer_id=owner_uuid,
                customer_name=owner_email.split("@")[0],
                display_code="ITIN-TEST",
                title="Test Trip",
                destination="Paris",
                start_date="2026-01-01",
                end_date="2026-01-05",
                travelers=2,
                travel_style="relaxed",
                travel_method="flight",
                budget="mid",
                interests=[],
                food_preferences=[],
                status=TripStatus.READY,
                image="x",
                days=[],
                city_days=[],
                is_confirmed=is_confirmed,
            )
            s.add(trip)
            await s.flush()
            
            s.add(TripCollaborator(
                trip_id=trip_id,
                user_id=owner_uuid,
                email=owner_email.lower(),
                display_name=owner_email.split("@")[0],
                role="owner",
                status="active",
                invited_by=owner_uuid,
            ))
            await s.commit()
        return str(trip_id)

    return _seed
