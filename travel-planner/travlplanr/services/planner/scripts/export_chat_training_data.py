#!/usr/bin/env python3
"""Export labeled chat interactions for offline fine-tuning / review.

Run from services/planner (requires DATABASE_URL):
  python3 scripts/export_chat_training_data.py --output training_export.jsonl

Only exports interactions with explicit thumbs-up or successful modify_itinerary
outcomes. PII scrubbing is minimal — review before external fine-tuning.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402
from shared.database import create_engine_and_session  # noqa: E402
from app.models.ai_learning import ChatInteraction  # noqa: E402

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")


def _scrub(text: str) -> str:
    return _EMAIL_RE.sub("[email]", text or "")


async def export(output: Path, limit: int) -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1
    engine, session_factory = create_engine_and_session(url)
    count = 0
    try:
        async with session_factory() as session:
            rows = (
                await session.execute(
                    select(ChatInteraction)
                    .where(
                        (ChatInteraction.explicit_feedback == "up")
                        | (
                            (ChatInteraction.final_intent == "modify_itinerary")
                            & (ChatInteraction.outcome_status == "applied")
                        )
                    )
                    .order_by(ChatInteraction.created_at.desc())
                    .limit(limit)
                )
            ).scalars().all()
            with output.open("w") as f:
                for row in rows:
                    record = {
                        "user_message": _scrub(row.user_message),
                        "assistant_reply": _scrub(row.assistant_reply),
                        "regex_intent": row.regex_intent,
                        "final_intent": row.final_intent,
                        "parsed_edits": row.parsed_edits,
                        "actions_emitted": row.actions_emitted,
                        "shadow_llm_edits": row.shadow_llm_edits,
                        "explicit_feedback": row.explicit_feedback,
                        "region": row.region,
                    }
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    count += 1
    finally:
        await engine.dispose()
    print(f"Exported {count} rows to {output}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("chat_training_export.jsonl"))
    parser.add_argument("--limit", type=int, default=5000)
    return asyncio.run(export(parser.parse_args().output, parser.parse_args().limit))


if __name__ == "__main__":
    raise SystemExit(main())
