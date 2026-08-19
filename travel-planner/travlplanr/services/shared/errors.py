"""
Standard error envelope for all services: {code, message, details, request_id}.

Call ``install_error_handlers(app)`` once per service after creating the
FastAPI app (alongside ``install_middleware``). It normalizes:

- ``HTTPException`` (and its ``detail`` payload, whether a string or dict)
- Pydantic/FastAPI request validation errors
- Any uncaught exception (mapped to a generic 500 without leaking internals)

``request_id`` is read from the ``X-Request-ID`` header if the caller sent
one (e.g. propagated by the gateway), otherwise a new UUID is generated.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def _request_id(request: Request) -> str:
    return request.headers.get("X-Request-ID") or str(uuid.uuid4())


def _envelope(code: str, message: str, details: object, request_id: str) -> dict:
    return {
        "code": code,
        "message": message,
        "details": details,
        "request_id": request_id,
    }


def install_error_handlers(app: FastAPI) -> None:
    """Install exception handlers that normalize all error responses."""

    @app.exception_handler(HTTPException)
    async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = _request_id(request)
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail and "message" in detail:
            # Route already built a structured payload — just add request_id.
            body = {**detail, "request_id": detail.get("request_id", request_id)}
        else:
            body = _envelope(
                code=f"http_{exc.status_code}",
                message=detail if isinstance(detail, str) else "Request failed.",
                details=detail if not isinstance(detail, str) else None,
                request_id=request_id,
            )
        headers = {**(exc.headers or {}), "X-Request-ID": request_id}
        return JSONResponse(status_code=exc.status_code, content=body, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = _request_id(request)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope(
                code="validation_error",
                message="Request validation failed.",
                details=exc.errors(),
                request_id=request_id,
            ),
            headers={"X-Request-ID": request_id},
        )

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id(request)
        logger.exception("Unhandled exception (request_id=%s)", request_id)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(
                code="internal_error",
                message="An unexpected error occurred.",
                details=None,
                request_id=request_id,
            ),
            headers={"X-Request-ID": request_id},
        )
