from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
import asyncio
import urllib.parse
from datetime import datetime, timedelta, timezone
from fastapi import Request
from fastapi.responses import RedirectResponse
import logging

logger = logging.getLogger(__name__)


def _normalize_search_date(date: Optional[str]) -> Optional[str]:
    """Pin omitted dates to tomorrow so Redis cache keys match TravelNext defaults."""
    if date:
        try:
            return datetime.strptime(date[:10], "%Y-%m-%d").date().isoformat()
        except ValueError:
            pass
    return (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()

# Hostnames affiliate deep links are allowed to redirect to. Update this list
# alongside app/adapters/providers/* whenever a new partner integration is added
# — an unlisted host is rejected rather than silently redirected to.
ALLOWED_REDIRECT_HOSTS = {
    "www.google.com",
    "maps.google.com",
    "www.google.co.in",
    "www.tripadvisor.com",
    "tripadvisor.com",
    "travelnext.works",
    "www.travelnext.works",
}

async def get_redis(request: Request):
    return request.app.state.redis

from app.adapters import inventory_manager
from app.adapters.providers.tripadvisor import recommend_places
from app.adapters.providers import google_places
from app.adapters.providers import google_routes
from app.schemas.inventory import InventoryItem
from pydantic import BaseModel, Field
from shared.fx import convert_response

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/places/autocomplete")
async def places_autocomplete(
    q: str = Query(..., min_length=2, max_length=200, description="Partial destination query"),
    limit: int = Query(6, ge=1, le=12),
    types: str = Query("(cities)", description="Places Autocomplete types filter"),
    redis=Depends(get_redis),
    request: Request = None,
):
    """Google Places Autocomplete — server-side key, for destination typeahead."""
    if request:
        client_ip = request.client.host
        rl_key = f"rl:inventory:places_ac:{client_ip}"
        pipe = redis.pipeline()
        pipe.incr(rl_key)
        pipe.expire(rl_key, 60)
        results = await pipe.execute()
        if results[0] > 60:
            raise HTTPException(status_code=429, detail="Too Many Requests")

    cache_key = f"inventory:places_ac:{q.strip().lower()}:{types}:{limit}"
    cached = await redis.get(cache_key)
    if cached:
        import json

        return json.loads(cached)

    rows = await google_places.autocomplete_places(q, limit=limit, types=types)
    import json

    await redis.setex(cache_key, 600 if rows else 60, json.dumps(rows))
    return rows


@router.get("/places/details")
async def places_details(
    place_id: str = Query(..., min_length=3, max_length=256),
    redis=Depends(get_redis),
    request: Request = None,
):
    """Google Place Details — geometry, hours, rating, photo."""
    if request:
        client_ip = request.client.host
        rl_key = f"rl:inventory:places_details:{client_ip}"
        pipe = redis.pipeline()
        pipe.incr(rl_key)
        pipe.expire(rl_key, 60)
        results = await pipe.execute()
        if results[0] > 40:
            raise HTTPException(status_code=429, detail="Too Many Requests")

    cache_key = f"inventory:places_details:{place_id.strip()}"
    cached = await redis.get(cache_key)
    if cached:
        import json

        return json.loads(cached)

    details = await google_places.get_place_details(place_id)
    if not details:
        raise HTTPException(status_code=404, detail="Place not found")
    import json

    await redis.setex(cache_key, 3600, json.dumps(details))
    return details


class RouteBody(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    travel_mode: str = Field(default="DRIVE", description="DRIVE, WALK, BICYCLE, TRANSIT, TWO_WHEELER")


@router.post("/routes/compute")
async def compute_route(body: RouteBody, redis=Depends(get_redis), request: Request = None):
    """Google Routes API — duration/distance between two coordinates."""
    if request:
        client_ip = request.client.host
        rl_key = f"rl:inventory:routes:{client_ip}"
        pipe = redis.pipeline()
        pipe.incr(rl_key)
        pipe.expire(rl_key, 60)
        results = await pipe.execute()
        if results[0] > 40:
            raise HTTPException(status_code=429, detail="Too Many Requests")

    result = await google_routes.compute_route(
        body.origin_lat,
        body.origin_lng,
        body.dest_lat,
        body.dest_lng,
        travel_mode=body.travel_mode,
    )
    if not result:
        raise HTTPException(status_code=502, detail="Route computation unavailable")
    return result


@router.get("/timezone")
async def timezone_lookup(
    lat: float = Query(...),
    lng: float = Query(...),
    redis=Depends(get_redis),
    request: Request = None,
):
    """Google Time Zone API for a lat/lng."""
    if request:
        client_ip = request.client.host
        rl_key = f"rl:inventory:timezone:{client_ip}"
        pipe = redis.pipeline()
        pipe.incr(rl_key)
        pipe.expire(rl_key, 60)
        results = await pipe.execute()
        if results[0] > 40:
            raise HTTPException(status_code=429, detail="Too Many Requests")

    cache_key = f"inventory:tz:{round(lat, 3)}:{round(lng, 3)}"
    cached = await redis.get(cache_key)
    if cached:
        import json

        return json.loads(cached)

    result = await google_routes.get_timezone(lat, lng)
    if not result:
        raise HTTPException(status_code=502, detail="Timezone lookup unavailable")
    import json

    await redis.setex(cache_key, 86400, json.dumps(result))
    return result


@router.get("/recommendations")
async def tripadvisor_recommendations(
    location: str = Query(..., description="Destination city or region"),
    query: Optional[str] = Query(
        None,
        description="Natural-language intent, e.g. 'family-friendly museums and parks'",
    ),
    categories: Optional[str] = Query(
        None,
        description="Comma-separated TripAdvisor top-level categories "
        "(Attraction, Experience, Eat & Drink, Accommodation)",
    ),
    limit: int = Query(8, ge=1, le=20),
    redis=Depends(get_redis),
    request: Request = None,
):
    """TripAdvisor Agentic Search — ranked places with review citations for AI grounding."""
    if request:
        client_ip = request.client.host
        rl_key = f"rl:inventory:recommendations:{client_ip}"
        pipe = redis.pipeline()
        pipe.incr(rl_key)
        pipe.expire(rl_key, 60)
        results = await pipe.execute()
        if results[0] > 30:
            raise HTTPException(status_code=429, detail="Too Many Requests")

    q = (query or f"top attractions and things to do in {location}").strip()
    cats = [c.strip() for c in (categories or "").split(",") if c.strip()] or None
    cache_key = f"inventory:recs:{location}:{q}:{categories}:{limit}"
    cached = await redis.get(cache_key)
    if cached:
        import json

        return json.loads(cached)

    results = await recommend_places(q, location, categories=cats, limit=limit)
    import json

    # Don't cache empty results for long — often a transient entitlement/fallback miss.
    ttl = 900 if results else 60
    await redis.setex(cache_key, ttl, json.dumps(results))
    return results


@router.get("/search", response_model=List[InventoryItem])
async def search_inventory(
    type: str = Query(
        ...,
        description="Type of inventory (flight, hotel, activity, train, bus, car, holiday, event, cruise, transfer)",
    ),
    location: Optional[str] = Query(None, description="General location or destination"),
    dep: Optional[str] = Query(None, description="Departure code (for transport)"),
    arr: Optional[str] = Query(None, description="Arrival code (for transport)"),
    date: Optional[str] = Query(None, description="Date of travel or check-in"),
    budget: Optional[str] = Query("standard", description="budget level: economy, standard, luxury"),
    redis=Depends(get_redis),
    request: Request = None,
):
    if request:
        client_ip = request.client.host
        rl_key = f"rl:inventory:search:{client_ip}"
        
        # Simple token bucket or sliding window using redis INCR
        pipe = redis.pipeline()
        pipe.incr(rl_key)
        pipe.expire(rl_key, 60)
        results = await pipe.execute()
        
        request_count = results[0]
        if request_count > 60: # Limit: 60 requests per minute
            raise HTTPException(status_code=429, detail="Too Many Requests")
            
    # TravelNext flight/car/holiday/event searches default a missing date to
    # tomorrow. Normalize here so we never serve a stale mock cache keyed on date=None.
    if type in ("flight", "car", "hotel", "holiday", "event", "cruise", "transfer") and not date:
        date = _normalize_search_date(date)

    # Cache stays in source provider currency; convert per-request via X-Currency.
    cache_key = f"inventory:{type}:{location}:{dep}:{arr}:{date}:{budget}"
    cached = await redis.get(cache_key)
    import json
    if cached:
        items = json.loads(cached)
    else:
        results = await inventory_manager.search(type, location, dep, arr, date, budget)
        items = [r.model_dump() for r in results]
        await redis.setex(cache_key, 600, json.dumps(items))

    if request is not None:
        items = await convert_response(items, request, redis)
    return [InventoryItem(**item) for item in items]

@router.get("/redirect")
async def track_and_redirect(url: str, provider: str = Query(None)):
    """Track an affiliate link click and redirect the user to the partner site."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_REDIRECT_HOSTS:
        logger.warning(f"Blocked redirect to disallowed target | Provider: {provider} | Target: {url}")
        raise HTTPException(status_code=400, detail="Redirect target is not an allowed partner domain")

    # Here we would typically record the click in a database or analytics service
    logger.info(f"Affiliate link click tracked | Provider: {provider} | Target: {url}")

    # Redirect to the actual partner deep link
    return RedirectResponse(url=url)
