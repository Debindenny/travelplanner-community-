import logging
import os
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import Story, UserFollow, CommunityProfile
from app.utils.s3 import S3_PUBLIC_DOMAIN
from app.services.gamification import award_xp

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateStoryRequest(BaseModel):
    media_url: str
    caption: str | None = None


def _is_trusted_media_url(media_url: str) -> bool:
    """Stories must reference media we generated via /community/upload (S3/local
    storage), not an arbitrary external URL — otherwise story creation bypasses
    the magic-byte/size validation the upload pipeline enforces."""
    return media_url.startswith(S3_PUBLIC_DOMAIN) or media_url.startswith("/static/uploads/")

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
        feed_dict = {}
        for story in stories:
            cid = str(story.customer_id)
            if cid not in feed_dict:
                feed_dict[cid] = {"author": {"id": cid, "name": story.author_name, "avatar": story.author_avatar}, "stories": []}
            feed_dict[cid]["stories"].append({
                "id": str(story.id), "media_url": story.media_url, "caption": story.caption,
                "created_at": story.created_at.isoformat(), "expires_at": story.expires_at.isoformat()
            })
        return {"feed": list(feed_dict.values())}

@router.post("", dependencies=[Depends(rate_limiter("story-create", 10, 300))])
async def create_story(data: CreateStoryRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    if not _is_trusted_media_url(data.media_url):
        raise HTTPException(status_code=400, detail="media_url must come from /community/upload")
    if data.caption and len(data.caption) > 500:
        raise HTTPException(status_code=400, detail="Caption exceeds maximum length of 500 characters")

    async with request.app.state.session_factory() as session:
        profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=24)
        story = Story(
            customer_id=customer_id, author_name=profile.name if profile and profile.name else "Traveler",
            author_avatar=profile.avatar_url if profile else None, media_url=data.media_url,
            caption=data.caption, created_at=now, expires_at=expires_at
        )
        session.add(story)
        await award_xp(session, customer_id, "story_created")
        await session.commit()
        return {"status": "success", "story_id": str(story.id)}

@router.get("/user/{customer_id}")
async def get_user_stories(customer_id_raw: str, request: Request):
    try:
        customer_id = UUID(customer_id_raw)
    except (ValueError, TypeError):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid customer_id format")
    async with request.app.state.session_factory() as session:
        now = datetime.utcnow()
        stories_q = select(Story).where(Story.customer_id == customer_id, Story.expires_at > now).order_by(desc(Story.created_at))
        stories = (await session.execute(stories_q)).scalars().all()
        response = []
        for story in stories:
            response.append({
                "id": str(story.id), "media_url": story.media_url, "caption": story.caption,
                "created_at": story.created_at.isoformat(), "expires_at": story.expires_at.isoformat()
            })
        return response

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
