"""Live FX rates (Frankfurter / ECB) with Redis cache and money-field conversion.

Conversion is for outbound API responses only — never mutate stored booking
or Stripe settlement amounts.
"""

from __future__ import annotations

import copy
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SUPPORTED = frozenset({"USD", "EUR", "INR"})
DEFAULT_CURRENCY = "USD"
REDIS_KEY = "fx:usd:v1"
REDIS_STALE_KEY = "fx:usd:stale:v1"
CACHE_TTL_SECONDS = 3600
FRANKFURTER_URL = "https://api.frankfurter.app/latest"

# Used only when Redis and Frankfurter are both unavailable.
FALLBACK_RATES_VS_USD: dict[str, float] = {
    "USD": 1.0,
    "EUR": 0.87,
    "INR": 95.20,
}

_MONEY_KEYS = frozenset({"price", "cost", "amount", "base_price", "taxes", "security"})
_CURRENCY_SYMBOL_RE = re.compile(r"^([₹$€])\s*([\d.,\s\u00a0]+)$")


def normalize_currency(value: str | None) -> str | None:
    if not value:
        return None
    code = str(value).strip().upper()
    return code if code in SUPPORTED else None


def resolve_target_currency(
    header_value: str | None,
    preference: str | None = None,
) -> str:
    """Prefer X-Currency header, then profile preference, else USD."""
    return (
        normalize_currency(header_value)
        or normalize_currency(preference)
        or DEFAULT_CURRENCY
    )


def resolve_target_currency_from_request(request: Any, preference: str | None = None) -> str:
    header = None
    try:
        header = request.headers.get("x-currency") or request.headers.get("X-Currency")
    except Exception:
        header = None
    return resolve_target_currency(header, preference)


def convert(
    amount: float,
    from_currency: str,
    to_currency: str,
    rates: dict[str, float],
) -> float:
    """Convert amount between supported currencies using rates vs USD."""
    src = normalize_currency(from_currency) or DEFAULT_CURRENCY
    dst = normalize_currency(to_currency) or DEFAULT_CURRENCY
    if src == dst:
        return float(amount)
    src_rate = float(rates.get(src) or FALLBACK_RATES_VS_USD.get(src) or 1.0)
    dst_rate = float(rates.get(dst) or FALLBACK_RATES_VS_USD.get(dst) or 1.0)
    if src_rate <= 0 or dst_rate <= 0:
        return float(amount)
    usd = float(amount) / src_rate
    return usd * dst_rate


def _rates_payload(rates: dict[str, float], updated_at: str | None = None) -> dict[str, Any]:
    return {
        "rates": {k: float(rates[k]) for k in SUPPORTED if k in rates},
        "updatedAt": updated_at or datetime.now(timezone.utc).isoformat(),
        "base": "USD",
    }


async def get_rates_vs_usd(redis: Any | None = None) -> dict[str, Any]:
    """Return `{rates, updatedAt, base}` with USD=1 and live EUR/INR when possible."""
    if redis is not None:
        try:
            cached = await redis.get(REDIS_KEY)
            if cached:
                import json

                data = json.loads(cached)
                if isinstance(data, dict) and isinstance(data.get("rates"), dict):
                    return data
        except Exception as exc:
            logger.warning("fx redis read failed: %s", exc)

    rates = dict(FALLBACK_RATES_VS_USD)
    updated_at = datetime.now(timezone.utc).isoformat()
    fetched = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                FRANKFURTER_URL,
                params={"from": "USD", "to": "EUR,INR"},
            )
            resp.raise_for_status()
            body = resp.json()
            remote = body.get("rates") or {}
            if "EUR" in remote:
                rates["EUR"] = float(remote["EUR"])
            if "INR" in remote:
                rates["INR"] = float(remote["INR"])
            rates["USD"] = 1.0
            if body.get("date"):
                updated_at = f"{body['date']}T00:00:00+00:00"
            fetched = True
    except Exception as exc:
        logger.warning("frankfurter fetch failed: %s", exc)
        if redis is not None:
            try:
                import json

                stale = await redis.get(REDIS_STALE_KEY)
                if stale:
                    data = json.loads(stale)
                    if isinstance(data, dict) and isinstance(data.get("rates"), dict):
                        return data
            except Exception as stale_exc:
                logger.warning("fx stale redis read failed: %s", stale_exc)

    payload = _rates_payload(rates, updated_at)
    if redis is not None:
        try:
            import json

            raw = json.dumps(payload)
            if fetched:
                await redis.setex(REDIS_KEY, CACHE_TTL_SECONDS, raw)
            # Keep a longer-lived snapshot for provider outages.
            await redis.setex(REDIS_STALE_KEY, CACHE_TTL_SECONDS * 24 * 7, raw)
        except Exception as exc:
            logger.warning("fx redis write failed: %s", exc)
    return payload


