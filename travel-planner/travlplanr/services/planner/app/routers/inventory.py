from fastapi import APIRouter, Query, Request

from sqlalchemy import select, or_, cast
from sqlalchemy.dialects.postgresql import JSONB

from app.models.inventory import InventoryItem
from app.routers.inventory_search import resolve_place_tokens
from shared.fx import convert_response

router = APIRouter()


def _token_conditions(token: str, *, route: bool = False) -> list:
    """Build ILIKE conditions for one search token."""
    like = f"%{token}%"
    upper = f"%{token.upper()}%"
    conditions = [
        InventoryItem.title.ilike(like),
        InventoryItem.subtitle.ilike(like),
        cast(InventoryItem.metadata_json, JSONB)["city"].astext.ilike(like),
        cast(InventoryItem.metadata_json, JSONB)["location"].astext.ilike(like),
    ]
    if route:
        conditions.extend(
            [
                cast(InventoryItem.metadata_json, JSONB)["origin"].astext.ilike(upper),
                cast(InventoryItem.metadata_json, JSONB)["destination"].astext.ilike(upper),
                cast(InventoryItem.metadata_json, JSONB)["departure"].astext.ilike(like),
                cast(InventoryItem.metadata_json, JSONB)["arrival"].astext.ilike(like),
            ]
        )
    return conditions


def _apply_location_filter(query, location: str | None):
    tokens = resolve_place_tokens(location)
    if not tokens:
        return query
    token_filters = [or_(*_token_conditions(t)) for t in tokens]
    return query.where(or_(*token_filters))


def _apply_route_filter(query, value: str | None, *, side: str):
    tokens = resolve_place_tokens(value)
    if not tokens:
        return query
    token_filters = [or_(*_token_conditions(t, route=True)) for t in tokens]
    return query.where(or_(*token_filters))


def _normalize_budget(budget: str | None) -> str | None:
    if not budget:
        return None
    key = budget.lower().strip()
    if key in ("economy", "budget") or "budget" in key or "economy" in key:
        return "economy"
    if key in ("luxury", "premium") or "luxury" in key or "premium" in key:
        return "premium"
    return "standard"


def _apply_budget_filter(query, budget: str | None):
    tier = _normalize_budget(budget)
    if tier == "economy":
        return query.where(InventoryItem.price_amount <= 250)
    if tier == "premium":
        return query.where(InventoryItem.price_amount >= 200)
    return query


async def _run_search(session, *, item_type: str, location, dep, arr, date, budget, limit: int = 100):
    query = select(InventoryItem).where(InventoryItem.item_type == item_type)
    query = _apply_location_filter(query, location)
    query = _apply_route_filter(query, dep, side="dep")
    query = _apply_route_filter(query, arr, side="arr")

    if date:
        date_like = f"%{date}%"
        query = query.where(
            cast(InventoryItem.metadata_json, JSONB)["travel_date"].astext.ilike(date_like)
        )

    query = _apply_budget_filter(query, budget)
    query = query.order_by(InventoryItem.price_amount).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/search")
async def search_inventory(
    request: Request,
    type: str = Query(...),
    location: str | None = None,
    dep: str | None = None,
    arr: str | None = None,
    date: str | None = None,
    budget: str | None = None,
):
    """Search seeded inventory items stored in planner_db."""
    async with request.app.state.session_factory() as session:
        items = await _run_search(
            session,
            item_type=type,
            location=location,
            dep=dep,
            arr=arr,
            date=date,
            budget=budget,
        )

        # Broaden search when route/location filters are too strict.
        if not items and (location or dep or arr):
            items = await _run_search(
                session,
                item_type=type,
                location=None,
                dep=None,
                arr=None,
                date=date,
                budget=budget,
            )

        # Last resort: drop budget filter so swap UIs always show options.
        if not items and budget:
            items = await _run_search(
                session,
                item_type=type,
                location=location,
                dep=dep,
                arr=arr,
                date=date,
                budget=None,
            )
        if not items and (location or dep or arr):
            items = await _run_search(
                session,
                item_type=type,
                location=None,
                dep=None,
                arr=None,
                date=date,
                budget=None,
            )

        payload = [item.to_api_dict() for item in items]
        redis = getattr(request.app.state, "redis", None)
        return await convert_response(payload, request, redis)
