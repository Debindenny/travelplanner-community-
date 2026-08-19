from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select, desc, func, text, or_, and_
from pydantic import BaseModel

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import CommunityProfile, CommunityPost, UserFollow, Notification, PostHashtag, Block

from .community_shared import _serialize_posts, should_notify, ws_manager
from app.services.gamification import award_xp

router = APIRouter()

class UpdateCommunityProfileRequest(BaseModel):
    name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    local_in: str | None = None

@router.get("/profile/me")
async def get_my_community_profile(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        prof = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        if not prof:
            prof = CommunityProfile(customer_id=customer_id)
            session.add(prof)
            await session.commit()
            await session.refresh(prof)
        followers = (await session.execute(select(func.count(UserFollow.id)).where(UserFollow.following_id == customer_id))).scalar_one()
        following = (await session.execute(select(func.count(UserFollow.id)).where(UserFollow.follower_id == customer_id))).scalar_one()
        posts_count = (await session.execute(select(func.count(CommunityPost.id)).where(CommunityPost.customer_id == customer_id))).scalar_one()
        return {
            "customer_id": str(prof.customer_id),
            "name": prof.name or "",
            "bio": prof.bio,
            "profile_views": prof.profile_views,
            "followers_count": followers or 0,
            "following_count": following or 0,
            "posts_count": posts_count or 0,
            "is_verified": prof.is_verified,
            "countries_visited": prof.countries_visited,
            "local_in": prof.local_in,
            "avatar": prof.avatar_url
        }

@router.put("/profile/me")
async def update_my_community_profile(data: UpdateCommunityProfileRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        prof = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        if not prof:
            prof = CommunityProfile(customer_id=customer_id)
            session.add(prof)
        if data.name is not None: prof.name = data.name
        if data.bio is not None: prof.bio = data.bio
        if data.avatar is not None: prof.avatar_url = data.avatar
        if data.local_in is not None: prof.local_in = data.local_in
        await session.commit()
        followers = (await session.execute(select(func.count(UserFollow.id)).where(UserFollow.following_id == customer_id))).scalar_one()
        following = (await session.execute(select(func.count(UserFollow.id)).where(UserFollow.follower_id == customer_id))).scalar_one()
        posts_count = (await session.execute(select(func.count(CommunityPost.id)).where(CommunityPost.customer_id == customer_id))).scalar_one()
        return {
            "customer_id": str(prof.customer_id), "name": prof.name or "", "bio": prof.bio,
            "profile_views": prof.profile_views, "followers_count": followers or 0,
            "following_count": following or 0, "posts_count": posts_count or 0,
            "is_verified": prof.is_verified, "countries_visited": prof.countries_visited,
            "local_in": prof.local_in, "avatar": prof.avatar_url
        }

@router.get("/profile/{user_id}")
async def get_community_profile_by_id(user_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    async with request.app.state.session_factory() as session:
        profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == user_id))).scalar_one_or_none()
        if not profile:
            profile = CommunityProfile(customer_id=user_id)
            session.add(profile)
            await session.commit()
            await session.refresh(profile)
        followers_count = (await session.execute(select(func.count()).select_from(UserFollow).where(UserFollow.following_id == user_id))).scalar()
        return {
            "customer_id": str(profile.customer_id), "name": profile.name, "avatar": profile.avatar_url,
            "bio": profile.bio, "profile_views": profile.profile_views, "followers_count": followers_count or 0,
            "is_verified": profile.is_verified, "countries_visited": profile.countries_visited, "local_in": profile.local_in
        }