def _parse_money_string(value: str) -> tuple[float, str] | None:
    m = _CURRENCY_SYMBOL_RE.match(value.strip())
    if not m:
        return None
    sym, num_str = m.group(1), m.group(2)
    # Whole amounts only — strip grouping separators (comma/dot/space).
    try:
        amount = float(re.sub(r"[.,\s\u00a0]", "", num_str))
    except ValueError:
        return None
    if sym == "₹":
        return amount, "INR"
    if sym == "€":
        return amount, "EUR"
    return amount, "USD"


def _convert_price_node(
    node: dict[str, Any],
    to_currency: str,
    rates: dict[str, float],
    default_from: str = DEFAULT_CURRENCY,
) -> None:
    """In-place convert a dict that holds price/currency (flat or nested)."""
    # Nested: price: { amount, currency }
    price_val = node.get("price")
    if isinstance(price_val, dict) and "amount" in price_val:
        src = normalize_currency(price_val.get("currency")) or default_from
        try:
            amt = float(price_val["amount"])
        except (TypeError, ValueError):
            return
        price_val["amount"] = round(convert(amt, src, to_currency, rates), 2)
        price_val["currency"] = to_currency
        return

    # Flat: price + currency (and optional sibling money fields)
    currency = normalize_currency(node.get("currency"))
    if not currency:
        provider = str(node.get("provider") or "").lower()
        # TravelNext / Google Routes amounts are USD even when currency was dropped.
        if provider in ("travelnext", "google_routes", "google_places", "tripadvisor"):
            currency = "USD"
        else:
            # Infer from magnitude when tags are missing (legacy AI stubs).
            try:
                probe = float(node.get("price") or node.get("base_price") or 0)
            except (TypeError, ValueError):
                probe = 0.0
            currency = "INR" if probe >= 1000 else (normalize_currency(default_from) or DEFAULT_CURRENCY)

    for key in ("price", "taxes", "security", "base_price", "amount"):
        if key not in node:
            continue
        val = node[key]
        if isinstance(val, bool) or val is None:
            continue
        if isinstance(val, (int, float)):
            node[key] = round(convert(float(val), currency, to_currency, rates), 2)
        elif isinstance(val, str):
            parsed = _parse_money_string(val)
            if parsed:
                amt, src = parsed
                node[key] = round(convert(amt, src, to_currency, rates), 2)
            else:
                try:
                    node[key] = round(convert(float(val), currency, to_currency, rates), 2)
                except ValueError:
                    pass
    if "currency" in node or any(k in node for k in ("price", "taxes", "security", "amount", "base_price")):
        node["currency"] = to_currency


def convert_money_fields(
    obj: Any,
    to_currency: str,
    rates: dict[str, float],
    *,
    default_from: str = DEFAULT_CURRENCY,
) -> Any:
    """Deep-copy and convert money fields on dicts/lists to ``to_currency``."""
    target = normalize_currency(to_currency) or DEFAULT_CURRENCY
    data = copy.deepcopy(obj)
    _walk_convert(data, target, rates, default_from)
    return data


def _walk_convert(
    obj: Any,
    to_currency: str,
    rates: dict[str, float],
    default_from: str,
) -> None:
    if isinstance(obj, list):
        for item in obj:
            _walk_convert(item, to_currency, rates, default_from)
        return
    if not isinstance(obj, dict):
        return

    # Convert this node if it looks like a money object.
    if (
        isinstance(obj.get("price"), (int, float, str, dict))
        or isinstance(obj.get("currency"), str)
        or isinstance(obj.get("base_price"), (int, float))
        or isinstance(obj.get("taxes"), (int, float))
        or isinstance(obj.get("security"), (int, float))
    ):
        _convert_price_node(obj, to_currency, rates, default_from)

    for key, value in list(obj.items()):
        if key in ("days", "segments", "cityDays", "items", "details"):
            _walk_convert(value, to_currency, rates, default_from)
        elif isinstance(value, (list, dict)) and key not in _MONEY_KEYS:
            _walk_convert(value, to_currency, rates, default_from)


async def convert_response(
    obj: Any,
    request: Any,
    redis: Any | None = None,
    *,
    preference: str | None = None,
    default_from: str = DEFAULT_CURRENCY,
) -> Any:
    """Resolve target currency from the request, load rates, convert a response copy."""
    target = resolve_target_currency_from_request(request, preference)
    payload = await get_rates_vs_usd(redis)
    rates = payload.get("rates") or FALLBACK_RATES_VS_USD
    return convert_money_fields(obj, target, rates, default_from=default_from)
