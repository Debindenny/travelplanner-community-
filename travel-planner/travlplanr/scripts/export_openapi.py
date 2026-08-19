#!/usr/bin/env python3
"""
Export each FastAPI service's OpenAPI schema to a static JSON file, without
starting a server. Used as the first stage of the OpenAPI -> TypeScript
codegen pipeline (see apps/web/scripts/codegen-api.mjs).

Usage:  python scripts/export_openapi.py [--out-dir openapi]

Each service's app is imported directly (``app.main:app``) and
``app.openapi()`` is dumped to ``<out-dir>/<service>.json``. Services that
have no HTTP API (e.g. ai-worker, a pure Redis Streams consumer) are skipped.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from pathlib import Path

# This is a dev-time codegen tool that imports each service's app module
# without a real deployment env; ServiceSettings requires secure secrets
# outside dev/test environments, so force dev mode unless already set.
os.environ.setdefault("ENVIRONMENT", "development")

REPO_ROOT = Path(__file__).resolve().parent.parent
SERVICES_DIR = REPO_ROOT / "services"

# Services that expose an HTTP API (and therefore an OpenAPI schema).
# ai-worker and shared are intentionally excluded — no FastAPI app.
HTTP_SERVICES = ["identity", "planner", "affiliate", "reporting"]


def export_service(name: str, out_dir: Path) -> None:
    service_root = SERVICES_DIR / name
    sys.path.insert(0, str(service_root))
    sys.path.insert(0, str(SERVICES_DIR))
    try:
        main = importlib.import_module("app.main")
        schema = main.app.openapi()
    finally:
        sys.path.pop(0)
        sys.path.pop(0)
        sys.modules.pop("app.main", None)
        # Drop every "app.*" submodule so the next service's `app` package
        # (same dotted name, different directory) reimports cleanly.
        for mod in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
            sys.modules.pop(mod, None)

    out_path = out_dir / f"{name}.json"
    out_path.write_text(json.dumps(schema, indent=2, sort_keys=True))
    print(f"wrote {out_path.relative_to(REPO_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="openapi")
    args = parser.parse_args()

    out_dir = REPO_ROOT / args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    for service in HTTP_SERVICES:
        export_service(service, out_dir)


if __name__ == "__main__":
    main()
