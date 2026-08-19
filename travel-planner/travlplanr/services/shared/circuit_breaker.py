"""Lightweight async circuit breaker for external API calls."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


class CircuitBreakerOpen(Exception):
    """Raised when the breaker is open and calls are short-circuited."""


@dataclass
class CircuitBreaker:
    name: str
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    _failures: int = 0
    _opened_at: float | None = field(default=None, repr=False)

    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        if time.monotonic() - self._opened_at >= self.recovery_timeout:
            return False
        return True

    def record_success(self) -> None:
        self._failures = 0
        self._opened_at = None

    def record_failure(self) -> None:
        self._failures += 1
        if self._failures >= self.failure_threshold:
            self._opened_at = time.monotonic()

    async def call(self, fn: Callable[[], Awaitable[T]]) -> T:
        if self.is_open():
            raise CircuitBreakerOpen(f"{self.name} circuit breaker is open")
        try:
            result = await fn()
        except Exception:
            self.record_failure()
            raise
        self.record_success()
        return result
