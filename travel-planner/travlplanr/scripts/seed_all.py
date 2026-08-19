#!/usr/bin/env python3
"""
Run all sample-data seeds in the correct order for local / Docker dev.

Usage:
  python scripts/seed_all.py              # skip if customers already exist
  python scripts/seed_all.py --force      # re-seed identity+planner core data
  DOCKER=true python scripts/seed_all.py    # use postgres hostname inside containers

After running, log into admin at http://localhost:4202/login
  Email: admin@travlplanr.com  Password: password123
(or admin@travlplanr.com / password via auth seed endpoint)
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"


def run_script(name: str, extra_env: dict | None = None) -> None:
    env = os.environ.copy()
    env.setdefault("PYTHONPATH", str(ROOT))
    if extra_env:
        env.update(extra_env)
    path = SCRIPTS / name
    print(f"\n=== Running {name} ===")
    subprocess.run([sys.executable, str(path)], cwd=str(ROOT), env=env, check=True)


def run_auth_seed() -> None:
    import urllib.request

    url = "http://localhost:8080/api/v1/auth/seed?secret=dev-seed-secret&reset=true"
    print(f"\n=== Auth admin seed: {url} ===")
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            print(resp.read().decode())
    except Exception as exc:
        print(f"Auth seed skipped (gateway may be down): {exc}")


async def maybe_force_clear(force: bool) -> None:
    if not force:
        return
    print("\n=== Force mode: clearing planner inventory/packages optional re-run ===")
    # seed_data.py skips if >5 users — force handled by env flag
    os.environ["SEED_FORCE"] = "true"


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed all TravlPlanr sample data")
    parser.add_argument("--force", action="store_true", help="Re-run core seed even if DB has data")
    parser.add_argument("--docker", action="store_true", help="Use postgres hostname for DB URLs")
    args = parser.parse_args()

    docker_env = {"DOCKER": "true"} if args.docker else {}
    if args.force:
        docker_env["SEED_FORCE"] = "true"

    run_auth_seed()

    # Full seed: identity, planner, affiliate, reporting + packages/inventory/backfill
    run_script("seed_comprehensive.py", {**docker_env, "SEED_FORCE": "true"} if args.force else docker_env)

    print("\n✅ All sample data seeded.")
    print("Admin: http://localhost:4202  → Dashboard, Itinerary, Inventory tabs")
    print("Customer: http://localhost:4201 → Packages → View Itinerary Plan")


if __name__ == "__main__":
    main()
