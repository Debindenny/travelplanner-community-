import logging
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from sqlalchemy import case, select, desc
from sqlalchemy.orm import selectinload, joinedload

from shared.auth_dependencies import optional_customer
from app.models.community import CommunityPost, UserFollow

from .community_shared import _serialize_posts

logger = logging.getLogger(__name__)

router = APIRouter()

import base64
import json
from datetime import datetime

# Flat score bonus for posts from someone the viewer follows — enough to lift
# a followed author's post above a similarly-engaged stranger's without
# completely overriding engagement signal (see "For You" in DESIGN_ENHANCEMENT_PLAN.md).
#
# Rationale: with FOLLOWING_BOOST=10, a followed-author post with 0 engagement
# beats an unrelated author who has at most 4 combined likes/comments. A post
# from any author with >=5 engagement points still rises above all boosted posts,
# so popular content isn't suppressed — just delayed by one page of results.
#
# If you adjust this value:
#   * LOWER (5-8): reduces the "followed_author always_on_top" effect.
#   * HIGHER (>15): started pushing follower bias too far and risks burying fresh,
#     popular content behind stale boosted posts that only have 1 reaction.
FOLLOWING_BOOST = 10

@router.get("/feed")
async def get_feed(request: Request, limit: int = 20, cursor: Optional[str] = None, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        from sqlalchemy import func as sa_func
        engagement_expr = (CommunityPost.likes_count * 2 + CommunityPost.comments_count * 3 + sa_func.coalesce(CommunityPost.views_count, 0))

        following_id_set: set = set()
        if customer_id is not None:
            following_id_set = set(
                (await session.execute(
                    select(UserFollow.following_id).where(UserFollow.follower_id == customer_id)
                )).scalars().all()
            )

        if following_id_set:
            score_expr = engagement_expr + case(
                (CommunityPost.customer_id.in_(following_id_set), FOLLOWING_BOOST), else_=0
            )
        else:
            score_expr = engagement_expr

        query = select(CommunityPost).options(
            selectinload(CommunityPost.destination),
            joinedload(CommunityPost.author)
        )
        
        if cursor:
            try:
                decoded = json.loads(base64.b64decode(cursor).decode('utf-8'))
                last_score = decoded.get('s')
                last_created = datetime.fromisoformat(decoded.get('c'))

                query = query.where(
                    (score_expr < last_score) |
                    ((score_expr == last_score) & (CommunityPost.created_at < last_created))
                )
            except Exception as exc:
                logger.warning(f"Malformed cursor in feed, ignoring: {exc}", exc_info=True)

        query = query.order_by(score_expr.desc(), desc(CommunityPost.created_at)).limit(limit)
        result = await session.execute(query)
        posts = result.scalars().all()
        
        serialized = await _serialize_posts(session, posts, customer_id)
        
        next_cursor = None
        if len(posts) == limit:
            last_post = posts[-1]
            last_post_score = (last_post.likes_count * 2 + last_post.comments_count * 3 + (last_post.views_count or 0))
            if last_post.customer_id in following_id_set:
                last_post_score += FOLLOWING_BOOST
            cursor_data = {
                's': last_post_score,
                'c': last_post.created_at.isoformat()
            }
            next_cursor = base64.b64encode(json.dumps(cursor_data).encode('utf-8')).decode('utf-8')
            
        return {"posts": serialized, "nextCursor": next_cursor}

@router.get("/explore")
async def get_explore_feed(request: Request, limit: int = 10, cursor: Optional[str] = None, auth: dict | None = Depends(optional_customer)):
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        query = select(CommunityPost).options(
            selectinload(CommunityPost.destination),
            joinedload(CommunityPost.author)
        )
        
        if cursor:
            try:
                decoded = json.loads(base64.b64decode(cursor).decode('utf-8'))
                last_likes = decoded.get('l')
                last_created = datetime.fromisoformat(decoded.get('c'))

                query = query.where(
                    (CommunityPost.likes_count < last_likes) |
                    ((CommunityPost.likes_count == last_likes) & (CommunityPost.created_at < last_created))
                )
            except Exception as exc:
                logger.warning(f"Malformed cursor in explore, ignoring: {exc}", exc_info=True)

        query = query.order_by(desc(CommunityPost.likes_count), desc(CommunityPost.created_at)).limit(limit)
        posts = (await session.execute(query)).scalars().all()
        serialized = await _serialize_posts(session, posts, viewer_id)
        
        next_cursor = None
        if len(posts) == limit:
            last_post = posts[-1]
            cursor_data = {
                'l': last_post.likes_count,
                'c': last_post.created_at.isoformat()
            }
            next_cursor = base64.b64encode(json.dumps(cursor_data).encode('utf-8')).decode('utf-8')
            
        return {"posts": serialized, "nextCursor": next_cursor}
