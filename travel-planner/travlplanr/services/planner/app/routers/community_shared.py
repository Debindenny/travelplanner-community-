from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone
import re
import os
import uuid
import logging
from pydantic import BaseModel
from sqlalchemy import select, func, desc, or_, update, and_
from fastapi import WebSocket

logger = logging.getLogger(__name__)

from app.models.community import (
    CommunityPost, PostReaction, Hashtag, PostHashtag, CommunityProfile, NotificationPreference
)


def iso_utc(value: datetime | None) -> str | None:
    """Serialize a datetime as an explicitly-UTC ISO string.

    Community timestamps are stored as naive UTC (``DateTime`` + ``datetime.utcnow``).
    Calling ``.isoformat()`` on those emits no timezone designator, and JavaScript
    parses such strings as *local* time — shifting every displayed timestamp by the
    viewer's UTC offset. Stamping UTC here keeps the wire format unambiguous without
    needing a migration on every table.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


async def should_notify(session, customer_id: uuid.UUID, category: str) -> bool:
    """category is one of 'likes', 'comments', 'follows', 'messages', 'weekly_digest'."""
    pref = await session.get(NotificationPreference, customer_id)
    if not pref:
        return True  # default-on until the user sets preferences
    return bool(getattr(pref, category, True))

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
    async def connect(self, customer_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(customer_id, []).append(websocket)
    def disconnect(self, customer_id: str, websocket: WebSocket):
        if customer_id in self.active_connections:
            self.active_connections[customer_id] = [ws for ws in self.active_connections[customer_id] if ws != websocket]
            if not self.active_connections[customer_id]: del self.active_connections[customer_id]
    async def broadcast_to_user(self, customer_id: str, message: dict):
        # Attach a per-call UUID so the frontend can de-duplicate messages that arrive
        # from both transports (WebSocket + pubsub).  Clients that don't care about
        # de-duplication simply ignore this field — no breaking change.
        message.setdefault("message_id", str(uuid.uuid4()))
        if customer_id in self.active_connections:
            for connection in self.active_connections[customer_id]:
                try: await connection.send_json(message)
                except Exception:
                    logger.warning("WebSocket send failed for user %s", customer_id, exc_info=True)
        try:
            from app.utils.pubsub import publish_message
            await publish_message(customer_id, message.get("type", "notification"), message.get("data") or message)
        except Exception:
            logger.warning("pubsub notification fallback failed for user %s", customer_id, exc_info=True)


ws_manager = ConnectionManager()

class CreateCommentRequest(BaseModel): content: str
class CreatePostRequest(BaseModel):
    caption: str; location: str | None = None; destination_id: str | None = None
    images: list[str]; itinerary_id: str | None = None; video_url: str | None = None; is_reel: bool = False
class CommentResponse(BaseModel):
    id: str; author_name: str; author_avatar: str | None; content: str; created_at: str; customer_id: str
class PaginatedCommentsResponse(BaseModel):
    comments: list[CommentResponse]; total_count: int; has_more: bool
class ReactRequest(BaseModel): reaction_type: str

async def _get_posts_reactions(session, post_ids: list[uuid.UUID], customer_id: uuid.UUID | None):
    if not post_ids: return {}, {}
    summary_q = select(PostReaction.post_id, PostReaction.reaction_type, func.count(PostReaction.id)).where(PostReaction.post_id.in_(post_ids)).group_by(PostReaction.post_id, PostReaction.reaction_type)
    summary_res = await session.execute(summary_q)
    summary = {p_id: {"like": 0, "wanderlust": 0, "been_there": 0, "bucket_list": 0, "take_me_here": 0} for p_id in post_ids}
    for p_id, r_type, count in summary_res.all():
        if p_id in summary: summary[p_id][r_type] = count
    customer_reactions = {}
    if customer_id:
        cust_q = select(PostReaction.post_id, PostReaction.reaction_type).where(PostReaction.post_id.in_(post_ids), PostReaction.customer_id == customer_id)
        for p_id, r_type in (await session.execute(cust_q)).all(): customer_reactions[p_id] = r_type
    return summary, customer_reactions

async def _serialize_posts(session, posts: list[CommunityPost], customer_id: uuid.UUID | None):
    if not posts: return []
    post_ids = [p.id for p in posts]
    reactions_summary, customer_reactions = await _get_posts_reactions(session, post_ids, customer_id)

    # Author profiles and destinations are batch-loaded here rather than read off
    # CommunityPost.author / .destination. Those are lazy relationships, and a lazy
    # load under async SQLAlchemy raises MissingGreenlet — which getattr(..., None)
    # does NOT swallow, since it only catches AttributeError. Relying on each caller
    # to remember an eager-load option is what previously 500'd the single-post,
    # profile-posts, hashtag and destination-detail endpoints.
    author_ids = {p.customer_id for p in posts if p.customer_id}
    profiles_by_customer: dict[uuid.UUID, CommunityProfile] = {}
    if author_ids:
        profiles_by_customer = {
            prof.customer_id: prof
            for prof in (await session.execute(
                select(CommunityProfile).where(CommunityProfile.customer_id.in_(author_ids))
            )).scalars().all()
        }

    destination_ids = {p.destination_id for p in posts if p.destination_id}
    destinations_by_id = {}
    if destination_ids:
        from app.models.destinations import Destination
        destinations_by_id = {
            dest.id: dest
            for dest in (await session.execute(
                select(Destination).where(Destination.id.in_(destination_ids))
            )).scalars().all()
        }

    following_set = set()
    if customer_id:
        from app.models.community import UserFollow
        author_ids = {p.customer_id for p in posts}
        following_res = await session.execute(
            select(UserFollow.following_id).where(UserFollow.follower_id == customer_id, UserFollow.following_id.in_(author_ids))
        )
        following_set = set(following_res.scalars().all())
    itinerary_ids = [p.itinerary_id for p in posts if p.itinerary_id]
    trips_dict = {}
    if itinerary_ids:
        from app.models.trips import Trip
        for trip in (await session.execute(select(Trip).where(Trip.id.in_(itinerary_ids)))).scalars().all():
            trips_dict[trip.id] = {"id": str(trip.id), "title": trip.title, "destination": trip.destination, "days": trip.days, "budget": trip.budget, "image": trip.image}
    post_hashtags_dict = {}
    for p_id, tag in (await session.execute(select(PostHashtag.post_id, Hashtag.tag).join(Hashtag, PostHashtag.hashtag_id == Hashtag.id).where(PostHashtag.post_id.in_(post_ids)))).all():
        post_hashtags_dict.setdefault(p_id, []).append(tag)
    response = []
    for post in posts:
        p_reacts = reactions_summary.get(post.id, {})
        user_react = customer_reactions.get(post.id)
        dest_dict = None
        dest = destinations_by_id.get(post.destination_id) if post.destination_id else None
        if dest: dest_dict = {"id": str(dest.id), "name": dest.name, "country": getattr(dest, 'region', ''), "image_url": getattr(dest, 'image_url', ''), "latitude": getattr(dest, 'latitude', None), "longitude": getattr(dest, 'longitude', None)}
        prof = profiles_by_customer.get(post.customer_id)
        prof_dict = {"name": prof.name, "avatar": prof.avatar_url, "is_verified": bool(prof.is_verified), "countries_visited": prof.countries_visited or 0, "local_in": prof.local_in} if prof else {}
        response.append({
            "id": str(post.id),
            "author": {"id": str(post.customer_id), "name": prof_dict.get("name") or post.author_name or "Traveler", "avatar": prof_dict.get("avatar") or post.author_avatar, "is_verified": prof_dict.get("is_verified", False), "countries_visited": prof_dict.get("countries_visited", 0), "local_in": prof_dict.get("local_in")},
            "location": post.location, "destination": dest_dict, "images": post.images, "caption": post.caption,
            "likes": sum(p_reacts.values()) if p_reacts else post.likes_count, "comments": post.comments_count, "comments_count": post.comments_count,
            "views_count": post.views_count, "is_reel": getattr(post, 'is_reel', False), "video_url": getattr(post, 'video_url', None),
            "isLiked": user_react is not None, "timeAgo": iso_utc(post.created_at), "created_at": iso_utc(post.created_at),
            "reactions": p_reacts, "user_reaction": user_react, "itinerary_id": str(post.itinerary_id) if post.itinerary_id else None,
            "itinerary": trips_dict.get(post.itinerary_id) if post.itinerary_id else None, "is_following": post.customer_id in following_set, "hashtags": post_hashtags_dict.get(post.id, [])
        })
    return response
