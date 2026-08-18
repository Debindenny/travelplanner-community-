"""Image search service with Unsplash, Wikipedia, and curated fallbacks."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
IMAGE_FALLBACK_CACHE_TTL_SECONDS = int(os.environ.get("IMAGE_FALLBACK_CACHE_TTL_SECONDS", "86400"))
UNSPLASH_TIMEOUT_SECONDS = float(os.environ.get("UNSPLASH_TIMEOUT_SECONDS", "5.0"))

CURATED_IMAGES = [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
    "https://images.unsplash.com/photo-1476514525535-ce74f458649d",
    "https://images.unsplash.com/photo-1503220317375-aaad61436b1b",
    "https://images.unsplash.com/photo-1530789253388-582c481c54b0",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "https://images.unsplash.com/photo-1519681393784-d120267933ba",
]


async def _search_wikipedia_images(query: str, limit: int = 4) -> list[dict[str, Any]]:
    """Fetch place images from Wikipedia Commons API."""
    if not query:
        return []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "format": "json",
                    "generator": "search",
                    "gpssearch": query,
                    "gpslimit": limit,
                    "prop": "pageimages",
                    "piprop": "original",
                },
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            pages = data.get("query", {}).get("pages", {})
            results = []
            for page in pages.values():
                original = page.get("original", {})
                source_url = original.get("source")
                if source_url:
                    results.append(
                        {
                            "url": source_url,
                            "alt": page.get("title", query),
                            "source": "wikipedia",
                        }
                    )
            return results[:limit]
    except Exception as exc:
        logger.warning("Wikipedia image search failed for %r: %s", query, exc)
        return []


def _get_curated_fallback(query: str, limit: int = 4) -> list[dict[str, Any]]:
    results = []
    for i in range(limit):
        base_url = CURATED_IMAGES[i % len(CURATED_IMAGES)]
        url = f"{base_url}?auto=format&fit=crop&w=1200&q=80"
        results.append(
            {
                "url": url,
                "alt": f"{query} {i + 1}",
                "source": "curated",
                "photographer": "Unsplash Community",
                "photographer_url": "https://unsplash.com",
            }
        )
    return results


async def search_images_async(
    query: str,
    destination: Optional[str] = None,
    limit: int = 4,
    *,
    redis: Any = None,
    exact_place: bool = False,
) -> list[dict[str, Any]]:
    """Search for images with Unsplash, Wikipedia, and curated fallbacks."""
    q = (query or "").strip()
    if not q:
        return _get_curated_fallback(q or "travel", limit)

    cache_key = f"img_search:{exact_place}:{limit}:{destination}:{q}"
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    results: list[dict[str, Any]] = []

    if exact_place:
        try:
            results = await _search_wikipedia_images(q, limit)
        except Exception:
            results = []

    if not results and UNSPLASH_ACCESS_KEY:
        try:
            search_query = f"{q} {destination}".strip() if destination else q
            async with httpx.AsyncClient(timeout=UNSPLASH_TIMEOUT_SECONDS) as client:
                resp = await client.get(
                    "https://api.unsplash.com/search/photos",
                    params={
                        "query": search_query,
                        "per_page": limit,
                        "orientation": "landscape",
                        "content_filter": "high",
                    },
                    headers={
                        "Accept-Version": "v1",
                        "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                items = data.get("results") or []
                for item in items:
                    urls = item.get("urls") or {}
                    img_url = urls.get("regular") or urls.get("small") or urls.get("full")
                    user = item.get("user") or {}
                    user_links = user.get("links") or {}
                    if img_url:
                        results.append(
                            {
                                "url": img_url,
                                "alt": item.get("alt_description") or item.get("description") or q,
                                "source": "unsplash",
                                "photographer": user.get("name") or "Unsplash",
                                "photographer_url": user_links.get("html") or "https://unsplash.com",
                            }
                        )
        except Exception as exc:
            logger.warning("Unsplash API search failed for %r: %s", q, exc)
            results = []

    if not results:
        results = _get_curated_fallback(q, limit)

    results = results[:limit]

    if redis:
        try:
            await redis.setex(cache_key, IMAGE_FALLBACK_CACHE_TTL_SECONDS, json.dumps(results))
        except Exception:
            pass

    return results