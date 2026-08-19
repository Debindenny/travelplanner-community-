"""Input-validation guards on request models (planner).

Locks the bounds added to stop negative/absurd charges, absurd traveler counts,
and empty destination lists.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.routers.checkout import CheckoutRequest
from app.routers.trips import TripCreateBody


def _trip(**overrides):
    base = dict(
        destinations=["Paris"],
        startDate="2026-01-01",
        endDate="2026-01-05",
        travelers=2,
        travelStyle="relaxed",
        travelMethod="flight",
        budget="mid",
        interests=[],
        foodPreferences=[],
    )
    base.update(overrides)
    return base


def test_checkout_amount_must_be_positive_and_bounded():
    assert CheckoutRequest(amount=100.0).amount == 100.0
    for bad in (0, -5, 2_000_000):
        with pytest.raises(ValidationError):
            CheckoutRequest(amount=bad)


def test_trip_travelers_bounds():
    assert TripCreateBody(**_trip(travelers=2)).travelers == 2
    for bad in (0, -1, 51):
        with pytest.raises(ValidationError):
            TripCreateBody(**_trip(travelers=bad))


def test_trip_requires_at_least_one_destination():
    with pytest.raises(ValidationError):
        TripCreateBody(**_trip(destinations=[]))


def test_trip_coverage_tier_defaults_full():
    body = TripCreateBody(**_trip())
    assert body.coverageTier == "full"


def test_trip_coverage_tier_accepts_draft():
    body = TripCreateBody(**_trip(coverageTier="draft"))
    assert body.coverageTier == "draft"
