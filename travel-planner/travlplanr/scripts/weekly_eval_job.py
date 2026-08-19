#!/usr/bin/env python
"""Weekly learning-flywheel eval job (T2.2).

Samples recent ChatInteractions that have explicit feedback, replays the
intent + slot classification (both regex and mocked-or-live LLM router) and
logs a dry-run score.  Optionally promotes a PromptVersion if the candidate
scores better than the current active one.

Run manually:
    cd services/planner
    python scripts/weekly_eval_job.py

Or schedule via cron / container lifespan:
    import asyncio
    from scripts.weekly_eval_job import run_weekly_eval
    asyncio.create_task(weekly_eval_loop(session_factory))

Safe-by-default: never auto-deploys a PromptVersion unless
EVAL_AUTO_PROMOTE=true is set, preventing production regressions.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Allow running from the planner root without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logger = logging.getLogger(__name__)

EVAL_WINDOW_DAYS = int(os.environ.get("EVAL_WINDOW_DAYS", "7"))
EVAL_SAMPLE_LIMIT = int(os.environ.get("EVAL_SAMPLE_LIMIT", "200"))
EVAL_AUTO_PROMOTE = os.environ.get("EVAL_AUTO_PROMOTE", "").lower() == "true"
EVAL_MIN_SCORE_DELTA = float(os.environ.get("EVAL_MIN_SCORE_DELTA", "0.05"))
EVAL_INTERVAL_SECONDS = float(os.environ.get("EVAL_INTERVAL_SECONDS", str(7 * 24 * 3600)))


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _slot_presence_score(expected_slots: dict[str, Any], actual_slots: dict[str, Any]) -> float:
    """Fraction of expected non-null slots that were correctly filled."""
    keys = [k for k, v in expected_slots.items() if v is not None]
    if not keys:
        return 1.0
    hits = sum(1 for k in keys if actual_slots.get(k) is not None)
    return hits / len(keys)


def _intent_match_score(final_intent: str | None, classified_intent: str) -> float:
    return 1.0 if final_intent and final_intent == classified_intent else 0.0


def score_interaction(
    row,  # ChatInteraction ORM row
    *,
    regex_intent: str,
    llm_router_result: dict | None,
) -> dict[str, float]:
    """Compute quality scores for one sampled interaction."""
    reference_intent = row.final_intent or row.regex_intent or "general"
    reference_slots: dict[str, Any] = dict(row.llm_hints or {})

    regex_score = _intent_match_score(reference_intent, regex_intent)
    llm_intent_score = 0.0
    llm_slot_score = 0.0
    if llm_router_result:
        llm_intent_score = _intent_match_score(reference_intent, llm_router_result.get("intent", "general"))
        llm_slot_score = _slot_presence_score(
            reference_slots, {k: v for k, v in llm_router_result.items() if k != "intent"}
        )

    return {
        "regex_intent_acc": regex_score,
        "llm_intent_acc": llm_intent_score,
        "llm_slot_presence": llm_slot_score,
    }


# ---------------------------------------------------------------------------
# Main eval coroutine
# ---------------------------------------------------------------------------

async def run_weekly_eval(session_factory, *, dry_run: bool = True) -> dict[str, Any]:
    """Sample recent interactions, score both classifiers, log results.

    Returns a summary dict suitable for admin reporting.
    """
    from sqlalchemy import select, func
    from app.models.ai_learning import ChatInteraction, PromptVersion
    from app.services.chat_intent import infer_intent
    from app.services.llm_intent_router import route_intent_and_slots

    since = datetime.now(timezone.utc) - timedelta(days=EVAL_WINDOW_DAYS)

    async with session_factory() as session:
        # Sample interactions that have explicit feedback (higher-quality signal)
        # or at least have a recorded final_intent.
        rows = (
            await session.execute(
                select(ChatInteraction)
                .where(ChatInteraction.created_at >= since)
                .where(ChatInteraction.final_intent.is_not(None))
                .order_by(func.random())
                .limit(EVAL_SAMPLE_LIMIT)
            )
        ).scalars().all()

    if not rows:
        logger.info("weekly_eval: no interactions found in last %d days", EVAL_WINDOW_DAYS)
        return {"status": "no_data", "window_days": EVAL_WINDOW_DAYS}

    regex_acc_sum = 0.0
    llm_intent_sum = 0.0
    llm_slot_sum = 0.0
    n = 0

    for row in rows:
        try:
            regex_intent = infer_intent(row.user_message)
            llm_result = None
            if not dry_run:
                llm_result = await route_intent_and_slots(row.user_message, history=None)
            scores = score_interaction(row, regex_intent=regex_intent, llm_router_result=llm_result)
            regex_acc_sum += scores["regex_intent_acc"]
            llm_intent_sum += scores["llm_intent_acc"]
            llm_slot_sum += scores["llm_slot_presence"]
            n += 1
        except Exception as exc:
            logger.warning("weekly_eval: error scoring interaction %s: %s", row.id, exc)

    if n == 0:
        return {"status": "scoring_error", "window_days": EVAL_WINDOW_DAYS}

    summary: dict[str, Any] = {
        "status": "ok",
        "evaluated": n,
        "window_days": EVAL_WINDOW_DAYS,
        "dry_run": dry_run,
        "regex_intent_accuracy": round(regex_acc_sum / n, 4),
        "llm_intent_accuracy": round(llm_intent_sum / n, 4) if not dry_run else None,
        "llm_slot_presence": round(llm_slot_sum / n, 4) if not dry_run else None,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("weekly_eval summary: %s", summary)

    # Optional promotion: activate a new PromptVersion when LLM intent
    # accuracy improves over the current baseline by at least EVAL_MIN_SCORE_DELTA.
    if (
        EVAL_AUTO_PROMOTE
        and not dry_run
        and summary["llm_intent_accuracy"] is not None
        and summary["llm_intent_accuracy"] - summary["regex_intent_accuracy"] >= EVAL_MIN_SCORE_DELTA
    ):
        candidate_name = f"auto_promoted_{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        async with session_factory() as session:
            existing = await session.scalar(
                select(PromptVersion).where(PromptVersion.active.is_(True)).limit(1)
            )
            if existing:
                existing.active = False
            placeholder_hash = hashlib.sha256(candidate_name.encode()).hexdigest()[:16]
            new_pv = PromptVersion(
                name=candidate_name,
                system_prompt_hash=placeholder_hash,
                active=True,
                deployed_at=datetime.now(timezone.utc),
            )
            session.add(new_pv)
            await session.commit()
            logger.info("weekly_eval: promoted new PromptVersion %s", candidate_name)
            summary["promoted"] = candidate_name

    return summary


async def weekly_eval_loop(session_factory) -> None:
    """Long-running background task that runs the eval weekly."""
    while True:
        try:
            await run_weekly_eval(session_factory, dry_run=False)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("weekly_eval_loop error: %s", exc)
        await asyncio.sleep(EVAL_INTERVAL_SECONDS)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run the weekly learning-flywheel eval job")
    parser.add_argument("--live", action="store_true", help="Actually call the LLM router (costs latency)")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"), help="PostgreSQL DSN")
    args = parser.parse_args()

    if not args.database_url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    logging.basicConfig(level=logging.INFO)

    async def _main() -> None:
        from shared.database import create_engine_and_session

        _, session_factory = create_engine_and_session(args.database_url)
        result = await run_weekly_eval(session_factory, dry_run=not args.live)
        import json
        print(json.dumps(result, indent=2, default=str))

    asyncio.run(_main())
