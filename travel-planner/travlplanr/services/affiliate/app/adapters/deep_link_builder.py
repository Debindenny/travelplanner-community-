import os
import urllib.parse

# Public-facing base URL of the gateway, used to build the tracked redirect
# link returned to clients. Defaults to the local dev gateway.
PUBLIC_GATEWAY_URL = os.environ.get("PUBLIC_GATEWAY_URL", "http://localhost:8080")

PARTNER_IDS = {
    "travelnext": "travlplanr_tn_aff_2026",
    "tripadvisor": "travlplanr_ta_aff_2026",
    "google": "travlplanr_google_aff_2026",
    "google_routes": "travlplanr_google_aff_2026",
}


def build_deep_link(provider: str, base_url: str, params: dict) -> str:
    """Build a tracked partner deep link for a specific provider."""
    affiliate_id = PARTNER_IDS.get(provider, "travlplanr_generic_aff")

    if provider == "tripadvisor":
        params["ref"] = affiliate_id
    else:
        params["ref"] = affiliate_id

    query_string = urllib.parse.urlencode(params)
    return f"{base_url}?{query_string}"


def build_redirect_url(provider: str, raw_link: str) -> str:
    """Wrap a partner deep link behind our tracked /inventory/redirect endpoint."""
    query_string = urllib.parse.urlencode({"provider": provider, "url": raw_link})
    return f"{PUBLIC_GATEWAY_URL}/api/v1/inventory/redirect?{query_string}"
