"""
Shared FastAPI dependencies for authentication and authorization.
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, WebSocket, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from jose import JWTError, jwt
from typing import Optional

from .config import DEFAULT_DEV_REDIS_PASSWORD, ServiceSettings

logger = logging.getLogger(__name__)

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Revoked-token blocklist (written by identity's /auth/logout).
REVOKED_JWT_PREFIX = "revoked_jwt:"


def get_settings(request: Request) -> ServiceSettings:
    return request.app.state.settings


async def _is_revoked(request: Request | WebSocket, jti: str | None, *, strict: bool = True) -> bool:
    """Check the shared Redis blocklist.

    strict=True (required auth): Redis outage → HTTP 503.
    strict=False (optional auth): Redis outage → treat token as revoked (fail closed).
    """
    if not jti:
        return False
    redis = getattr(request.app.state, "redis", None)
    if redis is None:
        if strict:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication verification temporarily unavailable",
            )
        return True
    try:
        return bool(await redis.exists(f"{REVOKED_JWT_PREFIX}{jti}"))
    except Exception as exc:
        logger.warning("revocation check unavailable", extra={"error": str(exc)})
        if strict:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication verification temporarily unavailable",
            ) from exc
        return True


async def get_current_user_token(
    request: Request,
    settings: Annotated[ServiceSettings, Depends(get_settings)],
    x_api_key: Optional[str] = Depends(api_key_header),
) -> dict[str, Any]:
    """Validate JWT token or X-API-Key header, and return the user payload."""
    # 1. Check API Key
    if x_api_key:
        redis = getattr(request.app.state, "redis", None)
        if redis:
            import json
            cached = await redis.get(f"b2b_apikey:{x_api_key}")
            if cached:
                try:
                    payload = json.loads(cached)
                    return payload
                except Exception:
                    pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API Key",
        )

    # 2. Check Bearer Token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if await _is_revoked(request, payload.get("jti"), strict=True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def require_staff(
    payload: Annotated[dict[str, Any], Depends(get_current_user_token)],
) -> dict[str, Any]:
    """Dependency that enforces the user is a staff member."""
    if payload.get("user_kind") != "staff":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required",
        )
    return payload


async def require_manager(
    payload: Annotated[dict[str, Any], Depends(get_current_user_token)],
) -> dict[str, Any]:
    """Dependency that enforces the user is a manager or admin."""
    await require_staff(payload)
    if payload.get("role") not in ("Manager", "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required",
        )
    return payload


ROLE_PERMISSIONS = {
    "Staff": {
        "cms:read",
        "support:read",
        "support:write",
        "itinerary:read",
    },
    "Manager": {
        "cms:read",
        "cms:write",
        "support:read",
        "support:write",
        "itinerary:read",
        "itinerary:write",
        "staff:read",
    },
    "Admin": {
        "cms:read",
        "cms:write",
        "support:read",
        "support:write",
        "itinerary:read",
        "itinerary:write",
        "staff:read",
        "staff:write",
        "b2b:write",
        "system:admin",
    }
}


def require_permission(permission: str):
    """Dependency creator for permission-based RBAC verification."""
    async def dependency(payload: Annotated[dict[str, Any], Depends(require_staff)]) -> dict[str, Any]:
        role = payload.get("role", "Staff")
        user_permissions = ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["Staff"])
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return payload
    return dependency


async def require_customer(
    payload: Annotated[dict[str, Any], Depends(get_current_user_token)],
) -> dict[str, Any]:
    """Dependency that enforces the user is a customer or a B2B agent."""
    if payload.get("user_kind") not in ("customer", "travel_agent"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer or Agent access required",
        )
    return payload


async def _decode_customer_token(
    request: Request,
    token: HTTPAuthorizationCredentials | None,
    settings: ServiceSettings,
) -> dict[str, Any] | None:
    """Return customer JWT payload when valid; None for missing/invalid/non-customer tokens."""
    if not token:
        return None
    try:
        payload = jwt.decode(
            token.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None
    if payload.get("user_kind") != "customer":
        return None
    if await _is_revoked(request, payload.get("jti"), strict=False):
        return None
    return payload


def _extract_ws_token(websocket: WebSocket) -> str | None:
    # Support subprotocol-based auth (preferred over query params).
    subprotocols = websocket.scope.get("subprotocols") or []
    for protocol in subprotocols:
        if protocol.startswith("access_token."):
            return protocol.split("access_token.", 1)[1]

    header = websocket.headers.get("sec-websocket-protocol")
    if header:
        for protocol in (value.strip() for value in header.split(",")):
            if protocol.startswith("access_token."):
                return protocol.split("access_token.", 1)[1]

    # Only allow query params token in local development to avoid token leakage in production server logs.
    settings = getattr(websocket.app.state, "settings", None)
    if settings and settings.environment.lower() in ("development", "dev", "local", "test"):
        token = websocket.query_params.get("token")
        if token:
            return token
    return None


async def decode_websocket_customer_token(
    websocket: WebSocket,
    *,
    expected_customer_id: str | None = None,
) -> dict[str, Any] | None:
    """Validate WebSocket JWT for customer endpoints. Returns payload or None."""
    token = _extract_ws_token(websocket)
    if not token:
        return None
    settings = websocket.app.state.settings
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None
    if payload.get("user_kind") != "customer":
        return None
    # strict=False: this is a WebSocket handshake, and HTTPException raised here
    # cannot be turned into a 503 response by Starlette. strict=False still fails
    # closed — a Redis outage makes _is_revoked report "revoked", so the caller
    # rejects the connection instead of crashing the handler.
    if await _is_revoked(websocket, payload.get("jti"), strict=False):
        return None
    payload_customer_id = payload.get("customer_id")
    if expected_customer_id is not None and payload_customer_id != expected_customer_id:
        return None
    return payload


async def optional_customer(
    request: Request,
    token: Annotated[HTTPAuthorizationCredentials | None, Depends(optional_security)],
    settings: Annotated[ServiceSettings, Depends(get_settings)],
) -> dict[str, Any] | None:
    """Optional customer auth — used for public endpoints that personalize when logged in."""
    return await _decode_customer_token(request, token, settings)


