"""Unsplash image backfill for inventory items missing photos."""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Optional
from urllib.parse import quote_plus

import httpx

logger = logging.getLogger(__name__)

UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
UNSPLASH_TIMEOUT = float(os.environ.get("UNSPLASH_TIMEOUT_SECONDS", "6"))


async def search_photo(query: str, *, orientation: str = "landscape") -> Optional[str]:
    """Return a single Unsplash regular-size photo URL for the query, or None."""
    q = (query or "").strip()
    if not UNSPLASH_ACCESS_KEY or not q:
        return None

    try:
        async with httpx.AsyncClient(timeout=UNSPLASH_TIMEOUT) as client:
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                params={
                    "query": q,
                    "per_page": 1,
                    "orientation": orientation,
                    "content_filter": "high",
                },
                headers={
                    "Accept-Version": "v1",
                    "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}",
                },
            )
            if resp.status_code != 200:
                logger.warning("Unsplash search HTTP %s for %r", resp.status_code, q[:60])
                return None
            results = resp.json().get("results") or []
            if not results:
                return None
            urls = results[0].get("urls") or {}
            return urls.get("regular") or urls.get("small") or urls.get("full")
    except Exception as exc:
        logger.warning("Unsplash search failed for %r: %s", q[:60], exc)
        return None


async def fill_missing_images(
    items: list,
    *,
    location: Optional[str] = None,
    limit: int = 6,
) -> list:
    """Attach Unsplash photos to inventory items that lack image_url (in place)."""
    if not UNSPLASH_ACCESS_KEY or not items:
        return items

    filled = 0
    for item in items:
        if filled >= limit:
            break
        if getattr(item, "image_url", None):
            continue
        title = getattr(item, "title", "") or ""
        query = f"{title} {location or ''}".strip() or title
        url = await search_photo(query)
        if not url:
            # Broader city fallback once per miss.
            if location:
                url = await search_photo(f"{location} travel landmark")
        if url:
            item.image_url = url
            details = getattr(item, "details", None)
            if isinstance(details, dict):
                details.setdefault("photo", url)
                details["image_source"] = "unsplash"
            filled += 1
    return items


def cache_key_for_query(query: str) -> str:
    digest = hashlib.sha1(query.encode("utf-8")).hexdigest()[:16]
    return f"unsplash:{digest}:{quote_plus(query)[:40]}"
