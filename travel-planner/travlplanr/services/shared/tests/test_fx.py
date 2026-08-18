"""Tests for shared/fx.py — conversion math, currency resolution, Frankfurter fetch."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from shared.fx import (
    FALLBACK_RATES_VS_USD,
    convert,
    convert_money_fields,
    get_rates_vs_usd,
    normalize_currency,
    resolve_target_currency,
)


def test_normalize_currency():
    assert normalize_currency("inr") == "INR"
    assert normalize_currency("GBP") is None
    assert normalize_currency(None) is None


def test_resolve_target_currency_prefers_header():
    assert resolve_target_currency("EUR", "INR") == "EUR"
    assert resolve_target_currency(None, "INR") == "INR"
    assert resolve_target_currency("bogus", None) == "USD"


def test_convert_usd_to_inr():
    rates = {"USD": 1.0, "EUR": 0.9, "INR": 100.0}
    assert convert(10, "USD", "INR", rates) == 1000.0
    assert convert(1000, "INR", "USD", rates) == 10.0
    assert convert(10, "USD", "USD", rates) == 10.0


def test_convert_money_fields_flat_inventory():
    rates = {"USD": 1.0, "EUR": 0.5, "INR": 100.0}
    items = [
        {"id": "1", "price": 100.0, "currency": "USD", "title": "Flight"},
        {"id": "2", "price": 200.0, "currency": "EUR", "taxes": 20.0},
    ]
    out = convert_money_fields(items, "INR", rates)
    assert out[0]["price"] == 10000.0
    assert out[0]["currency"] == "INR"
    assert out[1]["price"] == 40000.0  # 200 EUR -> 400 USD -> 40000 INR
    assert out[1]["taxes"] == 4000.0
    assert out[1]["currency"] == "INR"
    # Original untouched
    assert items[0]["currency"] == "USD"


def test_convert_money_fields_nested_price():
    rates = {"USD": 1.0, "EUR": 0.87, "INR": 80.0}
    obj = {"price": {"amount": 80, "currency": "INR"}, "title": "Hotel"}
    out = convert_money_fields(obj, "USD", rates)
    assert out["price"]["amount"] == 1.0
    assert out["price"]["currency"] == "USD"


def test_convert_money_fields_trip_segments():
    rates = {"USD": 1.0, "EUR": 0.87, "INR": 100.0}
    trip = {
        "id": "t1",
        "segments": [
            {"type": "flight", "price": 200, "currency": "USD"},
            {"type": "hotel", "price": 5000, "currency": "INR"},
        ],
        "days": [
            {
                "day": 1,
                "items": [{"type": "activity", "price": 50, "currency": "USD"}],
            }
        ],
    }
    out = convert_money_fields(trip, "EUR", rates)
    assert out["segments"][0]["price"] == pytest.approx(174.0)
    assert out["segments"][0]["currency"] == "EUR"
    assert out["segments"][1]["price"] == pytest.approx(43.5)  # 50 USD * 0.87
    assert out["days"][0]["items"][0]["price"] == pytest.approx(43.5)


def test_convert_rupee_string_price():
    rates = {"USD": 1.0, "EUR": 0.87, "INR": 100.0}
    pkg = {"price": "₹ 10,000", "title": "Goa"}
    out = convert_money_fields(pkg, "USD", rates, default_from="INR")
    assert out["price"] == 100.0
    assert out["currency"] == "USD"


def test_infer_inr_when_currency_missing_and_large():
    rates = {"USD": 1.0, "EUR": 0.87, "INR": 100.0}
    item = {"price": 5000, "title": "Legacy stub"}
    out = convert_money_fields(item, "USD", rates)
    assert out["price"] == 50.0
    assert out["currency"] == "USD"


def test_travelnext_missing_currency_stays_usd():
    rates = {"USD": 1.0, "EUR": 0.87, "INR": 100.0}
    item = {"price": 5000, "provider": "travelnext", "title": "Flight"}
    out = convert_money_fields(item, "INR", rates)
    assert out["price"] == 500000.0
    assert out["currency"] == "INR"


@pytest.mark.asyncio
async def test_get_rates_vs_usd_uses_cache():
    redis = AsyncMock()
    redis.get = AsyncMock(
        return_value='{"rates":{"USD":1,"EUR":0.9,"INR":90},"updatedAt":"2026-01-01T00:00:00+00:00","base":"USD"}'
    )
    data = await get_rates_vs_usd(redis)
    assert data["rates"]["INR"] == 90
    redis.get.assert_awaited()


@pytest.mark.asyncio
async def test_get_rates_vs_usd_fetches_frankfurter():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"rates": {"EUR": 0.91, "INR": 83.5}, "date": "2026-07-21"}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("shared.fx.httpx.AsyncClient", return_value=mock_client):
        data = await get_rates_vs_usd(redis)

    assert data["rates"]["EUR"] == 0.91
    assert data["rates"]["INR"] == 83.5
    assert data["rates"]["USD"] == 1.0
    redis.setex.assert_awaited()


@pytest.mark.asyncio
async def test_get_rates_fallback_on_failure():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=RuntimeError("network down"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("shared.fx.httpx.AsyncClient", return_value=mock_client):
        data = await get_rates_vs_usd(redis)

    assert data["rates"]["INR"] == FALLBACK_RATES_VS_USD["INR"]
