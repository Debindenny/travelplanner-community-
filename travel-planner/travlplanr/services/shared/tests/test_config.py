"""Tests for shared/config.py — especially the production JWT-secret guard.

The guard is a security control: it must refuse to start in production with the
default development secret. These tests pin that behaviour.
"""
from __future__ import annotations

import pytest

from shared.config import ServiceSettings


def test_defaults_load_in_development():
    settings = ServiceSettings(service_name="test", environment="development")
    assert settings.jwt_algorithm == "HS256"
    assert settings.service_name == "test"


def test_production_with_default_secret_is_rejected():
    with pytest.raises(ValueError):
        ServiceSettings(
            service_name="identity",
            environment="production",
            jwt_secret="dev-secret-change-in-prod",
        )


def test_production_with_real_secret_is_allowed():
    # A fully-secure production config: all hardened secrets set to non-default
    # values and CORS restricted to explicit origins (no '*'/localhost).
    settings = ServiceSettings(
        service_name="identity",
        environment="production",
        jwt_secret="a-real-strong-secret-value",
        internal_api_secret="a-real-internal-secret-value",
        seed_secret="a-real-seed-secret-value",
        cors_allow_origins="https://app.travlplanr.com",
        jwt_access_token_expire_minutes=60,
        s3_access_key="a-real-s3-access-key",
        s3_secret_key="a-real-s3-secret-key",
        redis_url="redis://:a-strong-redis-password@redis:6379/0",
    )
    assert settings.environment == "production"
    assert settings.jwt_secret != "dev-secret-change-in-prod"


def test_guard_is_case_insensitive_on_environment():
    with pytest.raises(ValueError):
        ServiceSettings(
            service_name="identity",
            environment="PRODUCTION",
            jwt_secret="dev-secret-change-in-prod",
        )
