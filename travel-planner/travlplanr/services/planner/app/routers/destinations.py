"""
Destinations endpoints
"""
import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, desc

from app.models.destination_requests import DestinationRequest
from app.models.destinations import Destination
from app.models.community import CommunityPost, PostReaction
from app.services.embedding_service import generate_embedding
from shared.auth_dependencies import optional_customer
from shared.config import DEV_ENVIRONMENTS
from shared.rate_limit import rate_limiter
from shared.fx import convert_response

logger = logging.getLogger(__name__)
search_telemetry_logger = logging.getLogger("search_telemetry.destinations")
router = APIRouter()


class DestinationRequestBody(BaseModel):
    placeName: str = Field(min_length=2, max_length=120)
    sourceMessage: str | None = Field(default=None, max_length=500)


def _merge_destination_group(items: list[dict]) -> dict:
    """Collapse duplicate rows that share the same destination name."""
    if not items:
        return {}
    merged = dict(items[0])
    tags: set[str] = set()
    best_description = ""
    best_image = merged.get("image") or ""
    best_price = merged.get("price") or 0

    best_been_there = 0
    for item in items:
        tags.update(item.get("tags") or [])
        desc = (item.get("description") or "").strip()
        if len(desc) > len(best_description):
            best_description = desc
        image = item.get("image") or ""
        if image and (not best_image or "rated" in image.lower()):
            best_image = image
        best_price = max(best_price, item.get("price") or 0)
        best_been_there = max(best_been_there, item.get("been_there_count") or 0)

    merged["tags"] = sorted(tags)
    merged["description"] = best_description
    merged["image"] = best_image
    merged["price"] = best_price
    merged["been_there_count"] = best_been_there
    return merged


