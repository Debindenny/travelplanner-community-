import logging
import os
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import Story, StoryLike, StoryView, UserFollow, CommunityProfile
from app.utils.s3 import S3_PUBLIC_DOMAIN
from app.services.gamification import award_xp

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateStoryRequest(BaseModel):
    media_url: str | None = None
    caption: str | None = None


def _is_trusted_media_url(media_url: str) -> bool:
    """Stories must reference media we generated via /community/upload (S3/local
    storage), not an arbitrary external URL — otherwise story creation bypasses
    the magic-byte/size validation the upload pipeline enforces."""
    return media_url.startswith(S3_PUBLIC_DOMAIN) or media_url.startswith("/static/uploads/")


async def _engagement_maps(session, story_ids: list[UUID], viewer_id: UUID | None):
    """Batch-load likes_count/views_count for a set of stories, plus which of
    them the current viewer has liked. Three grouped queries instead of N+1."""
    if not story_ids:
        return {}, {}, set()

    likes_q = select(StoryLike.story_id, func.count()).where(StoryLike.story_id.in_(story_ids)).group_by(StoryLike.story_id)
    likes_count = dict((await session.execute(likes_q)).all())

    views_q = select(StoryView.story_id, func.count()).where(StoryView.story_id.in_(story_ids)).group_by(StoryView.story_id)
    views_count = dict((await session.execute(views_q)).all())

    liked_by_me: set = set()
    if viewer_id:
        liked_q = select(StoryLike.story_id).where(StoryLike.story_id.in_(story_ids), StoryLike.customer_id == viewer_id)
        liked_by_me = set((await session.execute(liked_q)).scalars().all())

    return likes_count, views_count, liked_by_me


def _serialize_story(story: Story, likes_count: dict, views_count: dict, liked_by_me: set) -> dict:
    return {
        "id": str(story.id), "media_url": story.media_url, "caption": story.caption,
        "created_at": story.created_at.isoformat(), "expires_at": story.expires_at.isoformat(),
        "likes_count": likes_count.get(story.id, 0),
        "views_count": views_count.get(story.id, 0),
        "liked_by_me": story.id in liked_by_me,
    }


@router.get("/feed")
async def get_stories_feed(request: Request, auth: dict | None = Depends(optional_customer)):
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        now = datetime.utcnow()
        if viewer_id:
            following_q = select(UserFollow.following_id).where(UserFollow.follower_id == viewer_id)
            following_ids = (await session.execute(following_q)).scalars().all()
            allowed_ids = list(following_ids) + [viewer_id]
            stories_q = select(Story).where(Story.customer_id.in_(allowed_ids), Story.expires_at > now).order_by(desc(Story.created_at))
        else:
            stories_q = select(Story).where(Story.expires_at > now).order_by(desc(Story.created_at)).limit(50)

        stories = (await session.execute(stories_q)).scalars().all()
        likes_count, views_count, liked_by_me = await _engagement_maps(session, [s.id for s in stories], viewer_id)

        feed_dict = {}
        for story in stories:
            cid = str(story.customer_id)
            if cid not in feed_dict:
                feed_dict[cid] = {"author": {"id": cid, "name": story.author_name, "avatar": story.author_avatar}, "stories": []}
            feed_dict[cid]["stories"].append(_serialize_story(story, likes_count, views_count, liked_by_me))
        return {"feed": list(feed_dict.values())}

@router.post("", dependencies=[Depends(rate_limiter("story-create", 10, 300))])
async def create_story(data: CreateStoryRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    caption = data.caption.strip() if data.caption else None
    if not data.media_url and not caption:
        raise HTTPException(status_code=400, detail="Story must include a caption, media, or both")
    if data.media_url and not _is_trusted_media_url(data.media_url):
        raise HTTPException(status_code=400, detail="media_url must come from /community/upload")
    if caption and len(caption) > 500:
        raise HTTPException(status_code=400, detail="Caption exceeds maximum length of 500 characters")

    async with request.app.state.session_factory() as session:
        profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=24)
        story = Story(
            customer_id=customer_id,
            author_name=(profile.name if profile else None) or auth.get("customer_name") or "Traveler",
            author_avatar=profile.avatar_url if profile else None, media_url=data.media_url,
            caption=caption, created_at=now, expires_at=expires_at
        )
        session.add(story)
        await award_xp(session, customer_id, "story_created")
        await session.commit()
        return {"status": "success", "story_id": str(story.id)}

@router.get("/user/{customer_id}")
async def get_user_stories(customer_id_raw: str, request: Request, auth: dict | None = Depends(optional_customer)):
    try:
        customer_id = UUID(customer_id_raw)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid customer_id format")
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        now = datetime.utcnow()
        stories_q = select(Story).where(Story.customer_id == customer_id, Story.expires_at > now).order_by(desc(Story.created_at))
        stories = (await session.execute(stories_q)).scalars().all()
        likes_count, views_count, liked_by_me = await _engagement_maps(session, [s.id for s in stories], viewer_id)
        return [_serialize_story(s, likes_count, views_count, liked_by_me) for s in stories]

@router.post("/{story_id}/like")
async def like_story(story_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        story = await session.get(Story, story_id)
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")

        existing = (await session.execute(
            select(StoryLike).where(StoryLike.story_id == story_id, StoryLike.customer_id == customer_id)
        )).scalar_one_or_none()

        if existing:
            await session.delete(existing)
            liked = False
        else:
            session.add(StoryLike(story_id=story_id, customer_id=customer_id))
            liked = True

        await session.commit()
        count = (await session.execute(
            select(func.count()).select_from(StoryLike).where(StoryLike.story_id == story_id)
        )).scalar_one()
        return {"liked": liked, "likes_count": count}

@router.post("/{story_id}/view")
async def record_story_view(story_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        story = await session.get(Story, story_id)
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")

        # Owners viewing their own story never count as a view. Everyone else's
        # view is recorded once — a Postgres upsert keeps repeat opens idempotent
        # without a separate SELECT-then-INSERT race.
        if story.customer_id != customer_id:
            profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
            stmt = pg_insert(StoryView).values(
                story_id=story_id, customer_id=customer_id,
                viewer_name=(profile.name if profile else None) or auth.get("customer_name") or "Traveler",
                viewer_avatar=profile.avatar_url if profile else None,
                created_at=datetime.utcnow(),
            ).on_conflict_do_nothing(index_elements=['story_id', 'customer_id'])
            await session.execute(stmt)
            await session.commit()

        count = (await session.execute(
            select(func.count()).select_from(StoryView).where(StoryView.story_id == story_id)
        )).scalar_one()
        return {"status": "success", "views_count": count}

@router.get("/{story_id}/viewers")
async def get_story_viewers(story_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        story = await session.get(Story, story_id)
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        if story.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="Only the story owner can see who viewed it")

        views_q = select(StoryView).where(StoryView.story_id == story_id).order_by(desc(StoryView.created_at))
        views = (await session.execute(views_q)).scalars().all()
        return [
            {
                "customer_id": str(v.customer_id), "name": v.viewer_name, "avatar": v.viewer_avatar,
                "viewed_at": v.created_at.isoformat(),
            }
            for v in views
        ]

@router.delete("/{story_id}")
async def delete_story(story_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        story = await session.get(Story, story_id)
        if not story: raise HTTPException(status_code=404, detail="Story not found")
        if story.customer_id != customer_id: raise HTTPException(status_code=403, detail="Not authorized to delete this story")
        await session.delete(story)
        await session.commit()
        return {"status": "success"}
