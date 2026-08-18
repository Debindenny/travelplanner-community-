"""
Pure-logic tests for collaborative itinerary helpers.

No DB / Redis / network — all pure functions from the collaboration router.
Tests cover:
  - Equal share distribution (including last-cent remainder)
  - Custom share validation (sum must equal total)
  - Percentage share conversion (rounding remainder to last member)
  - Balance simplification (net who-owes-whom)
  - Permission role ordering helper
"""
from __future__ import annotations

import uuid
import pytest

from app.routers.collaboration import (
    compute_equal_shares,
    compute_custom_shares,
    compute_percentage_shares,
    compute_balances,
    ROLE_ORDER,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def uid(n: int) -> uuid.UUID:
    return uuid.UUID(f"00000000-0000-0000-0000-{n:012d}")


# ===========================================================================
# compute_equal_shares
# ===========================================================================

def test_equal_shares_even_split():
    members = [uid(1), uid(2), uid(3)]
    shares = compute_equal_shares(300, members)
    assert shares == {uid(1): 100, uid(2): 100, uid(3): 100}


def test_equal_shares_remainder_goes_to_last():
    # 10 cents split 3 ways: 3+3+4 (remainder = 1 → last member)
    members = [uid(1), uid(2), uid(3)]
    shares = compute_equal_shares(10, members)
    assert shares[uid(1)] == 3
    assert shares[uid(2)] == 3
    assert shares[uid(3)] == 4
    assert sum(shares.values()) == 10


def test_equal_shares_single_member():
    shares = compute_equal_shares(999, [uid(1)])
    assert shares == {uid(1): 999}


def test_equal_shares_empty_members():
    assert compute_equal_shares(500, []) == {}


def test_equal_shares_two_members():
    members = [uid(1), uid(2)]
    shares = compute_equal_shares(7, members)
    assert sum(shares.values()) == 7
    assert shares[uid(1)] == 3
    assert shares[uid(2)] == 4


# ===========================================================================
# compute_custom_shares
# ===========================================================================

def test_custom_shares_valid():
    custom = {str(uid(1)): 200, str(uid(2)): 300}
    shares = compute_custom_shares(500, custom)
    assert shares == {uid(1): 200, uid(2): 300}


def test_custom_shares_sum_mismatch_raises():
    custom = {str(uid(1)): 200, str(uid(2)): 200}  # sums to 400, not 500
    with pytest.raises(ValueError, match="sum 400 != total 500"):
        compute_custom_shares(500, custom)


def test_custom_shares_zero_total_exact():
    custom = {str(uid(1)): 0, str(uid(2)): 0}
    shares = compute_custom_shares(0, custom)
    assert all(v == 0 for v in shares.values())


# ===========================================================================
# compute_percentage_shares
# ===========================================================================

def test_percentage_shares_50_50():
    pcts = {str(uid(1)): 50.0, str(uid(2)): 50.0}
    shares = compute_percentage_shares(200, pcts)
    assert shares == {uid(1): 100, uid(2): 100}


def test_percentage_shares_rounding_correct():
    # 10 cents split 33.33/33.33/33.34 — last member absorbs rounding
    pcts = {str(uid(1)): 33.33, str(uid(2)): 33.33, str(uid(3)): 33.34}
    shares = compute_percentage_shares(10, pcts)
    assert sum(shares.values()) == 10


def test_percentage_shares_not_100_raises():
    pcts = {str(uid(1)): 60.0, str(uid(2)): 30.0}  # 90%
    with pytest.raises(ValueError, match="90"):
        compute_percentage_shares(100, pcts)


def test_percentage_shares_100_percent_single():
    pcts = {str(uid(1)): 100.0}
    shares = compute_percentage_shares(777, pcts)
    assert shares == {uid(1): 777}


# ===========================================================================
# compute_balances
# ===========================================================================

def _make_expense(paid_by: uuid.UUID, amount: int, shares: dict[uuid.UUID, int]) -> dict:
    return {
        "paid_by": paid_by,
        "amount_cents": amount,
        "shares": [{"user_id": uid, "share_cents": cents} for uid, cents in shares.items()],
    }


def test_balances_simple_two_person():
    # A paid 200; A owes 100, B owes 100 → B owes A 100
    a, b = uid(1), uid(2)
    exp = _make_expense(a, 200, {a: 100, b: 100})
    settlements = compute_balances([exp])
    assert len(settlements) == 1
    s = settlements[0]
    assert s["from"] == str(b)
    assert s["to"] == str(a)
    assert s["amount_cents"] == 100


def test_balances_three_person_equal():
    # A pays 300, split equally (100 each)
    a, b, c = uid(1), uid(2), uid(3)
    exp = _make_expense(a, 300, {a: 100, b: 100, c: 100})
    settlements = compute_balances([exp])
    # A is owed 200 total; B and C each owe 100
    total_owed = sum(s["amount_cents"] for s in settlements)
    assert total_owed == 200
    assert all(s["to"] == str(a) for s in settlements)


def test_balances_already_settled_is_zero():
    a = uid(1)
    exp = _make_expense(a, 100, {a: 100})
    settlements = compute_balances([exp])
    assert settlements == []


def test_balances_multiple_expenses_net_out():
    # A pays 100 (B owes 50), B pays 100 (A owes 50) → net = 0
    a, b = uid(1), uid(2)
    exp1 = _make_expense(a, 100, {a: 50, b: 50})
    exp2 = _make_expense(b, 100, {a: 50, b: 50})
    settlements = compute_balances([exp1, exp2])
    assert settlements == []


def test_balances_empty_expenses():
    assert compute_balances([]) == []


# ===========================================================================
# Role ordering
# ===========================================================================

def test_role_order_hierarchy():
    assert ROLE_ORDER["owner"] > ROLE_ORDER["editor"] > ROLE_ORDER["viewer"]


def test_role_order_missing_role_is_zero():
    assert ROLE_ORDER.get("superadmin", 0) == 0
