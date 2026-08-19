import logging
from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select, desc, or_, func, text
from pydantic import BaseModel

from shared.auth_dependencies import optional_customer, require_customer
from app.models.community import (
    CommunityShortcut, CommunityNews, CommunityAd, Hashtag, PostHashtag,
    HashtagFollow, CommunityCollection, CommunityCollectionItem, CommunityPost,
    CommunityEvent
)

from .community_shared import _serialize_posts

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/shortcuts")
async def get_community_shortcuts(request: Request, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        query = select(CommunityShortcut)
        if customer_id: query = query.where(or_(CommunityShortcut.customer_id == None, CommunityShortcut.customer_id == customer_id))
        else: query = query.where(CommunityShortcut.customer_id == None)
        shortcuts = (await session.execute(query)).scalars().all()
        return [{"id": str(s.id), "title": s.title, "url": s.url, "icon_type": s.icon_type} for s in shortcuts]

@router.get("/news")
async def get_community_news(request: Request):
    async with request.app.state.session_factory() as session:
        news = (await session.execute(select(CommunityNews).order_by(desc(CommunityNews.readers)).limit(5))).scalars().all()
        return [{"id": str(n.id), "title": n.title, "readers": n.readers, "timeframe": n.timeframe, "bullet_color": n.bullet_color, "link": n.link, "image_url": n.image_url} for n in news]

@router.get("/ads")
async def get_community_ads(request: Request):
    async with request.app.state.session_factory() as session:
        ad = (await session.execute(select(CommunityAd).where(CommunityAd.is_active == True).limit(1))).scalar_one_or_none()
        if not ad:
            return {}
        return {"id": str(ad.id), "sponsor_name": ad.sponsor_name, "tagline": ad.tagline, "body": ad.body, "button_text": ad.button_text, "sponsor_avatar": ad.sponsor_avatar, "click_url": ad.click_url}

@router.get("/posts/hashtag/{tag}")
async def get_posts_by_hashtag(tag: str, request: Request, limit: int = 20, cursor: str | None = None, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    tag_lower = tag.strip().lower()
    async with request.app.state.session_factory() as session:
        from sqlalchemy.orm import selectinload
        import base64
        import json
        from datetime import datetime

        query = select(CommunityPost).options(selectinload(CommunityPost.destination))\
            .join(PostHashtag, PostHashtag.post_id == CommunityPost.id)\
            .join(Hashtag, Hashtag.id == PostHashtag.hashtag_id)\
            .where(Hashtag.tag == tag_lower)

        if cursor:
            try:
                decoded = json.loads(base64.b64decode(cursor).decode('utf-8'))
                last_created = datetime.fromisoformat(decoded.get('c'))
                query = query.where(CommunityPost.created_at < last_created)
            except Exception as exc:
                logger.warning(f"Malformed cursor in hashtag feed, ignoring: {exc}", exc_info=True)

        query = query.order_by(desc(CommunityPost.created_at)).limit(limit)
        posts = (await session.execute(query)).scalars().all()
        
        serialized = await _serialize_posts(session, posts, customer_id)
        
        next_cursor = None
        if len(posts) == limit:
            last_post = posts[-1]
            cursor_data = {
                'c': last_post.created_at.isoformat()
            }
            next_cursor = base64.b64encode(json.dumps(cursor_data).encode('utf-8')).decode('utf-8')
            
        return {"posts": serialized, "nextCursor": next_cursor}

@router.post("/hashtags/{tag}/follow")
async def toggle_follow_hashtag(tag: str, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    tag_lower = tag.strip().lower()
    async with request.app.state.session_factory() as session:
        hashtag = (await session.execute(select(Hashtag).where(Hashtag.tag == tag_lower))).scalar_one_or_none()
        if not hashtag:
            hashtag = Hashtag(tag=tag_lower)
            session.add(hashtag)
            await session.flush()
            
        existing = (await session.execute(select(HashtagFollow).where(HashtagFollow.customer_id == customer_id, HashtagFollow.hashtag_id == hashtag.id))).scalar_one_or_none()
        if existing:
            await session.delete(existing)
            action = "unfollowed"; is_following = False
        else:
            session.add(HashtagFollow(customer_id=customer_id, hashtag_id=hashtag.id))
            action = "followed"; is_following = True
        await session.commit()
        return {"status": "success", "action": action, "is_following": is_following}

@router.get("/hashtags/followed")
async def get_followed_hashtags(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        query = select(Hashtag.tag).join(HashtagFollow, HashtagFollow.hashtag_id == Hashtag.id).where(HashtagFollow.customer_id == customer_id)
        return list((await session.execute(query)).scalars().all())

@router.get("/hashtags/trending")
async def get_trending_hashtags(request: Request, limit: int = 10):
    async with request.app.state.session_factory() as session:
        query = (
            select(Hashtag.tag, func.count(PostHashtag.id).label("post_count"))
            .join(PostHashtag, PostHashtag.hashtag_id == Hashtag.id)
            .group_by(Hashtag.tag)
            .order_by(desc(func.count(PostHashtag.id)))
            .limit(limit)
        )
        rows = (await session.execute(query)).all()
        return [{"name": row.tag, "count": row.post_count} for row in rows]

class CreateCollectionRequest(BaseModel):
    name: str; description: str | None = None; is_public: bool = False
class AddCollectionItemRequest(BaseModel):
    item_type: str; item_id: str

@router.get("/collections")
async def get_collections(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        collections = (await session.execute(select(CommunityCollection).where(CommunityCollection.customer_id == customer_id).order_by(desc(CommunityCollection.created_at)))).scalars().all()
        return [{"id": str(c.id), "name": c.name, "description": c.description, "is_public": c.is_public} for c in collections]

@router.get("/collections/{collection_id}")
async def get_collection_detail(collection_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        collection = (await session.execute(
            select(CommunityCollection).where(
                CommunityCollection.id == collection_id,
                CommunityCollection.customer_id == customer_id
            )
        )).scalar_one_or_none()
        if not collection:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Collection not found")
        items = (await session.execute(
            select(CommunityCollectionItem)
            .where(CommunityCollectionItem.collection_id == collection_id)
            .order_by(desc(CommunityCollectionItem.created_at))
        )).scalars().all()

        post_ids = [item.item_id for item in items if item.item_type == 'post']
        posts_map = {}
        if post_ids:
            post_rows = (await session.execute(select(CommunityPost).where(CommunityPost.id.in_(post_ids)))).scalars().all()
            posts_map = {p.id: p for p in post_rows}

        serialized_items = []
        for item in items:
            item_data: dict = {
                "id": str(item.id),
                "item_type": item.item_type,
                "item_id": str(item.item_id),
                "created_at": item.created_at.isoformat()
            }
            if item.item_type == 'post' and item.item_id in posts_map:
                p = posts_map[item.item_id]
                item_data["post"] = {
                    "id": str(p.id),
                    "caption": p.caption,
                    "images": p.images or [],
                    "location": p.location,
                    "author_name": p.author_name,
                    "author_avatar": p.author_avatar,
                }
            serialized_items.append(item_data)

        return {
            "id": str(collection.id),
            "name": collection.name,
            "description": collection.description,
            "is_public": collection.is_public,
            "items": serialized_items
        }

@router.post("/collections")
async def create_collection(data: CreateCollectionRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    if not data.name or not data.name.strip(): raise HTTPException(status_code=400, detail="Collection name cannot be empty")
    async with request.app.state.session_factory() as session:
        new_collection = CommunityCollection(customer_id=customer_id, name=data.name.strip(), description=data.description.strip() if data.description else None, is_public=data.is_public)
        session.add(new_collection)
        await session.commit()
        return {"id": str(new_collection.id), "name": new_collection.name, "description": new_collection.description, "is_public": new_collection.is_public}

@router.post("/collections/{collection_id}/items")
async def add_collection_item(collection_id: UUID, data: AddCollectionItemRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        collection = (await session.execute(select(CommunityCollection).where(CommunityCollection.id == collection_id, CommunityCollection.customer_id == customer_id))).scalar_one_or_none()
        if not collection: raise HTTPException(status_code=404, detail="Collection not found")
        try: item_uuid = UUID(data.item_id)
        except ValueError: raise HTTPException(status_code=400, detail="Invalid item ID")
        session.add(CommunityCollectionItem(collection_id=collection_id, item_type=data.item_type, item_id=item_uuid))
        await session.commit()
        return {"status": "success"}

@router.post("/trips/{trip_id}/clone")
async def clone_trip(trip_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"]); customer_name = auth.get("customer_name", "Unknown"); tenant_id = UUID(auth["tenant_id"])
    import httpx

    # Fetch plan data outside the DB transaction to avoid holding a row lock on an
    # identity_db connection while waiting for remote HTTP.  If the identity service
    # is unreachable we skip the check (same as before) but document it so ops can
    # monitor dashboards for gaps.
    plan_valid = True
    try:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            async with httpx.AsyncClient() as client:
                resp = await client.get("http://identity:8000/api/v1/me/plan", headers={"Authorization": auth_header})
                if resp.status_code == 200:
                    plan_data = resp.json()
                    if plan_data.get("plans_used", 0) >= plan_data.get("plans_limit", 2):
                        raise HTTPException(status_code=403, detail="Plan limit reached. Please upgrade to create more trips.")
                elif resp.status_code not in (502, 503):
                    # Treat non-client-errors as transient — allow the clone through if
                    # identity isn't reachable at all rather than hard-blocking.
                    pass
    except httpx.RequestError:
        plan_valid = True  # identity unreachable — optimistic fallback (same as before)
    except HTTPException:
        raise  # re-raise user-facing limit errors
    except Exception as e:
        # Unexpected error in identity check — allow the clone through rather than
        # block a user because of a transient failure.
        logger.warning("Identity plan-check failed (plan_valid=True fallback): %s", e, exc_info=True)

    async with request.app.state.session_factory() as session:
        from app.models.trips import Trip, TripStatus
        from shared.events import DomainEvent, EventType, STREAM_PLANNER
        from shared.redis_client import emit_event

        orig = (await session.execute(
            select(Trip).outerjoin(
                CommunityPost,
                (CommunityPost.itinerary_id == Trip.id) & (CommunityPost.customer_id == customer_id)
            )
            .where(Trip.id == trip_id, Trip.tenant_id == tenant_id, or_(Trip.customer_id == customer_id, CommunityPost.id != None))
        )).scalar_one_or_none()

        if not orig: raise HTTPException(status_code=404, detail="Original trip not found or not accessible")

        # Advisory lock keyed on (tenant_id, customer_id) serialises clones for the same
        # user to prevent TOCTOU plan-limit bypass when multiple requests arrive concurrently.
        await session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": f"clone_trip:{tenant_id}:{customer_id}"})

        # Re-verify the plan limit inside the DB transaction — identity check passed before,
        # but a concurrent request could have consumed a slot between our HTTP check and now.
        if plan_valid:
            try:
                async with httpx.AsyncClient() as client:
                    auth_header = request.headers.get("Authorization")
                    resp = await client.get("http://identity:8000/api/v1/me/plan", headers={"Authorization": auth_header})
                    if resp.status_code == 200:
                        plan_data = resp.json()
                        if plan_data.get("plans_used", 0) >= plan_data.get("plans_limit", 2):
                            raise HTTPException(status_code=403, detail="Plan limit reached. Please upgrade to create more trips.")
            except HTTPException:
                raise
            except Exception:
                plan_valid = False  # best-effort; proceed without second check

        count_res = await session.execute(select(func.count()).select_from(Trip))
        cloned = Trip(
            tenant_id=tenant_id, customer_id=customer_id, customer_name=customer_name, display_code=f"ITIN-{(count_res.scalar() or 0) + 1:04d}",
            title=f"Clone of {orig.title}", destination=orig.destination, start_date=orig.start_date, end_date=orig.end_date,
            travelers=orig.travelers, travel_style=orig.travel_style, travel_method=orig.travel_method, budget=orig.budget,
            interests=orig.interests, food_preferences=orig.food_preferences, status=TripStatus.READY, image=orig.image,
            days=orig.days, city_days=orig.city_days, segments=orig.segments, customizations=orig.customizations
        )
        session.add(cloned)
        await session.flush()

        await emit_event(request.app.state.redis, STREAM_PLANNER, DomainEvent(
            event_type=EventType.TRIP_CREATED, subject_id=str(cloned.id), tenant_id=str(tenant_id),
            payload={"customer_id": str(customer_id), "destination": cloned.destination, "status": cloned.status.value}
        ))
        await session.commit()
        return {"tripId": str(cloned.id)}

class TrackEventRequest(BaseModel):
    event: str
    payload: dict | None = None

@router.post("/events")
async def track_community_event(data: TrackEventRequest, request: Request, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        session.add(CommunityEvent(customer_id=customer_id, event=data.event[:100], payload=data.payload))
        await session.commit()
    return {"status": "ok"}
