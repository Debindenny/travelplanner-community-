"""Tests for AI learning flywheel helpers."""

from __future__ import annotations

from app.models.ai_learning import ActivityAcceptanceStat
from app.services.chat_learning_service import acceptance_score, _normalize_key


def test_normalize_key():
    assert _normalize_key("  Sydney Opera  ") == "sydney opera"


def test_acceptance_score_favors_kept_and_booked():
    stat = ActivityAcceptanceStat(
        city_normalized="sydney",
        title_normalized="opera tour",
        budget_tier="standard",
        times_suggested=10,
        times_kept=8,
        times_removed=1,
        times_swapped=0,
        times_booked=2,
    )
    assert acceptance_score(stat) > 0.5


def test_acceptance_score_penalizes_removals():
    bad = ActivityAcceptanceStat(
        city_normalized="sydney",
        title_normalized="bad tour",
        budget_tier="standard",
        times_suggested=5,
        times_kept=0,
        times_removed=4,
        times_swapped=1,
        times_booked=0,
    )
    assert acceptance_score(bad) < 0
