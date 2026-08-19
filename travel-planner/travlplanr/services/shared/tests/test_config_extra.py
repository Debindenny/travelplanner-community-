"""Extra coverage for shared/config.py beyond test_config.py.

Pure-logic — no DB/Redis/network. Covers env-var reading, the additional
production-secret offenders (INTERNAL_API_SECRET, CORS), and the derived
properties (use_json_logs, cors_origins_list).
"""
from __future__ import annotations

import pytest

from shared.config import ServiceSettings


def test_reads_values_from_env(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("JWT_SECRET", "from-env-secret")
    monkeypatch.setenv("SERVICE_NAME", "planner")
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    settings = ServiceSettings()
    assert settings.jwt_secret == "from-env-secret"
    assert settings.service_name == "planner"
    assert settings.jwt_access_token_expire_minutes == 30


def test_env_is_case_insensitive(monkeypatch):
    # case_sensitive=False — lowercase env var still maps.
    monkeypatch.setenv("jwt_secret", "lower-env-secret")
    settings = ServiceSettings(service_name="test", environment="development")
    assert settings.jwt_secret == "lower-env-secret"


def test_production_rejects_default_internal_api_secret():
    with pytest.raises(ValueError):
        ServiceSettings(
            service_name="identity",
            environment="production",
            jwt_secret="a-strong-secret",
            internal_api_secret="dev-internal-secret",
            cors_allow_origins="https://app.example.com",
            jwt_access_token_expire_minutes=60,
            s3_access_key="a-real-s3-access-key",
            s3_secret_key="a-real-s3-secret-key",
            redis_url="redis://:a-strong-redis-password@redis:6379/0",
        )


def test_production_rejects_wildcard_cors():
    with pytest.raises(ValueError):
        ServiceSettings(
            service_name="identity",
            environment="production",
            jwt_secret="a-strong-secret",
            internal_api_secret="a-strong-internal",
            cors_allow_origins="*",
            jwt_access_token_expire_minutes=60,
            s3_access_key="a-real-s3-access-key",
            s3_secret_key="a-real-s3-secret-key",
            redis_url="redis://:a-strong-redis-password@redis:6379/0",
        )


def test_production_rejects_localhost_cors():
    with pytest.raises(ValueError):
        ServiceSettings(
            service_name="identity",
            environment="production",
            jwt_secret="a-strong-secret",
            internal_api_secret="a-strong-internal",
            cors_allow_origins="http://localhost:4200",
            jwt_access_token_expire_minutes=60,
            s3_access_key="a-real-s3-access-key",
            s3_secret_key="a-real-s3-secret-key",
            redis_url="redis://:a-strong-redis-password@redis:6379/0",
        )


def test_production_passes_with_all_secure_values():
    settings = ServiceSettings(
        service_name="identity",
        environment="production",
        jwt_secret="a-strong-secret",
        internal_api_secret="a-strong-internal",
        seed_secret="a-strong-seed",
        cors_allow_origins="https://app.example.com,https://admin.example.com",
        jwt_access_token_expire_minutes=60,
        s3_access_key="a-real-s3-access-key",
        s3_secret_key="a-real-s3-secret-key",
        redis_url="redis://:a-strong-redis-password@redis:6379/0",
    )
    assert settings.environment == "production"


def test_production_rejects_default_redis_password():
    with pytest.raises(ValueError, match="REDIS_URL"):
        ServiceSettings(
            service_name="identity",
            environment="production",
            jwt_secret="a-strong-secret",
            internal_api_secret="a-strong-internal",
            seed_secret="a-strong-seed",
            cors_allow_origins="https://app.example.com",
            jwt_access_token_expire_minutes=60,
            s3_access_key="a-real-s3-access-key",
            s3_secret_key="a-real-s3-secret-key",
            redis_url="redis://:travlplanr_redis@redis:6379/0",
        )


def test_use_json_logs_default_by_environment():
    dev = ServiceSettings(service_name="t", environment="development", log_json=None)
    assert dev.use_json_logs is False
    prod = ServiceSettings(
        service_name="t",
        environment="production",
        log_json=None,
        jwt_secret="a-strong-secret",
        internal_api_secret="a-strong-internal",
        seed_secret="a-strong-seed",
        cors_allow_origins="https://app.example.com",
        jwt_access_token_expire_minutes=60,
        s3_access_key="a-real-s3-access-key",
        s3_secret_key="a-real-s3-secret-key",
        redis_url="redis://:a-strong-redis-password@redis:6379/0",
    )
    assert prod.use_json_logs is True


def test_use_json_logs_explicit_override_wins():
    # log_json explicitly set overrides the environment-derived default.
    settings = ServiceSettings(service_name="t", environment="development", log_json=True)
    assert settings.use_json_logs is True


def test_cors_origins_list_splits_and_strips():
    settings = ServiceSettings(
        service_name="t",
        environment="development",
        cors_allow_origins="  http://a.com , http://b.com ,, ",
    )
    assert settings.cors_origins_list == ["http://a.com", "http://b.com"]
