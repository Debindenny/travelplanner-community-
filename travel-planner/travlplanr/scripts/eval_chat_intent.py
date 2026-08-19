#!/usr/bin/env python3
"""Evaluate chat intent parser against the golden dataset.

Run from services/planner:
  python3 scripts/eval_chat_intent.py

Exit code 0 when all cases pass; 1 otherwise. Suitable for CI nightly jobs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.chat_intent import parse_itinerary_edits  # noqa: E402

GOLDEN = ROOT / "data" / "chat_intent_golden.json"


def _check_case(message: str, expected: dict) -> list[str]:
    errors: list[str] = []
    edits = parse_itinerary_edits(message)
    if not edits:
        return [f"{message!r}: expected edits, got []"]
    edit = edits[0]
    if edit.get("edit") != expected.get("edit"):
        errors.append(f"{message!r}: edit={edit.get('edit')!r} expected {expected.get('edit')!r}")
    if "day" in expected and edit.get("day") != expected["day"]:
        errors.append(f"{message!r}: day={edit.get('day')!r} expected {expected['day']!r}")
    if expected.get("autoSuggest") and not edit.get("autoSuggest"):
        errors.append(f"{message!r}: expected autoSuggest")
    if "title" in expected and edit.get("title") != expected["title"]:
        errors.append(f"{message!r}: title={edit.get('title')!r} expected {expected['title']!r}")
    if "titleMatch" in expected and edit.get("titleMatch") != expected["titleMatch"]:
        errors.append(f"{message!r}: titleMatch mismatch")
    if "transportType" in expected and edit.get("transportType") != expected["transportType"]:
        errors.append(f"{message!r}: transportType mismatch")
    if "count" in expected and edit.get("count") != expected["count"]:
        errors.append(f"{message!r}: count={edit.get('count')} expected {expected['count']}")
    if expected.get("min_count") and (edit.get("count") or 0) < expected["min_count"]:
        errors.append(f"{message!r}: count too low")
    if expected.get("autoSuggest") and "title" in edit:
        errors.append(f"{message!r}: generic ask must not produce title={edit['title']!r}")
    return errors


def main() -> int:
    cases = json.loads(GOLDEN.read_text())
    failures: list[str] = []
    for case in cases:
        failures.extend(_check_case(case["message"], case["expected"]))
    if failures:
        print(f"FAILED {len(failures)} / {len(cases)} cases")
        for f in failures:
            print(" -", f)
        return 1
    print(f"OK — {len(cases)} golden cases passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
