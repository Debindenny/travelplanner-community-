import logging
import os
import uuid
import re
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select, desc, func, update
from sqlalchemy.exc import IntegrityError

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import (
    CommunityPost, PostReaction, Notification, PostComment, CommunityProfile, Hashtag, PostHashtag
)

from .community_shared import (
    CreatePostRequest, ReactRequest, CreateCommentRequest,
    CommentResponse, PaginatedCommentsResponse, _serialize_posts, _get_posts_reactions,
    ws_manager, should_notify, iso_utc
)
from app.services.gamification import award_xp

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/{post_id}/view", dependencies=[Depends(rate_limiter("post-view", 60, 60))])
async def view_post(post_id: UUID, request: Request, auth: dict | None = Depends(optional_customer)):
    async with request.app.state.session_factory() as session:
        post = (await session.execute(select(CommunityPost).where(CommunityPost.id == post_id))).scalar_one_or_none()
        if not post: raise HTTPException(status_code=404, detail="Post not found")
        await session.execute(update(CommunityPost).where(CommunityPost.id == post_id).values(views_count=CommunityPost.views_count + 1))
        await session.commit()
        await session.refresh(post)
        return {"status": "success", "views_count": post.views_count}

@router.post("/{post_id}/react", dependencies=[Depends(rate_limiter("post-react", 30, 60))])
async def toggle_reaction(post_id: UUID, data: ReactRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    reaction_type = data.reaction_type.strip().lower()
    if reaction_type not in ["like", "wanderlust", "been_there", "bucket_list", "take_me_here"]: raise HTTPException(status_code=400, detail="Invalid reaction type")

    async with request.app.state.session_factory() as session:
        post = (await session.execute(select(CommunityPost).where(CommunityPost.id == post_id))).scalar_one_or_none()
        if not post: raise HTTPException(status_code=404, detail="Post not found")
        existing = (await session.execute(select(PostReaction).where(PostReaction.post_id == post_id, PostReaction.customer_id == customer_id))).scalar_one_or_none()
        action = "added"
        if existing:
            if existing.reaction_type == reaction_type:
                await session.delete(existing)
                await session.execute(update(CommunityPost).where(CommunityPost.id == post_id).values(likes_count=func.greatest(0, CommunityPost.likes_count - 1)))
                action = "removed"
                reaction_type = None
            else:
                existing.reaction_type = reaction_type
                action = "updated"
        else:
            new_reaction = PostReaction(post_id=post_id, customer_id=customer_id, reaction_type=reaction_type)
            session.add(new_reaction)
            try:
                await session.commit()  # unique constraint protects against concurrent inserts
            except IntegrityError:
                await session.rollback()
                logger.warning("Concurrent reaction insert for post=%s user=%s — re-reading state", post_id, customer_id, exc_info=True)
                existing = (await session.execute(select(PostReaction).where(PostReaction.post_id == post_id, PostReaction.customer_id == customer_id))).scalar_one_or_none()
                if existing and existing.reaction_type == reaction_type:
                    # another request inserted the same reaction; counts are already correct
                    await session.refresh(post)
                    summary, customer_reacts = await _get_posts_reactions(session, [post_id], customer_id)
                    return {"status": "success", "action": "added", "reaction": reaction_type, "likes_count": post.likes_count, "reactions": summary.get(post_id, {})}
                # different reaction or stale row — re-insert to set the correct type
                session.add(PostReaction(post_id=post_id, customer_id=customer_id, reaction_type=reaction_type))
                # The rollback above expired every persistent instance, including
                # `post`. Reading post.customer_id below would trigger an implicit
                # refresh, which raises MissingGreenlet under async SQLAlchemy, so
                # reload it explicitly here.
                await session.refresh(post)
            await session.execute(update(CommunityPost).where(CommunityPost.id == post_id).values(likes_count=CommunityPost.likes_count + 1))
            try:
                await award_xp(session, customer_id, "reaction_given")
            except Exception:
                logger.warning("XP award failed (non-fatal)", exc_info=True)
            if post.customer_id != customer_id and await should_notify(session, post.customer_id, "likes"):
                actor_profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
                actor_name = actor_profile.name if actor_profile and actor_profile.name else "Someone"
                message = f"{actor_name} reacted to your post."
                notif = Notification(customer_id=post.customer_id, type="like", actor_id=customer_id, message=message, link_url=f"/community/posts/{post.id}")
                session.add(notif)
                await session.flush()
        await session.commit()
        await session.refresh(post)
        summary, customer_reacts = await _get_posts_reactions(session, [post_id], customer_id)
        return {"status": "success", "action": action, "reaction": reaction_type, "likes_count": post.likes_count, "reactions": summary.get(post_id, {})}

@router.post("/{post_id}/like", dependencies=[Depends(rate_limiter("post-like", 30, 60))])
async def toggle_like(post_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    return await toggle_reaction(post_id, ReactRequest(reaction_type="like"), request, auth)

@router.get("/{post_id}/comments")
async def get_comments(post_id: UUID, request: Request, limit: int = 10, offset: int = 0):
    async with request.app.state.session_factory() as session:
        post = (await session.execute(select(CommunityPost).where(CommunityPost.id == post_id))).scalar_one_or_none()
        if not post: raise HTTPException(status_code=404, detail="Post not found")
        count_result = await session.execute(select(func.count(PostComment.id)).where(PostComment.post_id == post_id))
        total_count = count_result.scalar() or 0
        query = select(PostComment).where(PostComment.post_id == post_id).order_by(desc(PostComment.created_at)).limit(limit).offset(offset)
        result = await session.execute(query)
        comments = result.scalars().all()
        comments_response = [
            CommentResponse(id=str(c.id), author_name=c.author_name, author_avatar=c.author_avatar, content=c.content, created_at=iso_utc(c.created_at), customer_id=str(c.customer_id))
            for c in comments
        ]
        has_more = (offset + limit) < total_count
        return PaginatedCommentsResponse(comments=comments_response, total_count=total_count, has_more=has_more)

@router.post("/{post_id}/comments", dependencies=[Depends(rate_limiter("post-comment", 20, 60))])
async def create_comment(post_id: UUID, data: CreateCommentRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    if not data.content or not data.content.strip(): raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    if len(data.content) > 1000: raise HTTPException(status_code=400, detail="Comment exceeds maximum length of 1000 characters")

    async with request.app.state.session_factory() as session:
        post = (await session.execute(select(CommunityPost).where(CommunityPost.id == post_id))).scalar_one_or_none()
        if not post: raise HTTPException(status_code=404, detail="Post not found")
        profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        new_comment = PostComment(
            post_id=post_id, customer_id=customer_id, author_name=profile.name if profile and profile.name else "Traveler",
            author_avatar=profile.avatar_url if profile else None, content=data.content.strip()
        )
        session.add(new_comment)
        await session.execute(update(CommunityPost).where(CommunityPost.id == post_id).values(comments_count=CommunityPost.comments_count + 1))
        await award_xp(session, customer_id, "comment_created")
        if post.customer_id != customer_id and await should_notify(session, post.customer_id, "comments"):
            message = f"{new_comment.author_name} commented on your post."
            notif = Notification(customer_id=post.customer_id, type="comment", actor_id=customer_id, message=message, link_url=f"/community/posts/{post.id}")
            session.add(notif)
            await session.flush()
            await ws_manager.broadcast_to_user(str(post.customer_id), {"type": "notification", "data": {"id": str(notif.id), "type": "comment", "actor_id": str(customer_id), "message": message, "link_url": f"/community/posts/{post.id}"}})
        await session.commit()
        return CommentResponse(id=str(new_comment.id), author_name=new_comment.author_name, author_avatar=new_comment.author_avatar, content=new_comment.content, created_at=iso_utc(new_comment.created_at), customer_id=str(new_comment.customer_id))

class UpdateCommentRequest(BaseModel):
    content: str

@router.patch("/{post_id}/comments/{comment_id}")
async def update_comment(post_id: UUID, comment_id: UUID, data: UpdateCommentRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    if not data.content or not data.content.strip(): raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    if len(data.content) > 1000: raise HTTPException(status_code=400, detail="Comment exceeds maximum length of 1000 characters")
    async with request.app.state.session_factory() as session:
        comment = (await session.execute(select(PostComment).where(PostComment.id == comment_id, PostComment.post_id == post_id))).scalar_one_or_none()
        if not comment: raise HTTPException(status_code=404, detail="Comment not found")
        if comment.customer_id != customer_id: raise HTTPException(status_code=403, detail="You can only edit your own comments")
        comment.content = data.content.strip()
        await session.commit()
        return CommentResponse(id=str(comment.id), author_name=comment.author_name, author_avatar=comment.author_avatar, content=comment.content, created_at=iso_utc(comment.created_at), customer_id=str(comment.customer_id))

@router.delete("/{post_id}/comments/{comment_id}")
async def delete_comment(post_id: UUID, comment_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        comment = (await session.execute(select(PostComment).where(PostComment.id == comment_id, PostComment.post_id == post_id))).scalar_one_or_none()
        if not comment: raise HTTPException(status_code=404, detail="Comment not found")
        if comment.customer_id != customer_id: raise HTTPException(status_code=403, detail="You can only delete your own comments")
        await session.delete(comment)
        await session.execute(update(CommunityPost).where(CommunityPost.id == comment.post_id).values(comments_count=func.greatest(0, CommunityPost.comments_count - 1)))
        await session.commit()
        return {"status": "success", "message": "Comment deleted"}

@router.post("/upload", dependencies=[Depends(rate_limiter("post-upload", 20, 60))])
async def upload_image(file: UploadFile = File(...), auth: dict = Depends(require_customer)):
    if not file.filename: raise HTTPException(status_code=400, detail="No filename provided")
    ext = os.path.splitext(file.filename)[1].lower()
    image_exts = [".jpg", ".jpeg", ".png", ".webp", ".gif"]; video_exts = [".mp4", ".webm", ".mov", ".m4v"]
    is_video = ext in video_exts
    if ext not in image_exts + video_exts: raise HTTPException(status_code=400, detail="Invalid file type. Allowed: jpg, png, webp, gif, mp4, webm, mov")
    max_size = 50 * 1024 * 1024 if is_video else 5 * 1024 * 1024
    if file.size and file.size > max_size: raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {50 if is_video else 5}MB")
    new_filename = f"{uuid.uuid4()}{ext}"
    from app.utils.s3 import upload_file_to_s3
    content = await file.read()
    
    # Magic byte validation
    magic_bytes = content[:12]
    is_valid_sig = False
    if magic_bytes.startswith(b'\xff\xd8\xff'): is_valid_sig = True  # JPEG
    elif magic_bytes.startswith(b'\x89PNG\r\n\x1a\n'): is_valid_sig = True  # PNG
    elif magic_bytes.startswith(b'GIF87a') or magic_bytes.startswith(b'GIF89a'): is_valid_sig = True  # GIF
    elif magic_bytes.startswith(b'RIFF') and magic_bytes[8:12] == b'WEBP': is_valid_sig = True  # WebP
    elif b'ftyp' in magic_bytes[4:12]: is_valid_sig = True  # MP4/MOV/M4V
    elif magic_bytes.startswith(b'\x1a\x45\xdf\xa3'): is_valid_sig = True  # WebM
    
    if not is_valid_sig:
        raise HTTPException(status_code=400, detail="Invalid file signature. File may be corrupt or malicious.")

    original_url = await upload_file_to_s3(content, new_filename, content_type=file.content_type or "image/jpeg")
    thumbnail_url = original_url
    try:
        from PIL import Image; import io
        img = Image.open(io.BytesIO(content))
        img.thumbnail((300, 300))
        thumb_io = io.BytesIO()
        img.save(thumb_io, format=img.format or "JPEG")
        thumbnail_url = await upload_file_to_s3(thumb_io.getvalue(), f"thumb_{new_filename}", content_type=file.content_type or "image/jpeg")
    except Exception:
        logger.warning("Thumbnail generation failed for %s, falling back to original image", new_filename, exc_info=True)
    return {"url": original_url, "thumbnailUrl": thumbnail_url}

@router.post("", dependencies=[Depends(rate_limiter("post-create", 10, 60))])
async def create_post(data: CreatePostRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    if not data.caption or not data.caption.strip(): raise HTTPException(status_code=400, detail="Caption cannot be empty")
    if len(data.caption) > 2000: raise HTTPException(status_code=400, detail="Caption exceeds maximum length of 2000 characters")
    if (not data.images or len(data.images) == 0) and not data.video_url: raise HTTPException(status_code=400, detail="At least one image or a video is required")

    async with request.app.state.session_factory() as session:
        dest_id_uuid = None
        if data.destination_id:
            try: dest_id_uuid = UUID(data.destination_id)
            except ValueError: pass

        itin_id_uuid = None
        if data.itinerary_id:
            try: itin_id_uuid = UUID(data.itinerary_id)
            except ValueError: pass

        customer_prof = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        if not customer_prof:
            customer_prof = CommunityProfile(customer_id=customer_id, name="Traveler", avatar_url=None)
            session.add(customer_prof)
            await session.flush()

        new_post = CommunityPost(
            customer_id=customer_id, author_name=customer_prof.name or "Traveler", author_avatar=customer_prof.avatar_url,
            location=data.location, destination_id=dest_id_uuid, images=data.images, caption=data.caption.strip(),
            likes_count=0, comments_count=0, itinerary_id=itin_id_uuid, video_url=data.video_url, is_reel=data.is_reel or bool(data.video_url)
        )
        session.add(new_post)
        await session.flush()
        await award_xp(session, customer_id, "post_created")

        tags = set(re.findall(r"#(\w+)", data.caption))
        for t in tags:
            t_lower = t.lower()
            hashtag = (await session.execute(select(Hashtag).where(Hashtag.tag == t_lower))).scalar_one_or_none()
            if not hashtag:
                # A concurrent request may insert the same new tag first. Do the
                # insert inside a SAVEPOINT so losing that race only rolls back
                # this one row — a plain session.rollback() here would discard the
                # whole transaction, silently throwing away the post itself and
                # then failing the commit on a dangling PostHashtag FK.
                try:
                    async with session.begin_nested():
                        hashtag = Hashtag(tag=t_lower)
                        session.add(hashtag)
                        await session.flush()
                except IntegrityError:
                    logger.warning("Duplicate hashtag '%s' during create_post — re-reading existing row", t_lower, exc_info=True)
                    hashtag = (await session.execute(select(Hashtag).where(Hashtag.tag == t_lower))).scalar_one_or_none()
            if not hashtag:
                # Lost the race and still can't see the row; skip the association
                # rather than crashing on hashtag.id.
                logger.warning("Could not resolve hashtag '%s' for post %s — skipping", t_lower, new_post.id)
                continue
            post_hashtag = PostHashtag(post_id=new_post.id, hashtag_id=hashtag.id)
            session.add(post_hashtag)

        await session.commit()
        serialized = await _serialize_posts(session, [new_post], customer_id)
        return serialized[0]

@router.get("/{post_id}")
async def get_post_by_id(post_id: UUID, request: Request, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        from sqlalchemy.orm import selectinload
        query = select(CommunityPost).options(selectinload(CommunityPost.destination)).where(CommunityPost.id == post_id)
        post = (await session.execute(query)).scalar_one_or_none()
        if not post: raise HTTPException(status_code=404, detail="Post not found")
        serialized = await _serialize_posts(session, [post], customer_id)
        return serialized[0]

class UpdatePostRequest(BaseModel):
    caption: str | None = None
    location: str | None = None

@router.delete("/{post_id}")
async def delete_post(post_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        post = (await session.execute(select(CommunityPost).where(CommunityPost.id == post_id))).scalar_one_or_none()
        if not post: raise HTTPException(status_code=404, detail="Post not found")
        if post.customer_id != customer_id: raise HTTPException(status_code=403, detail="You can only delete your own posts")
        await session.delete(post)
        await session.commit()
        return {"status": "success", "message": "Post deleted"}

@router.patch("/{post_id}")
async def update_post(post_id: UUID, data: UpdatePostRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        post = (await session.execute(select(CommunityPost).where(CommunityPost.id == post_id))).scalar_one_or_none()
        if not post: raise HTTPException(status_code=404, detail="Post not found")
        if post.customer_id != customer_id: raise HTTPException(status_code=403, detail="You can only edit your own posts")
        if data.caption is not None:
            post.caption = data.caption.strip()
        if data.location is not None:
            post.location = data.location.strip()
        await session.commit()
        await session.refresh(post)
        serialized = await _serialize_posts(session, [post], customer_id)
        return serialized[0]