def _dedupe_destinations(dest_dicts: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for dest in dest_dicts:
        key = dest["name"].lower().strip()
        grouped.setdefault(key, []).append(dest)
    return sorted(
        (_merge_destination_group(group) for group in grouped.values()),
        key=lambda d: d["name"].lower(),
    )


@router.get("", dependencies=[Depends(rate_limiter("destinations-search", 60, 60))])
async def get_destinations(
    request: Request,
    region: str = None,
    tag: str = None,
    search: str = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    started_at = time.monotonic()
    async with request.app.state.session_factory() as session:
        query = select(Destination)
        if region:
            query = query.where(Destination.region == region)
        if tag:
            # PostgreSQL specific ANY
            query = query.where(Destination.tags.any(tag))
        if search:
            search_term = f"%{search}%"
            query = query.where(
                (Destination.name.ilike(search_term)) |
                (Destination.region.ilike(search_term)) |
                (Destination.description.ilike(search_term))
            )

        query = query.order_by(Destination.name).offset(offset).limit(limit)
        result = await session.execute(query)
        dests = list(result.scalars().all())
        keyword_hit_ids = {d.id for d in dests}

        # Semantic fallback/augmentation: free-text queries that don't share
        # substrings with any name/region/description (e.g. "quiet beach town")
        # still surface relevant destinations, ranked by embedding distance.
        if search and len(dests) < limit:
            semantic_error = None
            try:
                vector = await generate_embedding(search)
            except Exception as e:
                vector, semantic_error = None, e
            if vector:
                # T2.3: apply a max cosine-distance threshold so spurious matches
                # from unrelated embeddings don't appear in the results.
                import os as _os
                _max_dist = float(_os.environ.get("DEST_SEARCH_MAX_COSINE_DISTANCE", "0.6"))
                semantic_query = (
                    select(Destination)
                    .where(Destination.embedding.is_not(None))
                    .where(Destination.embedding.cosine_distance(vector) < _max_dist)
                    .order_by(Destination.embedding.cosine_distance(vector))
                    .limit(limit - len(dests))
                )
                if keyword_hit_ids:
                    semantic_query = semantic_query.where(Destination.id.notin_(keyword_hit_ids))
                if region:
                    semantic_query = semantic_query.where(Destination.region == region)
                if tag:
                    semantic_query = semantic_query.where(Destination.tags.any(tag))
                semantic_result = await session.execute(semantic_query)
                dests.extend(semantic_result.scalars().all())
            elif semantic_error:
                logger.warning("Semantic search unavailable, falling back to keyword-only: %s", semantic_error)

        # Embedding backfill runs in destination_embedding_backfill background job —
        # never synchronously inside this user-facing list endpoint.

        # Fetch been_there counts dynamically from community posts reactions
        been_there_counts = {}
        try:
            from app.models.community import PostReaction, CommunityPost
            counts_q = select(
                CommunityPost.destination_id,
                func.count(func.distinct(PostReaction.customer_id))
            ).join(PostReaction, PostReaction.post_id == CommunityPost.id).where(
                PostReaction.reaction_type == 'been_there',
                CommunityPost.destination_id != None
            ).group_by(CommunityPost.destination_id)
            counts_res = await session.execute(counts_q)
            for dest_id, count in counts_res.all():
                been_there_counts[dest_id] = count
        except Exception as e:
            logger.warning("Failed to compute been_there counts: %s", e)

        results = _dedupe_destinations([d.to_dict(been_there_counts.get(d.id, 0)) for d in dests])

        if search:
            search_telemetry_logger.info(
                "destination_search",
                extra={
                    "query": search,
                    "result_count": len(results),
                    "zero_results": len(results) == 0,
                    "duration_ms": round((time.monotonic() - started_at) * 1000, 1),
                },
            )

        redis = getattr(request.app.state, "redis", None)
        return await convert_response(results, request, redis, default_from="INR")

@router.get("/filters")
async def get_destination_filters(request: Request):
    """Filter options derived from the DB (single source of truth)."""
    async with request.app.state.session_factory() as session:
        regions = (await session.execute(select(Destination.region).distinct())).scalars().all()
        tag_arrays = (await session.execute(select(Destination.tags))).scalars().all()
        tags = sorted({t for arr in (tag_arrays or []) if arr for t in arr})
        return {
            "regions": sorted([r for r in regions if r]),
            "tags": tags,
        }


@router.post(
    "/requests",
    dependencies=[Depends(rate_limiter("destination-request", 5, 3600))],
)
async def create_destination_request(
    body: DestinationRequestBody,
    request: Request,
    auth: dict | None = Depends(optional_customer),
):
    place = body.placeName.strip()
    if not place:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "placeName is required")

    customer_id = None
    email = None
    if auth:
        try:
            customer_id = uuid.UUID(auth["customer_id"])
        except (KeyError, ValueError, TypeError):
            customer_id = None
        email = auth.get("email")

    async with request.app.state.session_factory() as session:
        if customer_id:
            since = datetime.now(timezone.utc) - timedelta(days=7)
            existing = (
                await session.execute(
                    select(DestinationRequest).where(
                        DestinationRequest.customer_id == customer_id,
                        func.lower(DestinationRequest.place_name) == place.lower(),
                        DestinationRequest.created_at >= since,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                return {
                    "id": str(existing.id),
                    "placeName": existing.place_name,
                    "status": existing.status,
                    "message": "We already have your request for this destination.",
                }

        row = DestinationRequest(
            place_name=place,
            customer_id=customer_id,
            email=email,
            source_message=(body.sourceMessage or "")[:500] or None,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)

    return {
        "id": str(row.id),
        "placeName": row.place_name,
        "status": row.status,
        "message": f"Thanks — we'll consider adding {place} to TRAVL PLANR.",
    }


@router.get("/seed", dependencies=[Depends(rate_limiter("destinations-seed", 5, 300))])
async def seed_destinations(request: Request):
    """Temporary endpoint to seed DB since uv/poetry failed on host"""
    import os
    import secrets as _secrets
    from fastapi import HTTPException
    settings = request.app.state.settings
    if settings.environment.lower() not in DEV_ENVIRONMENTS:
        raise HTTPException(status_code=403, detail="Seeding is disabled outside development")

    if not _secrets.compare_digest(request.query_params.get("secret", ""), settings.seed_secret):
        raise HTTPException(status_code=403, detail="Not authorized to seed data")
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "seed_data.json")
    
    # create tables
    from shared.database import Base
    async with request.app.state.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    if not os.path.exists(file_path):
        # maybe it's in the app root
        file_path = "seed_data.json"
        
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        return {"error": f"Could not load seed_data.json: {e}"}
        
    from sqlalchemy import delete
    async with request.app.state.session_factory() as session:
        # Wipe existing destinations first to prevent duplicate seeding
        await session.execute(delete(Destination))
        
        for dest in data.get("destinations", []):
            d = Destination(
                name=dest["name"],
                description=dest["description"],
                image_url=dest["image_url"],
                base_price=dest["base_price"],
                region=dest["region"],
                tags=dest["tags"],
                latitude=dest.get("latitude"),
                longitude=dest.get("longitude")
            )
            session.add(d)
            
        # Seed Packages
        from app.models.packages import Package
        try:
            import sys
            import os
            import importlib
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            import scripts.seed_packages
            importlib.reload(scripts.seed_packages)
            from scripts.seed_packages import DEMO_PACKAGES
            for pkg_data in DEMO_PACKAGES:
                existing = (
                    await session.execute(select(Package).where(Package.id == pkg_data["id"]))
                ).scalar_one_or_none()
                if existing:
                    for key, val in pkg_data.items():
                        if key != "id":
                            setattr(existing, key, val)
                else:
                    session.add(Package(**pkg_data))
        except Exception as e:
            logger.error(f"Failed to seed packages: {e}")
            return {"error": "Failed to seed packages"}
        await session.commit()
        
        # Get titles for debugging
        titles = [p["title"] for p in DEMO_PACKAGES]
        
    return {"message": "Destinations and Packages seeded", "packages": titles, "module_file": str(scripts.seed_packages.__file__)}


# Registered last: a single-segment path param like `/{destination_id}` would
# otherwise shadow every static sibling route above it (/filters, /requests,
# /seed) — FastAPI matches routes in registration order, so "seed" would be
# parsed as a UUID and 422 instead of reaching seed_destinations().
@router.get("/{destination_id}")
async def get_destination(
    destination_id: uuid.UUID,
    request: Request,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: dict | None = Depends(optional_customer),
):
    """Destination detail with related posts and pagination."""
    async with request.app.state.session_factory() as session:
        dest = (
            await session.execute(select(Destination).where(Destination.id == destination_id))
        ).scalar_one_or_none()
        if not dest:
            raise HTTPException(status_code=404, detail="Destination not found")

        # PostReaction → been-there count (all time)
        bt_q = (
            select(func.coalesce(func.count(PostReaction.id), 0))
            .join(CommunityPost, CommunityPost.id == PostReaction.post_id)
            .where(
                PostReaction.reaction_type == 'been_there',
                CommunityPost.destination_id == destination_id,
            )
        )
        been_there_count = (await session.execute(bt_q)).scalar()

        # Posts tagging this destination, ordered by popularity → recency
        posts_query = (
            select(CommunityPost)
            .where(CommunityPost.destination_id == destination_id)
            .order_by(
                (CommunityPost.likes_count * 2 + CommunityPost.comments_count * 3).desc(),
                desc(CommunityPost.created_at),
            )
            .limit(limit)
            .offset(offset)
        )
        posts = (await session.execute(posts_query)).scalars().all()

        # Re-use _serialize_posts via an inline call so we can inject customer_id for reaction state.
        # `auth` arrives as a route dependency — calling optional_customer(request) directly here
        # raised TypeError on every request (it also takes token/settings dependencies), which the
        # surrounding except swallowed, so signed-in viewers never saw their own reaction state.
        from .community_shared import _serialize_posts
        auth = auth or {}
        viewer_id = None
        if auth and "customer_id" in auth:
            try:
                viewer_id = uuid.UUID(auth["customer_id"])
            except (KeyError, ValueError, TypeError):
                pass
        serialized_posts = await _serialize_posts(session, posts, viewer_id)

        payload = {
            "destination": dest.to_dict(been_there_count),
            "posts": serialized_posts,
            "has_more": len(posts) == limit,
        }
        redis = getattr(request.app.state, "redis", None)
        return await convert_response(payload, request, redis, default_from="INR")

