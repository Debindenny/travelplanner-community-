"""
Shared FastAPI middleware: CORS + security headers.

Call ``install_middleware(app, settings)`` once per service after creating the
FastAPI app. Origins come from ``settings.cors_origins_list`` (env CORS_ALLOW_ORIGINS).
"""

from __future__ import annotations

import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# Interactive API docs pull assets from a CDN; a strict CSP would break them.
_DOC_PATHS = ("/docs", "/redoc", "/openapi.json")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Generate and propagate X-Request-ID for request tracing."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
        # Store in request state for downstream logging/errors
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add conservative security headers to every response."""

    def __init__(self, app, hsts: bool = False) -> None:
        super().__init__(app)
        self.hsts = hsts

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault("X-XSS-Protection", "0")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        path = request.url.path
        is_doc = (path in _DOC_PATHS) or path.startswith(("/docs/", "/redoc/"))
        if not is_doc:
            headers.setdefault(
                "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
            )
        if self.hsts:
            headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response


def install_middleware(app: FastAPI, settings) -> None:
    """Install CORS + security-header middleware consistently across services."""
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        SecurityHeadersMiddleware,
        hsts=settings.environment.lower() == "production",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Currency"],
        max_age=600,
    )
