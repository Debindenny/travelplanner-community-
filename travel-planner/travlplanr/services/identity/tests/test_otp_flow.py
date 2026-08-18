"""OTP request/verify flow — services/identity/app/routers/auth.py.

Covers the priority area called out in DESIGN_ENHANCEMENT_PLAN.md: "OTP flow,
JWT expiry, plan usage limits." These hit the real FastAPI routes through
httpx against an in-memory SQLite DB + fakeredis, so the OTP storage, attempt
counting, and rate limiting all run through the actual production code paths.
"""

from __future__ import annotations


async def test_otp_request_returns_dev_otp_and_stores_code_in_redis(client, redis):
    resp = await client.post("/api/v1/auth/otp/request", json={"email": "new@example.com"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "new@example.com"
    assert body["dev_otp"] is not None
    assert len(body["dev_otp"]) == 6 and body["dev_otp"].isdigit()

    stored = await redis.get("otp:new@example.com")
    assert stored == body["dev_otp"]


async def test_otp_verify_happy_path_auto_registers_customer_and_issues_jwt(client):
    req = await client.post("/api/v1/auth/otp/request", json={"email": "alice@example.com"})
    code = req.json()["dev_otp"]

    resp = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "alice@example.com", "code": code}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "Verified"
    assert body["email"] == "alice@example.com"
    assert body["access_token"]
    assert body["refresh_token"]

    from jose import jwt

    payload = jwt.decode(body["access_token"], "test-secret", algorithms=["HS256"])
    assert payload["email"] == "alice@example.com"
    assert payload["user_kind"] == "customer"
    assert "customer_id" in payload
    assert "customer_name" in payload


async def test_otp_verify_wrong_code_is_rejected(client):
    req = await client.post("/api/v1/auth/otp/request", json={"email": "bob@example.com"})
    good_code = req.json()["dev_otp"]
    wrong_code = "".join("9" if c != "9" else "8" for c in good_code)

    resp = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "bob@example.com", "code": wrong_code}
    )
    assert resp.status_code == 401
    assert "Invalid or expired" in resp.json()["message"]


async def test_otp_verify_rejects_malformed_code_without_touching_redis(client):
    await client.post("/api/v1/auth/otp/request", json={"email": "carol@example.com"})

    resp = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "carol@example.com", "code": "12x"}
    )
    assert resp.status_code == 400
    assert "Invalid code format" in resp.json()["message"]


async def test_otp_verify_expired_code_is_rejected(client, redis):
    req = await client.post("/api/v1/auth/otp/request", json={"email": "dana@example.com"})
    code = req.json()["dev_otp"]

    # Simulate the 5-minute Redis TTL having elapsed.
    await redis.delete("otp:dana@example.com")

    resp = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "dana@example.com", "code": code}
    )
    assert resp.status_code == 401
    assert "Invalid or expired" in resp.json()["message"]


async def test_otp_code_is_single_use(client):
    """A verified code must not be replayable — verify() deletes it from Redis."""
    req = await client.post("/api/v1/auth/otp/request", json={"email": "erin@example.com"})
    code = req.json()["dev_otp"]

    first = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "erin@example.com", "code": code}
    )
    assert first.status_code == 200

    second = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "erin@example.com", "code": code}
    )
    assert second.status_code == 401


async def test_otp_verify_locks_out_after_five_failed_attempts(client):
    await client.post("/api/v1/auth/otp/request", json={"email": "frank@example.com"})

    for _ in range(5):
        resp = await client.post(
            "/api/v1/auth/otp/verify", json={"email": "frank@example.com", "code": "000000"}
        )
        assert resp.status_code == 401

    # 6th attempt is blocked by the attempts counter regardless of code correctness.
    locked = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "frank@example.com", "code": "000000"}
    )
    assert locked.status_code == 429
    assert "Too many failed verification attempts" in locked.json()["message"]


async def test_otp_request_resets_attempt_counter(client, redis):
    """Requesting a fresh code clears any prior failed-attempt count for that email."""
    await client.post("/api/v1/auth/otp/request", json={"email": "gina@example.com"})
    for _ in range(3):
        await client.post(
            "/api/v1/auth/otp/verify", json={"email": "gina@example.com", "code": "000000"}
        )
    assert await redis.get("otp_attempts:gina@example.com") == "3"

    req2 = await client.post("/api/v1/auth/otp/request", json={"email": "gina@example.com"})
    assert await redis.get("otp_attempts:gina@example.com") is None

    code = req2.json()["dev_otp"]
    resp = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "gina@example.com", "code": code}
    )
    assert resp.status_code == 200


async def test_otp_request_is_rate_limited_per_ip(client):
    """otp/request is limited to 5 requests / 300s per client IP."""
    for i in range(5):
        resp = await client.post(
            "/api/v1/auth/otp/request", json={"email": f"limit{i}@example.com"}
        )
        assert resp.status_code == 200

    sixth = await client.post("/api/v1/auth/otp/request", json={"email": "limit5@example.com"})
    assert sixth.status_code == 429


async def test_otp_verify_existing_inactive_customer_is_rejected(client, seed_customer):
    await seed_customer("suspended@example.com", status="suspended")

    req = await client.post("/api/v1/auth/otp/request", json={"email": "suspended@example.com"})
    code = req.json()["dev_otp"]

    resp = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "suspended@example.com", "code": code}
    )
    assert resp.status_code == 403
    assert "inactive or suspended" in resp.json()["message"]


async def test_otp_verify_existing_active_customer_reuses_profile(client, seed_customer):
    user_id = await seed_customer("returning@example.com", name="Returning User")

    req = await client.post("/api/v1/auth/otp/request", json={"email": "returning@example.com"})
    code = req.json()["dev_otp"]

    resp = await client.post(
        "/api/v1/auth/otp/verify", json={"email": "returning@example.com", "code": code}
    )
    assert resp.status_code == 200

    from jose import jwt

    payload = jwt.decode(resp.json()["access_token"], "test-secret", algorithms=["HS256"])
    assert payload["sub"] == user_id
    assert payload["customer_name"] == "Returning User"
