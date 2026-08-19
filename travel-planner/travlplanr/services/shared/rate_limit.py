"""
Lightweight Redis fixed-window rate limiting for FastAPI.

Usage as a route dependency::

    from shared.rate_limit import rate_limiter

    @router.post("/otp/request", dependencies=[Depends(rate_limiter("otp-request", 5, 60))])
    async def request_otp(...): ...

The limiter keys on the client IP (honoring X-Forwarded-For from the gateway).
It uses ``app.state.redis`` and fails OPEN if Redis is unavailable, so a Redis
outage degrades to "no rate limiting" rather than a hard 500.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, Request, Response, status

logger = logging.getLogger(__name__)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


import time
import uuid

async def enforce_rate_limit(redis, key: str, limit: int, window_seconds: int) -> int | None:
    """Implement sliding-window rate limiting using Redis ZSETs."""
    bucket = f"ratelimit:{key}"
    now = time.time()
    clear_before = now - window_seconds
    
    try:
        async with redis.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(bucket, 0, clear_before)
            member = f"{now}-{uuid.uuid4()}"
            pipe.zadd(bucket, {member: now})
            pipe.zcard(bucket)
            pipe.expire(bucket, window_seconds + 5)
            _, _, count, _ = await pipe.execute()
    except Exception as exc:  # fail open — never block traffic on a Redis hiccup
        logger.warning("rate limiter unavailable, allowing request", extra={"error": str(exc)})
        return None

    if count > limit:
        try:
            oldest = await redis.zrange(bucket, 0, 0, withscores=True)
            if oldest:
                oldest_time = oldest[0][1]
                retry_after = max(int(oldest_time + window_seconds - now), 1)
            else:
                retry_after = window_seconds
        except Exception:
            retry_after = window_seconds

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    return count


def rate_limiter(name: str, limit: int, window_seconds: int):
    """Build a FastAPI dependency enforcing ``limit`` requests per window per client IP."""

    async def dependency(request: Request, response: Response) -> None:
        redis = getattr(request.app.state, "redis_rate_limit", getattr(request.app.state, "redis", None))
        if redis is None:
            return
        count = await enforce_rate_limit(redis, f"{name}:{client_ip(request)}", limit, window_seconds)
        if count is not None:
            remaining = max(0, limit - count)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(window_seconds)

    return dependency
