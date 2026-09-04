import base64
import json
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, func, or_, select

from shared.auth_dependencies import optional_customer
from app.models.community import CommunityCollection, CommunityCollectionItem, CommunityPost

from .community_shared import iso_utc

logger = logging.getLogger(__name__)

router = APIRouter()

CATEGORIES = ["All", "Tips", "Routes", "Reels", "Food", "Budget"]
SORTS = ["Most used", "Newest", "Most saved"]

# A CommunityPost is Discover-eligible once it's been curated with a title —
# plain feed posts leave title null and never show up here.
_DISCOVER_TIP = CommunityPost.title.isnot(None)

_SORT_COLUMN = {
    "Most used": desc(CommunityPost.use_count),
    "Newest": desc(CommunityPost.created_at),
    "Most saved": desc(CommunityPost.save_count),
}


async def _saved_tip_ids(session, customer_id: UUID | None) -> set[UUID]:
    if customer_id is None:
        return set()
    default_collection_id = (
        await session.execute(
            select(CommunityCollection.id).where(
                CommunityCollection.customer_id == customer_id,
                CommunityCollection.is_default == True,
            )
        )
    ).scalar_one_or_none()
    if not default_collection_id:
        return set()
    rows = (
        await session.execute(
            select(CommunityCollectionItem.item_id).where(
                CommunityCollectionItem.collection_id == default_collection_id,
                CommunityCollectionItem.item_type == "tip",
            )
        )
    ).scalars().all()
    return set(rows)


def _serialize_tip(tip: CommunityPost, saved_ids: set[UUID]) -> dict:
    return {
        "id": str(tip.id),
        "tag": tip.tag,
        "category": tip.category,
        "place": tip.location,
        "title": tip.title,
        "used": tip.used_label,
        "blurb": tip.caption,
        "author": tip.author_name,
        "authorLine": tip.author_line,
        "body": tip.body,
        "facts": tip.facts or [],
        "points": tip.points or [],
        "image": (tip.images or [None])[0],
        "useCount": tip.use_count,
        "saveCount": tip.save_count,
        "isSaved": tip.id in saved_ids,
        "createdAt": iso_utc(tip.created_at),
    }

@router.get("/discover/filters")
async def get_discover_filters(request: Request):
    async with request.app.state.session_factory() as session:

        category_rows = (
            await session.execute(
                select(CommunityPost.category).where(_DISCOVER_TIP).distinct()
            )
        ).scalars().all()

        categories = ["All"] + sorted(category_rows)

        place_rows = (
            await session.execute(
                select(
                    CommunityPost.location,
                    func.count(CommunityPost.id)
                ).where(_DISCOVER_TIP).group_by(CommunityPost.location)
            )
        ).all()

        total = sum(count for _, count in place_rows)

        places = [{"label": "All places", "count": total}] + [
            {"label": place, "count": count}
            for place, count in sorted(place_rows, key=lambda row: row[0])
        ]

        return {
            "categories": categories,
            "places": places,
            "sorts": SORTS,
        }


@router.get("/discover")
async def list_discover(
    request: Request,
    category: str = "All",
    place: str = "All places",
    sort: str = "Most used",
    q: Optional[str] = None,
    limit: int = 20,
    cursor: Optional[str] = None,
    auth: dict | None = Depends(optional_customer),
):
    if sort not in _SORT_COLUMN:
        raise HTTPException(status_code=400, detail=f"Unknown sort '{sort}'")
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None

    async with request.app.state.session_factory() as session:
        query = select(CommunityPost).where(_DISCOVER_TIP)
        if category != "All":
            query = query.where(CommunityPost.category == category)
        if place != "All places":
            query = query.where(CommunityPost.location == place)
        if q:
            like = f"%{q.strip()}%"
            query = query.where(
                or_(
                    CommunityPost.title.ilike(like),
                    CommunityPost.caption.ilike(like),
                    CommunityPost.location.ilike(like),
                    CommunityPost.tag.ilike(like),
                    CommunityPost.author_name.ilike(like),
                )
            )

        if cursor:
            try:
                decoded = json.loads(base64.b64decode(cursor).decode("utf-8"))
                offset = int(decoded.get("o", 0))
            except Exception as exc:
                logger.warning(f"Malformed cursor in discover, ignoring: {exc}", exc_info=True)
                offset = 0
        else:
            offset = 0

        query = query.order_by(_SORT_COLUMN[sort], desc(CommunityPost.id)).offset(offset).limit(limit)
        tips = (await session.execute(query)).scalars().all()

        saved_ids = await _saved_tip_ids(session, customer_id)
        serialized = [_serialize_tip(tip, saved_ids) for tip in tips]

        next_cursor = None
        if len(tips) == limit:
            next_cursor = base64.b64encode(json.dumps({"o": offset + limit}).encode("utf-8")).decode("utf-8")

        return {"items": serialized, "nextCursor": next_cursor}


@router.get("/discover/{tip_id}")
async def get_discover_tip(tip_id: UUID, request: Request, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        tip = await session.get(CommunityPost, tip_id)
        if not tip or tip.title is None:
            raise HTTPException(status_code=404, detail="Tip not found")
        saved_ids = await _saved_tip_ids(session, customer_id)
        return _serialize_tip(tip, saved_ids)
