import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import desc, select

from shared.auth_dependencies import require_customer
from app.models.community import CommunityCollection, CommunityCollectionItem, CommunityPost
from app.models.destinations import Destination

logger = logging.getLogger(__name__)

router = APIRouter()

ITEM_TYPES = {"tip", "post", "destination", "itinerary"}

_KIND_BY_ITEM_TYPE = {"tip": "Tip", "itinerary": "Trip", "post": "Spot", "destination": "Destination"}


def _relative_time(when: datetime) -> str:
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - when
    seconds = delta.total_seconds()
    if seconds < 3600:
        return f"{max(1, int(seconds // 60))}m ago"
    if seconds < 86400:
        return f"{int(seconds // 3600)}h ago"
    if seconds < 604800:
        return f"{int(seconds // 86400)}d ago"
    return f"{int(seconds // 604800)}w ago"


async def _get_or_create_default_collection(session, customer_id: UUID) -> CommunityCollection:
    collection = (
        await session.execute(
            select(CommunityCollection).where(
                CommunityCollection.customer_id == customer_id,
                CommunityCollection.is_default == True,
            )
        )
    ).scalar_one_or_none()
    if collection:
        return collection
    collection = CommunityCollection(customer_id=customer_id, name="Saved", is_default=True)
    session.add(collection)
    await session.flush()
    return collection


class ToggleSavedRequest(BaseModel):
    item_type: str
    item_id: str


@router.get("/saved")
async def list_saved(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        collection = (
            await session.execute(
                select(CommunityCollection).where(
                    CommunityCollection.customer_id == customer_id,
                    CommunityCollection.is_default == True,
                )
            )
        ).scalar_one_or_none()
        if not collection:
            return {"items": []}

        saved_items = (
            await session.execute(
                select(CommunityCollectionItem)
                .where(CommunityCollectionItem.collection_id == collection.id)
                .order_by(desc(CommunityCollectionItem.created_at))
            )
        ).scalars().all()

        tip_ids = [i.item_id for i in saved_items if i.item_type == "tip"]
        post_ids = [i.item_id for i in saved_items if i.item_type == "post"]
        destination_ids = [i.item_id for i in saved_items if i.item_type == "destination"]
        tips_map, posts_map, destinations_map = {}, {}, {}
        if tip_ids:
            # "tip" saves point at a CommunityPost row that was curated as a
            # Discover tip (title IS NOT NULL) — same table as "post" saves.
            rows = (await session.execute(select(CommunityPost).where(CommunityPost.id.in_(tip_ids)))).scalars().all()
            tips_map = {t.id: t for t in rows}
        if post_ids:
            rows = (await session.execute(select(CommunityPost).where(CommunityPost.id.in_(post_ids)))).scalars().all()
            posts_map = {p.id: p for p in rows}
        if destination_ids:
            rows = (await session.execute(select(Destination).where(Destination.id.in_(destination_ids)))).scalars().all()
            destinations_map = {d.id: d for d in rows}

        result = []
        for item in saved_items:
            when = _relative_time(item.created_at)
            if item.item_type == "tip" and item.item_id in tips_map:
                tip = tips_map[item.item_id]
                result.append({
                    "id": str(item.id),
                    "item_id": str(item.item_id),
                    "kind": _KIND_BY_ITEM_TYPE["tip"],
                    "title": tip.title,
                    "meta": f"{tip.location} · saved {when}",
                    "image": (tip.images or [None])[0],
                })
            elif item.item_type == "post" and item.item_id in posts_map:
                post = posts_map[item.item_id]
                title = (post.caption or "Untitled post").strip().splitlines()[0][:120]
                result.append({
                    "id": str(item.id),
                    "item_id": str(item.item_id),
                    "kind": _KIND_BY_ITEM_TYPE["post"],
                    "title": title,
                    "meta": f"{post.author_name} · saved {when}",
                    "image": (post.images or [None])[0],
                })
            elif item.item_type == "destination" and item.item_id in destinations_map:
                dest = destinations_map[item.item_id]
                result.append({
                    "id": str(item.id),
                    "item_id": str(item.item_id),
                    "kind": _KIND_BY_ITEM_TYPE["destination"],
                    "title": dest.name,
                    "meta": f"{dest.region} · saved {when}",
                    "image": dest.image_url,
                })
            # 'itinerary' saves resolve once that service exposes a lookup here —
            # skipped for now rather than shown with missing data.

        return {"items": result}


@router.post("/saved/toggle")
async def toggle_saved(data: ToggleSavedRequest, request: Request, auth: dict = Depends(require_customer)):
    if data.item_type not in ITEM_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown item_type '{data.item_type}'")
    try:
        item_uuid = UUID(data.item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid item_id")

    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        collection = await _get_or_create_default_collection(session, customer_id)

        existing = (
            await session.execute(
                select(CommunityCollectionItem).where(
                    CommunityCollectionItem.collection_id == collection.id,
                    CommunityCollectionItem.item_type == data.item_type,
                    CommunityCollectionItem.item_id == item_uuid,
                )
            )
        ).scalar_one_or_none()

        if existing:
            await session.delete(existing)
            saved = False
        else:
            session.add(CommunityCollectionItem(collection_id=collection.id, item_type=data.item_type, item_id=item_uuid))
            saved = True

        if data.item_type == "tip":
            tip = await session.get(CommunityPost, item_uuid)
            if tip:
                tip.save_count = max(0, tip.save_count + (1 if saved else -1))

        await session.commit()
        return {"saved": saved}


@router.delete("/saved/items/{collection_item_id}")
async def remove_saved_item(collection_item_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        item = (
            await session.execute(
                select(CommunityCollectionItem)
                .join(CommunityCollection, CommunityCollection.id == CommunityCollectionItem.collection_id)
                .where(
                    CommunityCollectionItem.id == collection_item_id,
                    CommunityCollection.customer_id == customer_id,
                )
            )
        ).scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Saved item not found")

        if item.item_type == "tip":
            tip = await session.get(CommunityPost, item.item_id)
            if tip:
                tip.save_count = max(0, tip.save_count - 1)

        await session.delete(item)
        await session.commit()
        return {"status": "success"}
