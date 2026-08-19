"""Public, non-secret client config (browser Maps key, feature flags)."""

from __future__ import annotations

import os

from fastapi import APIRouter, Request

from shared.fx import get_rates_vs_usd

router = APIRouter()


@router.get("/public-config")
async def public_config(request: Request):
    """Values safe to expose to the Angular SPA.

    `googleMapsBrowserKey` should be a Maps JavaScript API key restricted by
    HTTP referrer — never reuse an IP-restricted server Places key in production.

    `exchangeRates` is for observability only — the SPA must not use it for math;
    money endpoints convert server-side from the X-Currency header.
    """
    redis = getattr(request.app.state, "redis", None)
    fx = await get_rates_vs_usd(redis)
    return {
        "googleMapsBrowserKey": (
            os.environ.get("GOOGLE_MAPS_BROWSER_KEY")
            or os.environ.get("GOOGLE_MAPS_API_KEY")
            or ""
        ).strip(),
        "googleOAuthClientId": (
            os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
            or os.environ.get("GOOGLE_CLIENT_ID")
            or ""
        ).strip(),
        "exchangeRates": fx.get("rates") or {},
        "ratesUpdatedAt": fx.get("updatedAt"),
    }
