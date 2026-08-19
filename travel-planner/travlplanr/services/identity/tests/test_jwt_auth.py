"""JWT issuance, expiry, tampering, and revocation.

Covers _create_token()/_create_refresh_token() (services/identity/app/routers/auth.py)
and the shared get_current_user_token dependency (services/shared/auth_dependencies.py)
that every protected identity route depends on.
"""

from __future__ import annotations

from datetime import UTC, timedelta

from conftest import make_token
from jose import jwt


async def test_create_token_embeds_expected_claims(identity_app, seed_customer):
    """_create_token() should set exp = iat + jwt_access_token_expire_minutes."""
    from app.models.users import User
    from app.routers.auth import _create_token

    _, session_factory, settings, _ = identity_app
    user_id = await seed_customer("token-claims@example.com", name="Claims User")

    async with session_factory() as session:
        import uuid

        from sqlalchemy import select

        from app.models.customer_profiles import CustomerProfile

        user = (
            await session.execute(select(User).where(User.id == uuid.UUID(user_id)))
        ).scalar_one()
        profile = (
            await session.execute(
                select(CustomerProfile).where(CustomerProfile.user_id == user.id)
            )
        ).scalar_one()

        token = _create_token(user, profile, settings)

    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == user_id
    assert payload["email"] == "token-claims@example.com"
    assert payload["user_kind"] == "customer"
    assert payload["customer_name"] == "Claims User"
    expected_delta = settings.jwt_access_token_expire_minutes * 60
    actual_delta = payload["exp"] - payload["iat"]
    assert abs(actual_delta - expected_delta) <= 1


async def test_expired_access_token_is_rejected(client, settings, seed_customer):
    user_id = await seed_customer("expired@example.com")
    token = make_token(
        settings, user_id, "expired@example.com", exp_delta=timedelta(minutes=-1)
    )

    resp = await client.get(
        "/api/v1/me/plan", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401
    assert resp.json()["message"] == "Could not validate credentials"


async def test_tampered_access_token_is_rejected(client, settings, seed_customer):
    user_id = await seed_customer("tampered@example.com")
    token = make_token(settings, user_id, "tampered@example.com")
    tampered = token[:-4] + ("aaaa" if not token.endswith("aaaa") else "bbbb")

    resp = await client.get(
        "/api/v1/me/plan", headers={"Authorization": f"Bearer {tampered}"}
    )
    assert resp.status_code == 401


async def test_token_signed_with_wrong_secret_is_rejected(client, seed_customer):
    import uuid
    from datetime import datetime

    from jose import jwt as jose_jwt

    user_id = await seed_customer("wrongsecret@example.com")
    now = datetime.now(UTC)
    bad_token = jose_jwt.encode(
        {
            "sub": user_id,
            "email": "wrongsecret@example.com",
            "user_kind": "customer",
            "tenant_id": "00000000-0000-0000-0000-000000000001",
            "jti": str(uuid.uuid4()),
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        "not-the-real-secret",
        algorithm="HS256",
    )

    resp = await client.get(
        "/api/v1/me/plan", headers={"Authorization": f"Bearer {bad_token}"}
    )
    assert resp.status_code == 401


async def test_missing_token_is_rejected(client):
    resp = await client.get("/api/v1/me/plan")
    assert resp.status_code in (401, 403)


async def test_valid_token_is_accepted(client, settings, seed_customer):
    user_id = await seed_customer("valid@example.com")
    token = make_token(settings, user_id, "valid@example.com")

    resp = await client.get(
        "/api/v1/me/plan", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200


async def test_logout_revokes_access_token(client, settings, seed_customer):
    user_id = await seed_customer("logout@example.com")
    token = make_token(settings, user_id, "logout@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    ok = await client.get("/api/v1/me/plan", headers=headers)
    assert ok.status_code == 200

    logout_resp = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    revoked = await client.get("/api/v1/me/plan", headers=headers)
    assert revoked.status_code == 401
    assert revoked.json()["message"] == "Token has been revoked"


async def test_refresh_issues_new_access_token(client, settings, seed_customer):
    import uuid

    from app.routers.auth import _create_refresh_token

    user_id = await seed_customer("refresh@example.com")

    class _U:
        id = uuid.UUID(user_id)

    refresh_token = _create_refresh_token(_U(), settings)

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["refresh_token"] != refresh_token

    payload = jwt.decode(
        body["access_token"], settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    assert payload["sub"] == user_id


async def test_refresh_token_is_single_use_rotation(client, settings, seed_customer):
    """Refresh-token rotation: reusing an already-rotated refresh token must fail."""
    import uuid

    from app.routers.auth import _create_refresh_token

    user_id = await seed_customer("rotate@example.com")

    class _U:
        id = uuid.UUID(user_id)

    refresh_token = _create_refresh_token(_U(), settings)

    first = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert first.status_code == 200

    second = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert second.status_code == 401
    assert "revoked" in second.json()["message"].lower()


async def test_refresh_rejects_access_token_used_as_refresh_token(client, settings, seed_customer):
    user_id = await seed_customer("wrongtype@example.com")
    access_token = make_token(settings, user_id, "wrongtype@example.com")

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401
