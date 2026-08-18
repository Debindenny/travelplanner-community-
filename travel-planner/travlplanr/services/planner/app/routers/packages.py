"""
Packages endpoints
"""
import uuid

from fastapi import APIRouter, HTTPException, Query, Request, Depends
from sqlalchemy import select, func, or_
from shared.auth_dependencies import require_customer
from shared.events import DomainEvent, EventType, STREAM_PLANNER
from shared.redis_client import emit_event

from app.models.packages import Package
from app.models.trips import Trip, TripStatus
from app.services.package_plan_builder import build_package_plan
from shared.fx import convert_response

router = APIRouter()

# City/country labels from chat or UI → DB region/country/title terms
REGION_ALIASES: dict[str, list[str]] = {
    "dubai": ["dubai", "uae", "united arab emirates", "middle east"],
    "uae": ["dubai", "uae", "united arab emirates", "middle east", "abu dhabi"],
    "unitedarabemirates": ["dubai", "uae", "united arab emirates", "middle east", "abu dhabi"],
    "emirates": ["dubai", "uae", "middle east"],
    "abudhabi": ["abu dhabi", "uae", "middle east"],
    "abu dhabi": ["abu dhabi", "uae", "middle east"],
    "qatar": ["qatar", "doha", "middle east"],
    "doha": ["qatar", "doha", "middle east"],
    "bahrain": ["bahrain", "manama", "middle east"],
    "muscat": ["oman", "muscat", "middle east"],
    "kuwait": ["kuwait", "middle east"],
    "riyadh": ["saudi arabia", "riyadh", "middle east"],
    "alula": ["alula", "saudi arabia", "middle east"],
    "middleeast": ["middle east", "uae", "dubai", "abu dhabi", "qatar"],
    "bangkok": ["thailand", "bangkok", "asia"],
    "phuket": ["thailand", "asia"],
    "bali": ["bali", "indonesia", "asia"],
    "tokyo": ["japan", "tokyo", "asia"],
    "singapore": ["singapore", "asia"],
    "paris": ["france", "paris", "europe"],
    "rome": ["italy", "rome", "europe"],
    "barcelona": ["spain", "barcelona", "europe"],
    "madrid": ["spain", "madrid", "europe"],
    "london": ["united kingdom", "london", "europe"],
    "goa": ["goa", "india", "asia"],
    "usa": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "unitedstates": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "unitedstatesofamerica": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "eastcoast": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "westcoast": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "newyork": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "orlando": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "losangeles": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
}


def _region_filter_conditions(region: str):
    """Build OR conditions matching a destination label and its known aliases."""
    norm = region.lower().strip().replace("_", " ")
    compact = norm.replace(" ", "")
    alias_key = compact if compact in REGION_ALIASES else norm
    terms = list(dict.fromkeys([region, norm, *REGION_ALIASES.get(alias_key, [])]))
    conditions = []
    for term in terms:
        if not term:
            continue
        clean = term.lower().replace(" ", "")
        conditions.append(func.replace(func.lower(Package.region), " ", "") == clean)
        conditions.append(func.replace(func.lower(Package.country), " ", "") == clean)
        conditions.append(Package.title.ilike(f"%{term}%"))
        conditions.append(Package.theme.ilike(f"%{term}%"))
    return or_(*conditions)