@router.get("/users/search")
async def search_users(q: str, request: Request, limit: int = 20, offset: int = 0, auth: dict = Depends(require_customer)):
    """Search community profiles by name, for starting a new DM with someone not yet followed."""
    viewer_id = UUID(auth["customer_id"])
    query = (q or "").strip()
    if not query:
        return []

    async with request.app.state.session_factory() as session:
        blocked_ids = (await session.execute(
            select(Block.blocker_id, Block.blocked_id).where(
                or_(Block.blocker_id == viewer_id, Block.blocked_id == viewer_id)
            )
        )).all()
        excluded_ids = {viewer_id}
        for blocker_id, blocked_id in blocked_ids:
            excluded_ids.add(blocker_id)
            excluded_ids.add(blocked_id)

        profiles = (await session.execute(
            select(CommunityProfile)
            .where(
                CommunityProfile.name.ilike(f"%{query}%"),
                CommunityProfile.customer_id.notin_(excluded_ids),
            )
            .order_by(CommunityProfile.name)
            .limit(limit)
            .offset(offset)
        )).scalars().all()
        if not profiles:
            return []

        candidate_ids = [p.customer_id for p in profiles]
        following_ids = set((await session.execute(
            select(UserFollow.following_id).where(
                UserFollow.follower_id == viewer_id, UserFollow.following_id.in_(candidate_ids)
            )
        )).scalars().all())

        return [
            {
                "id": str(prof.customer_id),
                "name": prof.name or "Traveler User",
                "avatar": prof.avatar_url or "/assets/images/default-avatar.svg",
                "is_following": prof.customer_id in following_ids,
            }
            for prof in profiles
        ]

@router.get("/users/{customer_id}")
async def get_user_profile(customer_id: UUID, request: Request, auth: dict | None = Depends(optional_customer)):
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        prof = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        
        identity = (await session.execute(
            text("SELECT name, avatar_url FROM customer_profiles WHERE id = :cid"),
            {"cid": customer_id}
        )).fetchone()
        real_name = identity[0] if identity and identity[0] else "Traveler"
        real_avatar = identity[1] if identity else None

        if prof:
            name = prof.name or real_name
            avatar = prof.avatar_url or real_avatar
            bio = prof.bio or "Avid traveler exploring the world, one city at a time. 🌍✈️"
            is_verified = prof.is_verified; countries_visited = prof.countries_visited; local_in = prof.local_in
        else:
            name = real_name
            avatar = real_avatar
            bio = "Avid traveler exploring the world, one city at a time. 🌍✈️"; is_verified = False; countries_visited = 0; local_in = None
        posts_count = (await session.execute(select(func.count()).select_from(CommunityPost).where(CommunityPost.customer_id == customer_id))).scalar() or 0
        followers_count = (await session.execute(select(func.count()).select_from(UserFollow).where(UserFollow.following_id == customer_id))).scalar() or 0
        following_count = (await session.execute(select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == customer_id))).scalar() or 0
        is_following = False
        if viewer_id:
            if (await session.execute(select(UserFollow).where(UserFollow.follower_id == viewer_id, UserFollow.following_id == customer_id))).scalar_one_or_none():
                is_following = True
        return {
            "customer_id": str(customer_id), "name": name, "avatar": avatar, "bio": bio, "is_verified": is_verified,
            "countries_visited": countries_visited, "local_in": local_in, "posts_count": posts_count,
            "followers_count": followers_count, "following_count": following_count, "is_following": is_following
        }

@router.post("/users/{customer_id}/view", dependencies=[Depends(rate_limiter("profile-view", 60, 60))])
async def record_profile_view(customer_id: UUID, request: Request, auth: dict | None = Depends(optional_customer)):
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    if viewer_id and viewer_id == customer_id:
        return {"status": "ok"}
    async with request.app.state.session_factory() as session:
        prof = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == customer_id))).scalar_one_or_none()
        if prof:
            prof.profile_views = (prof.profile_views or 0) + 1
            await session.commit()
    return {"status": "ok"}

@router.get("/users/{customer_id}/posts")
async def get_user_posts(customer_id: UUID, request: Request, limit: int = 20, offset: int = 0, auth: dict | None = Depends(optional_customer)):
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        from sqlalchemy.orm import selectinload
        query = select(CommunityPost).options(selectinload(CommunityPost.destination)).where(CommunityPost.customer_id == customer_id).order_by(desc(CommunityPost.created_at)).limit(limit).offset(offset)
        posts = (await session.execute(query)).scalars().all()
        return await _serialize_posts(session, posts, viewer_id)

