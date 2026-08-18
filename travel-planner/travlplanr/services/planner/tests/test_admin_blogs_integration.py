"""Integration coverage for the admin blog CRUD router.

Regression test for a real bug found 2026-07-08: `BlogPostResponse` returned
raw ORM objects with snake_case field names (image_url, published_at, ...)
while the admin frontend's BlogPostData interface reads camelCase (image,
publishedAt, ...) — so the list page's Published/Category columns rendered
blank, and there was no `GET /{slug}` route at all, so opening the edit form
for any existing post 405'd immediately. Both are fixed in admin_blogs.py by
returning BlogPost.to_dict() (the same camelCase shape the customer-facing
CMS router already returns) and adding the missing GET /{slug}.

Requires PLANNER_TEST_DATABASE_URL — see conftest.py's `integration_env`.
"""

from __future__ import annotations

import uuid

import pytest

from conftest import make_token

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def admin_app(integration_env, monkeypatch):
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    import fakeredis.aioredis as fakeaioredis

    from shared.config import ServiceSettings
    from shared.database import Base
    from shared.middleware import install_middleware

    import app.models.cms  # noqa: F401 — registers BlogPost/FaqSection/FaqItem
    from app.routers import admin_blogs

    from conftest import TEST_DB_URL

    settings = ServiceSettings(
        service_name="planner",
        database_url=TEST_DB_URL,
        jwt_secret="test-secret",
        environment="development",
    )

    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        # Importing app.models.cms pulls in the whole app.models package
        # (see app/models/__init__.py's eager imports), so create_all also
        # tries to create Trip.embedding (pgvector) — needs a pgvector-enabled
        # Postgres image (see docker-compose.yml / conftest.py's planner_app).
        from sqlalchemy import text
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # require_staff's revocation check fails closed (503) if state.redis is
    # missing entirely — a fake in-process Redis keeps auth reachable here.
    redis = fakeaioredis.FakeRedis(decode_responses=True)

    application = FastAPI()
    install_middleware(application, settings)
    application.include_router(admin_blogs.router, prefix="/api/v1/admin/blogs")
    application.state.settings = settings
    application.state.session_factory = session_factory
    application.state.redis = redis

    try:
        yield application, settings
    finally:
        await redis.aclose()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.fixture
async def admin_client(admin_app):
    import httpx

    application = admin_app[0]
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def staff_headers(admin_app):
    settings = admin_app[1]
    token = make_token(settings, str(uuid.uuid4()), "staff@travlplanr.com", kind="staff")
    return {"Authorization": f"Bearer {token}"}


def _payload(slug: str, locale: str = "en") -> dict:
    return {
        "title": "Test Post",
        "slug": slug,
        "locale": locale,
        "excerpt": "An excerpt",
        "content": "Some content",
        "image_url": "assets/images/test.jpg",
        "author": "Test Author",
        "published_at": "Jun 1, 2025",
        "read_time": "5 min read",
        "category": "guides",
        "category_label": "Guides",
    }


async def test_create_returns_camel_case_fields(admin_client, staff_headers):
    resp = await admin_client.post(
        "/api/v1/admin/blogs/", json=_payload("camel-case-post"), headers=staff_headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # The exact bug: these must be camelCase, not image_url/published_at/...
    assert body["image"] == "assets/images/test.jpg"
    assert body["publishedAt"] == "Jun 1, 2025"
    assert body["readTime"] == "5 min read"
    assert body["categoryLabel"] == "Guides"
    assert body["locale"] == "en"


async def test_list_returns_camel_case_fields(admin_client, staff_headers):
    await admin_client.post("/api/v1/admin/blogs/", json=_payload("list-post"), headers=staff_headers)
    resp = await admin_client.get("/api/v1/admin/blogs/", headers=staff_headers)
    assert resp.status_code == 200
    posts = resp.json()
    assert len(posts) == 1
    assert posts[0]["publishedAt"] == "Jun 1, 2025"
    assert posts[0]["categoryLabel"] == "Guides"


async def test_get_single_post_by_slug(admin_client, staff_headers):
    """The exact 405 bug: GET /{slug} must exist and must not be shadowed by
    the later-registered literal routes (/media, /upload-image, /generate-seo)."""
    await admin_client.post("/api/v1/admin/blogs/", json=_payload("edit-me"), headers=staff_headers)
    resp = await admin_client.get("/api/v1/admin/blogs/edit-me", headers=staff_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["title"] == "Test Post"
    assert resp.json()["image"] == "assets/images/test.jpg"


async def test_media_route_is_not_shadowed_by_slug_route(admin_client, staff_headers):
    resp = await admin_client.get("/api/v1/admin/blogs/media", headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_missing_slug_is_404(admin_client, staff_headers):
    resp = await admin_client.get("/api/v1/admin/blogs/does-not-exist", headers=staff_headers)
    assert resp.status_code == 404


async def test_same_slug_allowed_across_locales(admin_client, staff_headers):
    en = await admin_client.post("/api/v1/admin/blogs/", json=_payload("shared-slug", "en"), headers=staff_headers)
    es = await admin_client.post("/api/v1/admin/blogs/", json=_payload("shared-slug", "es"), headers=staff_headers)
    assert en.status_code == 200
    assert es.status_code == 200

    dupe = await admin_client.post("/api/v1/admin/blogs/", json=_payload("shared-slug", "en"), headers=staff_headers)
    assert dupe.status_code == 400


async def test_update_and_delete_disambiguate_by_locale(admin_client, staff_headers):
    await admin_client.post("/api/v1/admin/blogs/", json=_payload("multi-locale", "en"), headers=staff_headers)
    await admin_client.post("/api/v1/admin/blogs/", json=_payload("multi-locale", "es"), headers=staff_headers)

    patch_es = await admin_client.patch(
        "/api/v1/admin/blogs/multi-locale",
        params={"locale": "es"},
        json={"title": "Titulo Actualizado"},
        headers=staff_headers,
    )
    assert patch_es.status_code == 200
    assert patch_es.json()["title"] == "Titulo Actualizado"

    # English copy must be untouched by the Spanish-scoped update.
    en_after = await admin_client.get(
        "/api/v1/admin/blogs/multi-locale", params={"locale": "en"}, headers=staff_headers
    )
    assert en_after.json()["title"] == "Test Post"

    delete_es = await admin_client.delete(
        "/api/v1/admin/blogs/multi-locale", params={"locale": "es"}, headers=staff_headers
    )
    assert delete_es.status_code == 204

    en_still_there = await admin_client.get(
        "/api/v1/admin/blogs/multi-locale", params={"locale": "en"}, headers=staff_headers
    )
    assert en_still_there.status_code == 200