@router.get("")
async def get_packages(
    request: Request,
    region: str = None,
    tags: str = None,
    sort_by: str = Query(None, pattern="^(price_asc|price_desc|title)$"),
    max_budget: int = Query(None, ge=0),
    min_budget: int = Query(None, ge=0),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    async with request.app.state.session_factory() as session:
        query = select(Package)
        if region:
            query = query.where(_region_filter_conditions(region))
        if tags:
            # Match a package if any requested tag appears in its region/country/theme.
            tag_list = [t.strip().lower() for t in tags.split(",") if t.strip()]
            if tag_list:
                conditions = []
                for t in tag_list:
                    like = f"%{t}%"
                    conditions.append(Package.region.ilike(like))
                    conditions.append(Package.country.ilike(like))
                    conditions.append(Package.theme.ilike(like))
                query = query.where(or_(*conditions))

        if max_budget is not None:
            query = query.where(Package.price <= max_budget)
        if min_budget is not None:
            query = query.where(Package.price >= min_budget)

        if sort_by == "price_asc":
            query = query.order_by(Package.price.asc(), Package.title)
        elif sort_by == "price_desc":
            query = query.order_by(Package.price.desc(), Package.title)
        else:
            query = query.order_by(Package.title)
        query = query.offset(offset).limit(limit)
        result = await session.execute(query)
        pkgs = result.scalars().all()
        payload = [p.to_dict() for p in pkgs]
        redis = getattr(request.app.state, "redis", None)
        return await convert_response(payload, request, redis, default_from="INR")

@router.get("/regions")
async def get_package_regions(request: Request):
    """Region list + live counts derived from the DB."""
    async with request.app.state.session_factory() as session:
        rows = (
            await session.execute(
                select(Package.region, func.count()).group_by(Package.region).order_by(Package.region)
            )
        ).all()
        return [{"id": region, "name": region, "count": count} for region, count in rows if region]


@router.post("/{package_id}/plan")
async def create_plan_from_package(
    package_id: str,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Create (or reuse) a customer trip with day-by-day segments for this package."""
    try:
        pid = uuid.UUID(package_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Package not found")

    customer_id = uuid.UUID(auth["customer_id"])
    tenant_id = uuid.UUID(auth["tenant_id"])
    customer_name = auth.get("customer_name", "Traveler")

    async with request.app.state.session_factory() as session:
        pkg = (
            await session.execute(select(Package).where(Package.id == pid))
        ).scalar_one_or_none()
        if pkg is None:
            raise HTTPException(status_code=404, detail="Package not found")

        existing = (
            await session.execute(
                select(Trip).where(
                    Trip.customer_id == customer_id,
                    Trip.customizations["packageId"].astext == str(pid),
                )
            )
        ).scalar_one_or_none()
        if existing:
            return {"tripId": str(existing.id), "status": existing.status.value}

        plan = build_package_plan(
            title=pkg.title,
            country=pkg.country,
            region=pkg.region,
            days=pkg.days,
            group_type=pkg.group_type,
            budget_tier=pkg.budget_tier,
            image_url=pkg.image_url,
        )

        count_res = await session.execute(select(func.count()).select_from(Trip))
        itin_code = f"ITIN-{(count_res.scalar() or 0) + 1:04d}"

        trip = Trip(
            tenant_id=tenant_id,
            customer_id=customer_id,
            customer_name=customer_name,
            display_code=itin_code,
            title=plan["title"],
            destination=plan["destination"],
            start_date=plan["start_date"],
            end_date=plan["end_date"],
            travelers=plan["travelers"],
            travel_style=plan["travel_style"],
            travel_method=plan["travel_method"],
            budget=plan["budget"],
            interests=plan["interests"],
            food_preferences=plan["food_preferences"],
            status=TripStatus.READY,
            image=plan["image"],
            days=plan["days"],
            city_days=plan["city_days"],
            segments=plan["segments"],
            customizations={"packageId": str(pid)},
        )
        session.add(trip)
        await session.flush()

        event = DomainEvent(
            event_type=EventType.TRIP_CREATED,
            subject_id=str(trip.id),
            tenant_id=str(tenant_id),
            payload={
                "customer_id": str(customer_id),
                "destination": trip.destination,
                "status": trip.status.value,
                "source": "package",
                "package_id": str(pid),
            },
        )
        await emit_event(request.app.state.redis, STREAM_PLANNER, event)
        await session.commit()

        return {"tripId": str(trip.id), "status": trip.status.value}


# NOTE: keep this dynamic route LAST so static paths like /regions match first.
@router.get("/{package_id}")
async def get_package(package_id: str, request: Request):
    """Public single-package detail — powers the customer-facing detail page."""
    try:
        pid = uuid.UUID(package_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Package not found")

    async with request.app.state.session_factory() as session:
        pkg = (
            await session.execute(select(Package).where(Package.id == pid))
        ).scalar_one_or_none()
        if pkg is None:
            raise HTTPException(status_code=404, detail="Package not found")
        redis = getattr(request.app.state, "redis", None)
        return await convert_response(pkg.to_dict(), request, redis, default_from="INR")