@router.post("/users/{customer_id}/follow", dependencies=[Depends(rate_limiter("toggle-follow", 30, 60))])
async def toggle_follow(customer_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    follower_id = UUID(auth["customer_id"])
    if follower_id == customer_id: raise HTTPException(status_code=400, detail="Cannot follow yourself")
    async with request.app.state.session_factory() as session:
        existing_follow = (await session.execute(select(UserFollow).where(UserFollow.follower_id == follower_id, UserFollow.following_id == customer_id))).scalar_one_or_none()
        if existing_follow:
            await session.delete(existing_follow)
            action = "unfollowed"; is_following = False
        else:
            session.add(UserFollow(follower_id=follower_id, following_id=customer_id))
            action = "followed"; is_following = True
            await award_xp(session, follower_id, "follow_given")
            if await should_notify(session, customer_id, "follows"):
                follower_profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == follower_id))).scalar_one_or_none()
                follower_name = follower_profile.name if follower_profile and follower_profile.name else "Someone"
                message = f"{follower_name} started following you."
                notif = Notification(customer_id=customer_id, type="follow", actor_id=follower_id, message=message, link_url=f"/community/users/{follower_id}")
                session.add(notif)
                await session.flush()
                await ws_manager.broadcast_to_user(str(customer_id), {"type": "notification", "data": {"id": str(notif.id), "type": "follow", "actor_id": str(follower_id), "message": message, "link_url": f"/community/users/{follower_id}"}})
        await session.commit()
        return {"status": "success", "action": action, "is_following": is_following}

@router.get("/users/{customer_id}/followers")
async def get_followers(customer_id: UUID, request: Request, limit: int = 20, offset: int = 0, auth: dict | None = Depends(optional_customer)):
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        follows = (await session.execute(select(UserFollow).where(UserFollow.following_id == customer_id).order_by(desc(UserFollow.created_at)).limit(limit).offset(offset))).scalars().all()
        if not follows: return []
        
        follower_ids = [f.follower_id for f in follows]
        
        profiles = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id.in_(follower_ids)))).scalars().all()
        profile_map = {p.customer_id: p for p in profiles}
        
        following_set = set()
        if viewer_id:
            viewer_follows = (await session.execute(
                select(UserFollow.following_id).where(UserFollow.follower_id == viewer_id, UserFollow.following_id.in_(follower_ids))
            )).scalars().all()
            following_set = set(viewer_follows)
            
        response = []
        for follow in follows:
            prof = profile_map.get(follow.follower_id)
            is_following = follow.follower_id in following_set
            
            # Follow B4 logic for name
            name = prof.name if prof and prof.name else "Traveler User"
            
            response.append({
                "id": str(follow.follower_id), 
                "name": name, 
                "avatar": prof.avatar_url if prof else "/assets/images/default-avatar.svg", 
                "is_following": is_following
            })
        return response

@router.get("/users/{customer_id}/following")
async def get_following(customer_id: UUID, request: Request, limit: int = 20, offset: int = 0, auth: dict | None = Depends(optional_customer)):
    viewer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        follows = (await session.execute(select(UserFollow).where(UserFollow.follower_id == customer_id).order_by(desc(UserFollow.created_at)).limit(limit).offset(offset))).scalars().all()
        if not follows: return []
        
        following_ids = [f.following_id for f in follows]
        
        profiles = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id.in_(following_ids)))).scalars().all()
        profile_map = {p.customer_id: p for p in profiles}
        
        following_set = set()
        if viewer_id:
            viewer_follows = (await session.execute(
                select(UserFollow.following_id).where(UserFollow.follower_id == viewer_id, UserFollow.following_id.in_(following_ids))
            )).scalars().all()
            following_set = set(viewer_follows)
            
        response = []
        for follow in follows:
            prof = profile_map.get(follow.following_id)
            is_following = follow.following_id in following_set
            
            # Follow B4 logic for name
            name = prof.name if prof and prof.name else "Traveler User"
            
            response.append({
                "id": str(follow.following_id), 
                "name": name, 
                "avatar": prof.avatar_url if prof else "/assets/images/default-avatar.svg", 
                "is_following": is_following
            })
        return response
