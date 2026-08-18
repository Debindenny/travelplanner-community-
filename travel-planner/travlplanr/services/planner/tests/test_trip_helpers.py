"""Pure-logic tests for the trip helpers in planner/app/routers/trips.py.

No DB/Redis/network — these are plain functions that decide trip duration and
reconcile headcount with the chosen travel style. They feed the
GENERATION_REQUESTED payload, so a regression silently corrupts every itinerary.
"""
from __future__ import annotations

from app.routers.trips import _trip_duration_days, _travelers_from_style


def test_duration_from_city_nights_sums_plus_one():
    # nights sum (2 + 3) + 1 = 6
    city_days = [{"nights": 2}, {"nights": 3}]
    assert _trip_duration_days(city_days, "2026-01-01", "2026-01-05") == 6


def test_duration_city_days_clamps_nights_to_min_one():
    # nights of 0 / missing are floored to 1 each: (1 + 1) + 1 = 3
    city_days = [{"nights": 0}, {}]
    assert _trip_duration_days(city_days, "2026-01-01", "2026-01-02") == 3


def test_duration_city_days_takes_precedence_over_dates():
    # When city_days present, dates are ignored entirely.
    city_days = [{"nights": 1}]
    assert _trip_duration_days(city_days, "2026-01-01", "2026-12-31") == 2


def test_duration_from_explicit_dates_inclusive():
    # Jan 1 -> Jan 5 is (4 days diff) + 1 = 5 inclusive days.
    assert _trip_duration_days(None, "2026-01-01", "2026-01-05") == 5


def test_duration_from_dates_same_day_is_one():
    assert _trip_duration_days(None, "2026-01-01", "2026-01-01") == 1


def test_duration_empty_city_days_falls_through_to_dates():
    # Empty list is falsy -> uses the date path.
    assert _trip_duration_days([], "2026-01-01", "2026-01-03") == 3


def test_duration_bad_date_returns_fallback_four():
    assert _trip_duration_days(None, "not-a-date", "also-bad") == 4
    assert _trip_duration_days(None, "", "") == 4


def test_travelers_style_mapping():
    assert _travelers_from_style("solo", 9) == 1
    assert _travelers_from_style("couple", 9) == 2
    assert _travelers_from_style("family", 9) == 4
    assert _travelers_from_style("friends", 9) == 2


def test_travelers_style_is_case_insensitive():
    assert _travelers_from_style("SOLO", 5) == 1
    assert _travelers_from_style("Family", 5) == 4


def test_travelers_unknown_style_uses_passed_count():
    assert _travelers_from_style("business", 3) == 3
    assert _travelers_from_style("adventure", 7) == 7


def test_travelers_always_at_least_one():
    assert _travelers_from_style(None, 0) == 1
    assert _travelers_from_style("", -5) == 1
    assert _travelers_from_style("unknown", 0) == 1
