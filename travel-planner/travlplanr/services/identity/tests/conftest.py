"""Pytest fixtures for the identity service.

Mirrors services/planner/tests/conftest.py's shape (lazy heavy imports so the
lightweight unit tests never pay for fastapi/sqlalchemy/redis), but the identity
models don't need Postgres-only JSONB — the only Postgres-specific type in play
is CustomerProfile's ``ARRAY(String)`` columns, which we teach SQLite to render
as JSON via a compiler extension. That lets the whole suite run against an
in-memory SQLite database with no external services required, unlike planner's
integration tests which need a real ``PLANNER_TEST_DATABASE_URL`` Postgres.

Requires ``ENVIRONMENT=development`` (or dev/local/test) in the environment —
``ServiceSettings`` refuses to start with dev-default secrets otherwise. Run:

    ENVIRONMENT=development pytest services/identity/tests -q
"""

from __future__ import annotations

import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import pytest_asyncio

# --- make `app.*` and `shared.*` importable regardless of pytest's cwd --------
_TESTS_DIR = Path(__file__).resolve().parent            # services/identity/tests
_IDENTITY_DIR = _TESTS_DIR.parent                        # services/identity
_SERVICES_DIR = _IDENTITY_DIR.parent                      # services
for _p in (str(_IDENTITY_DIR), str(_SERVICES_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

TENANT_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_JWT_SECRET = "test-secret"
DEFAULT_JWT_ALGORITHM = "HS256"


def make_token(
    settings,
    user_id: str,
    email: str,
    *,
    kind: str = "customer",
    tenant_id: str = TENANT_ID,
    extra: dict | None = None,
    exp_delta: timedelta | None = None,
    jti: str | None = None,
) -> str:
    """Forge a JWT identical in shape to ``auth.py``'s ``_create_token`` output."""
    from jose import jwt

    now = datetime.now(UTC)
    if exp_delta is None:
        exp_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "user_kind": kind,
        "tenant_id": tenant_id,
        "jti": jti or str(uuid.uuid4()),
        "iat": now,
        "exp": now + exp_delta,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.fixture
def integration_env():
    """Skip unless every heavy dependency (incl. the sqlite async driver) is available."""
    pytest.importorskip("fastapi")
    pytest.importorskip("sqlalchemy")
    pytest.importorskip("httpx")
    pytest.importorskip("fakeredis")
    pytest.importorskip("jose")
    pytest.importorskip("aiosqlite")
    return True


@pytest_asyncio.fixture
async def identity_app(integration_env, monkeypatch):
    """Build the identity app's auth/me/internal routers wired to a fresh
    in-memory SQLite schema and a fake Redis.

    Yields ``(app, session_factory, settings, redis)``.
    """
    import fakeredis.aioredis as fakeaioredis
    from fastapi import FastAPI
    from shared.config import ServiceSettings
    from shared.database import Base
    from shared.errors import install_error_handlers
    from shared.middleware import install_middleware
    from sqlalchemy.dialects.postgresql import ARRAY
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.ext.compiler import compiles
    from sqlalchemy.pool import StaticPool

    # SQLite has no ARRAY type; CustomerProfile uses postgresql.ARRAY for its
    # preference-list columns. Teach the SQLite dialect to render it as JSON so
    # `create_all()` can build the table (we never write list values to it in
    # these tests, so the storage format doesn't matter).
    if not getattr(ARRAY, "_sqlite_compiles_patched", False):
        @compiles(ARRAY, "sqlite")
        def _compile_array_sqlite(element, compiler, **kw):  # noqa: ANN001
            return "JSON"

        ARRAY._sqlite_compiles_patched = True

    # Importing the model modules registers their tables on Base.metadata.
    import app.models.customer_assignments  # noqa: F401
    import app.models.customer_profiles  # noqa: F401
    import app.models.notification_settings  # noqa: F401
    import app.models.plans  # noqa: F401
    import app.models.staff  # noqa: F401
    import app.models.users  # noqa: F401
    from app.routers import auth as auth_router
    from app.routers import internal as internal_router
    from app.routers import me as me_router

    # Never send real email/SMS in tests, and force the deterministic MockProvider
    # (a real SENDGRID_API_KEY/SMTP_HOST leaking in from the host env would change
    # which NotificationProvider otp_request() picks).
    monkeypatch.delenv("SENDGRID_API_KEY", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)

    settings = ServiceSettings(
        service_name="identity",
        database_url="sqlite+aiosqlite://",
        jwt_secret=DEFAULT_JWT_SECRET,
        jwt_algorithm=DEFAULT_JWT_ALGORITHM,
        environment="development",
        internal_api_secret="test-internal-secret",
    )

    engine = create_async_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    redis = fakeaioredis.FakeRedis(decode_responses=True)

    application = FastAPI()
    install_middleware(application, settings)
    install_error_handlers(application)
    application.include_router(auth_router.router, prefix="/api/v1/auth")
    application.include_router(me_router.router, prefix="/api/v1/me")
    application.include_router(internal_router.router, prefix="/api/v1/internal")
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
async def client(identity_app):
    import httpx

    application = identity_app[0]
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def settings(identity_app):
    return identity_app[2]


@pytest.fixture
def redis(identity_app):
    return identity_app[3]


@pytest_asyncio.fixture
async def seed_customer(identity_app):
    """Insert a customer User + CustomerProfile directly. Returns an async
    callable -> user_id str."""
    session_factory = identity_app[1]

    async def _seed(email: str, *, status: str = "active", name: str | None = None) -> str:
        from app.models.customer_profiles import CustomerProfile
        from app.models.users import User, UserKind, UserStatus

        user_id = uuid.uuid4()
        async with session_factory() as s:
            s.add(
                User(
                    id=user_id,
                    email=email,
                    user_kind=UserKind.CUSTOMER,
                    status=UserStatus[status.upper()],
                    tenant_id=uuid.UUID(TENANT_ID),
                    last_login_at=datetime.now(UTC),
                )
            )
            s.add(
                CustomerProfile(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    display_code=f"CUS{user_id.hex[:6].upper()}",
                    name=name or email.split("@")[0],
                    tenant_id=uuid.UUID(TENANT_ID),
                )
            )
            await s.commit()
        return str(user_id)

    return _seed


@pytest_asyncio.fixture
async def seed_subscription(identity_app):
    """Insert a Subscription row for a (already-existing) user. Returns an async
    callable -> subscription id str."""
    session_factory = identity_app[1]

    async def _seed(
        user_id: str,
        *,
        plan_code: str = "individual",
        plans_used: int = 0,
        plans_limit: int = 10,
    ) -> str:
        from app.models.plans import Subscription

        sub_id = uuid.uuid4()
        now = datetime.now(UTC)
        async with session_factory() as s:
            s.add(
                Subscription(
                    id=sub_id,
                    user_id=uuid.UUID(user_id),
                    plan_code=plan_code,
                    plans_used=plans_used,
                    plans_limit=plans_limit,
                    period_start=now,
                    period_end=now + timedelta(days=30),
                )
            )
            await s.commit()
        return str(sub_id)

    return _seed
