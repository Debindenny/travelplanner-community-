"""Tests for the JWT contract used by shared/auth_dependencies.py.

We don't spin up FastAPI here; we exercise the same encode/decode contract the
auth dependency relies on (python-jose, HS256, shared secret) so a regression in
token handling is caught fast.
"""
from __future__ import annotations

import pytest
from jose import JWTError, jwt

SECRET = "test-secret"
ALG = "HS256"


def _make_token(claims: dict) -> str:
    return jwt.encode(claims, SECRET, algorithm=ALG)


def test_valid_token_decodes_to_claims():
    token = _make_token({"sub": "user-1", "customer_id": "cust-1", "tenant_id": "t-1", "role": "customer"})
    payload = jwt.decode(token, SECRET, algorithms=[ALG])
    assert payload["sub"] == "user-1"
    assert payload["customer_id"] == "cust-1"
    assert payload["role"] == "customer"


def test_wrong_secret_is_rejected():
    token = _make_token({"sub": "user-1"})
    with pytest.raises(JWTError):
        jwt.decode(token, "different-secret", algorithms=[ALG])


def test_tampered_token_is_rejected():
    token = _make_token({"sub": "user-1"})
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
    with pytest.raises(JWTError):
        jwt.decode(tampered, SECRET, algorithms=[ALG])
