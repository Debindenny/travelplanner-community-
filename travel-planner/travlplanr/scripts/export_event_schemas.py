#!/usr/bin/env python3
"""
Export the domain event catalog and envelope as JSON Schema, so consumers
outside the Python services (frontends, other teams) have a versioned
contract to code against instead of reading services/shared/events.py.

Usage:  python scripts/export_event_schemas.py [--out event-schemas.json]

Writes a single JSON file containing:
- ``envelope``: the JSON Schema for ``DomainEvent`` (the wire format on every
  Redis Stream)
- ``event_types``: the full ``EventType`` catalog, as emitted today
- ``streams``: the Redis Stream key -> producer/consumer-group mapping
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "services"))

from shared.events import (  # noqa: E402
    CONSUMER_GROUP_PLANNER,
    CONSUMER_GROUP_REPORTING,
    STREAM_AFFILIATE,
    STREAM_AI_WORKER,
    STREAM_IDENTITY,
    STREAM_PLANNER,
    DomainEvent,
    EventType,
)

STREAMS = {
    STREAM_IDENTITY: {"producer": "identity", "consumer_groups": [CONSUMER_GROUP_REPORTING]},
    STREAM_PLANNER: {
        "producer": "planner",
        "consumer_groups": [CONSUMER_GROUP_REPORTING, CONSUMER_GROUP_PLANNER],
    },
    STREAM_AFFILIATE: {"producer": "affiliate", "consumer_groups": [CONSUMER_GROUP_REPORTING]},
    STREAM_AI_WORKER: {"producer": "planner", "consumer_groups": ["ai-worker-group"]},
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="event-schemas.json")
    args = parser.parse_args()

    registry = {
        "envelope": DomainEvent.model_json_schema(),
        "event_types": sorted(e.value for e in EventType),
        "streams": STREAMS,
    }

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = REPO_ROOT / out_path
    out_path.write_text(json.dumps(registry, indent=2, sort_keys=True))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
