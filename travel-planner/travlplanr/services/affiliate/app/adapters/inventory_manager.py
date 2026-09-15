"""Merge live inventory for /inventory/search.

Allowed providers only:
  - TravelNext (flights, cars, rail, activities, holidays, events, cruises, transfers)
  - Travelomatix (hotels)
  - Google Places / Google Routes (POI fill + transit estimates)
  - Tripadvisor (activity content)
  - Unsplash (image backfill only)
"""

from __future__ import annotations

import re
from typing import List, Optional

from app.schemas.inventory import InventoryItem

from app.adapters.providers.google_places import search_places
from app.adapters.providers.google_routes import search_transit_inventory
from app.adapters.providers.tripadvisor import search_attractions as search_tripadvisor
from app.adapters.providers.unsplash import fill_missing_images
from app.adapters.providers.travelnext import (
    has_travelnext_credentials,
    search_flights as search_flights_travelnext,
)
from app.adapters.providers.travelnext_activities import (
    has_travelnext_activities_credentials,
    search_activities_inventory as search_activities_travelnext,
)
from app.adapters.providers.travelnext_cars import (
    has_travelnext_cars_credentials,
    search_cars as search_cars_travelnext,
)
from app.adapters.providers.travelnext_cruise import (
    has_travelnext_cruise_credentials,
    search_cruises_inventory as search_cruises_travelnext,
)
from app.adapters.providers.travelnext_events import (
    has_travelnext_events_credentials,
    search_events_inventory as search_events_travelnext,
)
from app.adapters.providers.travelnext_holidays import (
    has_travelnext_holidays_credentials,
    search_holidays as search_holidays_travelnext,
)
from app.adapters.providers.travelomatix_hotels import (
    has_travelomatix_hotels_credentials,
    search_hotels_travelomatix,
)
from app.adapters.providers.travelnext_rail import (
    has_travelnext_rail_credentials,
    search_trains as search_trains_travelnext,
)
from app.adapters.providers.travelnext_transfers import (
    has_travelnext_transfers_credentials,
    search_transfers_inventory as search_transfers_travelnext,
)


def _normalize_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


def _merge_activities(*groups: List[InventoryItem], limit: int = 12) -> List[InventoryItem]:
    """Merge provider results: first group wins on name collisions."""
    seen: set[str] = set()
    merged: List[InventoryItem] = []
    for group in groups:
        for item in group or []:
            key = _normalize_key(item.title)
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(item)
            if len(merged) >= limit:
                return merged
    return merged


async def search(
    type: str,
    location: Optional[str],
    dep: Optional[str],
    arr: Optional[str],
    date: Optional[str],
    budget: Optional[str],
) -> List[InventoryItem]:
    """Search inventory via TravelNext / Travelomatix + Google + Tripadvisor."""

    if type == "flight":
        if has_travelnext_credentials():
            return await search_flights_travelnext(dep, arr, date, budget)
        return []

    if type == "hotel":
        if has_travelomatix_hotels_credentials():
            return await search_hotels_travelomatix(location, budget, date=date)
        return []

    if type == "activity":
        # TravelNext first: bookable activities, then events. Only fall back to
        # Google Places / Tripadvisor when TravelNext returns nothing.
        tn_acts: List[InventoryItem] = []
        if has_travelnext_activities_credentials():
            tn_acts = await search_activities_travelnext(location, budget, date=date)

        events: List[InventoryItem] = []
        if has_travelnext_events_credentials():
            for item in await search_events_travelnext(location, budget, date=date) or []:
                if item.type != "activity":
                    events.append(InventoryItem(**{**item.model_dump(), "type": "activity"}))
                else:
                    events.append(item)

        results = _merge_activities(tn_acts, events, limit=12)
        if not results:
            tripadvisor = await search_tripadvisor(location, budget)
            google = await search_places(location, "tourist attraction", budget)
            google = [g for g in google if not str(g.provider or "").endswith("_mock")]
            results = _merge_activities(google, tripadvisor, limit=12)
            if not results:
                results = [
                    g
                    for g in await search_places(location, "tourist attraction", budget)
                    if not str(g.provider or "").endswith("_mock")
                ]

        await fill_missing_images(results, location=location, limit=8)
        return results

    if type == "train":
        if has_travelnext_rail_credentials():
            results = await search_trains_travelnext(dep, arr, date, budget)
            if results:
                return results
        return await search_transit_inventory("train", dep, arr, budget)

    if type == "bus":
        return await search_transit_inventory("bus", dep, arr, budget)

    if type == "car":
        if has_travelnext_cars_credentials():
            return await search_cars_travelnext(location, budget, date=date)
        return []

    if type == "holiday":
        if has_travelnext_holidays_credentials():
            return await search_holidays_travelnext(location, budget, date=date)
        return []

    if type == "event":
        if has_travelnext_events_credentials():
            return await search_events_travelnext(location, budget, date=date)
        return []

    if type == "cruise":
        if has_travelnext_cruise_credentials():
            return await search_cruises_travelnext(location, budget, date=date)
        return []

    if type == "transfer":
        if has_travelnext_transfers_credentials():
            return await search_transfers_travelnext(location, dep, arr, budget, date=date)
        return []

    return []
