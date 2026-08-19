"""Pytest fixtures for the affiliate service.

Mirrors services/planner/tests/conftest.py: a lightweight, import-safe top
level (stdlib + pytest only) so loading this conftest never breaks pure-logic
unit tests. Heavy imports (fastapi/sqlalchemy/redis/...) happen lazily inside
fixtures, so a test only pulls them in when it actually asks for the
integration harness.

The integration fixtures require a real Postgres database (Booking uses a
Postgres ENUM type for status), provided via ``AFFILIATE_TEST_DATABASE_URL``,
e.g.::

    AFFILIATE_TEST_DATABASE_URL=postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/affiliate_test \\
        ENVIRONMENT=development pytest services/affiliate/tests -q
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio

# --- make `app.*` and `shared.*` importable regardless of pytest's cwd --------
_TESTS_DIR = Path(__file__).resolve().parent          # services/affiliate/tests
_AFFILIATE_DIR = _TESTS_DIR.parent                     # services/affiliate
_SERVICES_DIR = _AFFILIATE_DIR.parent                  # services
for _p in (str(_AFFILIATE_DIR), str(_SERVICES_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

TENANT_ID = "00000000-0000-0000-0000-000000000001"
TEST_DB_URL = os.getenv("AFFILIATE_TEST_DATABASE_URL")


def make_token(settings, customer_id: str, email: str, tenant_id: str = TENANT_ID) -> str:
    """Forge a JWT the affiliate's require_customer dependency will accept."""
    from jose import jwt

    payload = {
        "sub": customer_id,
        "customer_id": customer_id,
        "email": email,
        "customer_name": email.split("@")[0],
        "user_kind": "customer",
        "tenant_id": tenant_id,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.fixture
def integration_env():
    """Skip the test unless the DB + all heavy deps are available."""
    if not TEST_DB_URL:
        pytest.skip("AFFILIATE_TEST_DATABASE_URL not set; skipping DB integration tests")
    pytest.importorskip("fastapi")
    pytest.importorskip("sqlalchemy")
    pytest.importorskip("httpx")
    pytest.importorskip("fakeredis")
    pytest.importorskip("jose")
    return True


@pytest_asyncio.fixture
async def affiliate_app(integration_env, monkeypatch):
    """Build a minimal affiliate app (bookings + inventory routers) wired to a
    fresh Postgres schema and a fake Redis. No lifespan/consumer task is
    started here — tests that need the booking consumer start it explicitly.

    Yields ``(app, session_factory, settings, redis)``.
    """
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    import fakeredis.aioredis as fakeaioredis

    from shared.config import ServiceSettings
    from shared.database import Base
    from shared.middleware import install_middleware

    # Importing the model module registers `bookings` on Base.metadata.
    import app.models.bookings  # noqa: F401
    from app.routers import bookings as bookings_router
    from app.routers import inventory as inventory_router

    settings = ServiceSettings(
        service_name="affiliate",
        database_url=TEST_DB_URL,
        jwt_secret="test-secret",
        environment="development",
    )

    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    redis = fakeaioredis.FakeRedis(decode_responses=True)

    application = FastAPI()
    install_middleware(application, settings)
    application.include_router(bookings_router.router, prefix="/api/v1/bookings", tags=["Bookings"])
    application.include_router(inventory_router.router, prefix="/api/v1", tags=["Inventory"])
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
async def client(affiliate_app):
    import httpx

    application = affiliate_app[0]
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def settings(affiliate_app):
    return affiliate_app[2]


@pytest.fixture
def session_factory(affiliate_app):
    return affiliate_app[1]


@pytest.fixture
def redis(affiliate_app):
    return affiliate_app[3]
