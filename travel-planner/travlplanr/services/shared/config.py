"""Shared configuration loaded from environment variables."""

from __future__ import annotations

import os
from pydantic import model_validator
from pydantic_settings import BaseSettings

# Environments allowed to run with the insecure defaults below. Default-deny:
# anything not explicitly listed here (including unset/misspelled ENVIRONMENT
# values) is treated as production-like and must override every secret.
DEV_ENVIRONMENTS = {"development", "dev", "local", "test"}
DEFAULT_DEV_REDIS_PASSWORD = "travlplanr_redis"


class ServiceSettings(BaseSettings):
    """Base settings shared by all services."""

    database_url: str = "postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/identity_db"
    redis_url: str = "redis://localhost:6379/0"
    redis_session_url: str = "redis://localhost:6379/1"
    redis_rate_limit_url: str = "redis://localhost:6379/2"
    redis_ws_url: str = "redis://localhost:6379/3"
    jwt_secret: str = "dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    # Short-lived access tokens; the frontend already refreshes silently on 401
    # via refresh_token rotation (see identity's /auth/refresh), so this doesn't
    # cost UX. Override via JWT_ACCESS_TOKEN_EXPIRE_MINUTES if needed.
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    service_name: str = "unknown"
    default_tenant_id: str = "00000000-0000-0000-0000-000000000001"
    environment: str = "production"
    # Logging. LOG_LEVEL is standard (DEBUG/INFO/WARNING/ERROR). LOG_JSON forces
    # JSON output; when unset, JSON is used outside development automatically.
    log_level: str = "INFO"
    log_json: bool | None = None
    # Comma-separated list of allowed browser origins for CORS. Defaults to the
    # local dev frontends; MUST be set explicitly in production.
    cors_allow_origins: str = "http://localhost:4200,http://localhost:4320,http://localhost:8080,http://127.0.0.1:4200,http://127.0.0.1:4320"
    # Shared secret protecting dev-only seed/internal endpoints. MUST be overridden
    # outside development; seed endpoints are disabled entirely in production.
    seed_secret: str = "dev-seed-secret"
    internal_api_secret: str = "dev-internal-secret"

    # S3/MinIO Settings
    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "travlplanr-uploads"
    s3_region: str = "us-east-1"
    s3_public_domain: str = "http://localhost:9000/travlplanr-uploads"

    @model_validator(mode="after")
    def check_secrets_in_prod(self) -> "ServiceSettings":
        # Default-deny: only a recognized dev/test environment name is exempt.
        # Anything else — "production", "staging", a typo, or an unset var
        # that fell through to the "development" default via ENVIRONMENT not
        # being set at all in a real deployment — must override every secret.
        if self.environment.lower() not in DEV_ENVIRONMENTS:
            insecure = {
                "JWT_SECRET": (self.jwt_secret, "dev-secret-change-in-prod"),
                "INTERNAL_API_SECRET": (self.internal_api_secret, "dev-internal-secret"),
                "SEED_SECRET": (self.seed_secret, "dev-seed-secret"),
                "S3_ACCESS_KEY": (self.s3_access_key, "minioadmin"),
                "S3_SECRET_KEY": (self.s3_secret_key, "minioadmin"),
            }
            offenders = [name for name, (val, default) in insecure.items() if val == default]
            if offenders:
                raise ValueError(
                    f"{', '.join(offenders)} must be set to secure value(s) outside development!"
                )
            if self.jwt_access_token_expire_minutes > 60:
                raise ValueError(
                    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be <= 60 outside development! "
                    "Use refresh tokens for longer sessions."
                )
            # Every Redis connection must be checked, not just the primary one.
            # REDIS_SESSION_URL in particular backs the JWT revocation blocklist,
            # so leaving it on the dev password undermines logout entirely.
            redis_urls = {
                "REDIS_URL": self.redis_url,
                "REDIS_SESSION_URL": self.redis_session_url,
                "REDIS_RATE_LIMIT_URL": self.redis_rate_limit_url,
                "REDIS_WS_URL": self.redis_ws_url,
            }
            weak_redis = [
                name for name, url in redis_urls.items()
                if DEFAULT_DEV_REDIS_PASSWORD in url
            ]
            if weak_redis:
                raise ValueError(
                    f"{', '.join(sorted(weak_redis))} must not use the default dev "
                    "Redis password outside development!"
                )
            if "*" in self.cors_allow_origins or "localhost" in self.cors_allow_origins or "127.0.0.1" in self.cors_allow_origins:
                raise ValueError(
                    "CORS_ALLOW_ORIGINS must be set to explicit production origins (no '*' or localhost or 127.0.0.1)!"
                )
        return self

    @property
    def use_json_logs(self) -> bool:
        """JSON logs in non-dev environments unless explicitly overridden."""
        if self.log_json is not None:
            return self.log_json
        return self.environment.lower() != "development"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    model_config = {"env_prefix": "", "case_sensitive": False}
