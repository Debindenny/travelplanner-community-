"""
Shared structured logging for all Travlplanr services.

Call ``configure_logging(...)`` once at service startup, then use
``logging.getLogger(__name__)`` (or the ``get_logger`` helper) everywhere.
Structured context is attached per-call via the standard ``extra=`` kwarg::

    logger.info("generation completed", extra={"trip_id": trip_id, "ms": elapsed})

Outside development this emits one JSON object per line for log aggregation;
in development it emits a compact human-readable line.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

# Standard LogRecord attributes we never want to duplicate into the JSON body;
# everything else attached via ``extra=`` is treated as structured context.
_RESERVED = frozenset(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    """Render each log record as a single line of JSON."""

    def __init__(self, service_name: str, environment: str) -> None:
        super().__init__()
        self.service_name = service_name
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "service": self.service_name,
            "environment": self.environment,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = self.formatStack(record.stack_info)
        return json.dumps(payload, default=str)


class ConsoleFormatter(logging.Formatter):
    """Human-readable formatter for local development, with extra context appended."""

    def __init__(self, service_name: str) -> None:
        super().__init__(
            fmt="%(asctime)s %(levelname)-7s [{svc}] %(name)s: %(message)s".format(
                svc=service_name
            ),
            datefmt="%H:%M:%S",
        )

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        extras = {
            k: v
            for k, v in record.__dict__.items()
            if k not in _RESERVED and not k.startswith("_")
        }
        if extras:
            base += " " + " ".join(f"{k}={v}" for k, v in extras.items())
        return base


def configure_logging(
    service_name: str,
    level: str = "INFO",
    environment: str = "development",
    json_logs: bool | None = None,
) -> None:
    """Install a single stdout handler on the root logger. Idempotent.

    ``json_logs`` overrides the format; when None, JSON is used outside
    development.
    """
    use_json = json_logs if json_logs is not None else environment.lower() != "development"

    root = logging.getLogger()
    root.setLevel(level.upper())

    # Replace any handlers we previously installed so repeat calls don't duplicate output.
    for handler in list(root.handlers):
        if getattr(handler, "_travlplanr", False):
            root.removeHandler(handler)

    handler = logging.StreamHandler()
    handler._travlplanr = True  # type: ignore[attr-defined]
    handler.setFormatter(
        JsonFormatter(service_name, environment)
        if use_json
        else ConsoleFormatter(service_name)
    )
    root.addHandler(handler)

    # Route uvicorn through our handlers instead of its own duplicate ones.
    for noisy in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(noisy)
        lg.handlers.clear()
        lg.propagate = True

    logging.getLogger(__name__).debug(
        "logging configured", extra={"json": use_json, "level": level.upper()}
    )


def get_logger(name: str) -> logging.Logger:
    """Thin convenience wrapper around ``logging.getLogger``."""
    return logging.getLogger(name)
