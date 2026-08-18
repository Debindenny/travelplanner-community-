"""Tests for shared/circuit_breaker.py."""
from __future__ import annotations

import pytest

from shared.circuit_breaker import CircuitBreaker, CircuitBreakerOpen


@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_threshold():
    breaker = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=60.0)

    async def fail():
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        await breaker.call(fail)
    with pytest.raises(RuntimeError):
        await breaker.call(fail)
    with pytest.raises(CircuitBreakerOpen):
        await breaker.call(fail)


@pytest.mark.asyncio
async def test_circuit_breaker_resets_on_success():
    breaker = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=60.0)

    async def fail():
        raise RuntimeError("boom")

    async def ok():
        return "ok"

    with pytest.raises(RuntimeError):
        await breaker.call(fail)
    assert await breaker.call(ok) == "ok"
    with pytest.raises(RuntimeError):
        await breaker.call(fail)
    assert not breaker.is_open()
