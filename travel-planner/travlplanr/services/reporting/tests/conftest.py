"""Pytest fixtures for the reporting service.

Lightweight, import-safe top level: only stdlib + pytest are imported here so
that loading this conftest never breaks anywhere the heavy deps aren't
installed. All heavy imports happen lazily *inside* fixtures.

The integration fixtures require a real Postgres database — some reporting
models (e.g. ``app.models.notifications.AdminNotification``) use the
Postgres-only ``UUID`` dialect type — provided via the env var
``REPORTING_TEST_DATABASE_URL``, e.g.::

    REPORTING_TEST_DATABASE_URL=postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/reporting_test \\
        pytest services/reporting/tests -q

and the test extras installed::

    pip install pytest pytest-asyncio fakeredis asyncpg \\
        fastapi sqlalchemy "python-jose[cryptography]" httpx redis pydantic-settings

When the env var or any dep is missing, the integration modules skip cleanly.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio

# --- make `app.*` and `shared.*` importable regardless of pytest's cwd --------
_TESTS_DIR = Path(__file__).resolve().parent            # services/reporting/tests
_REPORTING_DIR = _TESTS_DIR.parent                        # services/reporting
_SERVICES_DIR = _REPORTING_DIR.parent                      # services
for _p in (str(_REPORTING_DIR), str(_SERVICES_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

TENANT_ID = "00000000-0000-0000-0000-000000000001"
TEST_DB_URL = os.getenv("REPORTING_TEST_DATABASE_URL")


def make_token(
    settings,
    user_id: str,
    email: str,
    *,
    kind: str = "staff",
    role: str = "Admin",
    tenant_id: str = TENANT_ID,
) -> str:
    """Forge a JWT the reporting service's auth dependencies will accept."""
    from jose import jwt

    payload = {
        "sub": user_id,
        "staff_id": user_id if kind == "staff" else None,
        "customer_id": user_id if kind == "customer" else None,
        "email": email,
        "user_kind": kind,
        "role": role,
        "tenant_id": tenant_id,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.fixture
def integration_env():
    """Skip the test unless the DB + all heavy deps are available."""
    if not TEST_DB_URL:
        pytest.skip("REPORTING_TEST_DATABASE_URL not set; skipping DB integration tests")
    pytest.importorskip("fastapi")
    pytest.importorskip("sqlalchemy")
    pytest.importorskip("httpx")
    pytest.importorskip("fakeredis")
    pytest.importorskip("jose")
    return True


@pytest_asyncio.fixture
async def db(integration_env):
    """Fresh reporting schema + session_factory for each test."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from shared.database import Base

    # Importing the model modules registers their tables on Base.metadata.
    import app.models.customer_segment_counts  # noqa: F401
    import app.models.dashboard_metric_daily  # noqa: F401
    import app.models.notifications  # noqa: F401
    import app.models.staff_customer_counts  # noqa: F401
    import app.models.trip_status_counts  # noqa: F401

    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    try:
        yield session_factory
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest_asyncio.fixture
async def fake_redis(integration_env):
    import fakeredis.aioredis as fakeaioredis

    redis = fakeaioredis.FakeRedis(decode_responses=True)
    try:
        yield redis
    finally:
        await redis.aclose()


@pytest_asyncio.fixture
async def reporting_app(db, fake_redis):
    """Build the reporting FastAPI app (dashboard + notifications + internal
    stats + websocket routers) wired to a fresh Postgres schema and a fake
    Redis, exactly as ``app/main.py`` wires the real app minus the background
    consumer tasks (tests drive consumers explicitly)."""
    from fastapi import FastAPI

    from shared.config import ServiceSettings
    from shared.errors import install_error_handlers
    from shared.middleware import install_middleware

    from app.routers import dashboard, internal_stats, notifications, websocket

    settings = ServiceSettings(
        service_name="reporting",
        database_url=TEST_DB_URL,
        jwt_secret="test-secret",
        internal_api_secret="test-internal-secret",
        environment="development",
    )

    application = FastAPI()
    install_middleware(application, settings)
    install_error_handlers(application)
    application.state.settings = settings
    application.state.session_factory = db
    application.state.redis = fake_redis

    application.include_router(dashboard.router, prefix="/api/v1/admin/dashboard")
    application.include_router(notifications.router, prefix="/api/v1/admin/notifications")
    application.include_router(internal_stats.router, prefix="/api/v1/internal/stats")
    application.include_router(websocket.router, prefix="/api/v1/admin")

    return application


@pytest_asyncio.fixture
async def client(reporting_app):
    import httpx

    transport = httpx.ASGITransport(app=reporting_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def settings(reporting_app):
    return reporting_app.state.settings


@pytest.fixture
def staff_token(settings):
    return make_token(settings, str(uuid.uuid4()), "staff@example.com", kind="staff")


@pytest.fixture
def customer_token(settings):
    return make_token(settings, str(uuid.uuid4()), "customer@example.com", kind="customer")


def patch_blocking_xreadgroup(redis) -> None:
    """Work around a fakeredis limitation for tests that drive a real consumer
    loop (``while True: await read_events(...)``).

    Real Redis's blocking ``XREADGROUP`` genuinely suspends the calling
    coroutine until data arrives or the block timeout elapses, which yields
    control back to the event loop. fakeredis's blocking ``XREADGROUP``
    returns "no messages" immediately with no underlying suspension point at
    all, so a consumer's poll loop against it becomes a tight, fully
    synchronous spin that never yields to the event loop — starving every
    other task (including the test's own timeout/cancellation) forever.

    This patches the given fakeredis instance only (never the app/shared
    consumer code) so an empty poll performs one real ``asyncio.sleep``,
    restoring the "this call may suspend" behavior tests need in order to
    bound and cancel a real consumer loop.
    """
    original_xreadgroup = redis.xreadgroup

    async def _xreadgroup_that_yields(*args, **kwargs):
        result = await original_xreadgroup(*args, **kwargs)
        if not result:
            await asyncio.sleep(0.05)
        return result

    redis.xreadgroup = _xreadgroup_that_yields
