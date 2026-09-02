from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select, desc, func, or_, and_
from pydantic import BaseModel

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import CommunityProfile, CommunityPost, UserFollow, Notification, PostHashtag, Block
from app.models.trips import Trip

from .community_shared import _serialize_posts, should_notify, ws_manager
from app.services.gamification import award_xp

router = APIRouter()

class UpdateCommunityProfileRequest(BaseModel):
    name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    local_in: str | None = None
    cover: str | None = None
    about: str | None = None
    interests: list[str] | None = None
    countries_visited: int | None = None
    post_visibility: str | None = None

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
        if data.cover is not None: prof.cover_url = data.cover
        if data.about is not None: prof.about = data.about
        if data.interests is not None: prof.interests = data.interests
        if data.countries_visited is not None: prof.countries_visited = data.countries_visited
        if data.post_visibility is not None: prof.post_visibility = data.post_visibility
        await session.commit()
        followers = (await session.execute(select(func.count(UserFollow.id)).where(UserFollow.following_id == customer_id))).scalar_one()
        following = (await session.execute(select(func.count(UserFollow.id)).where(UserFollow.follower_id == customer_id))).scalar_one()
        posts_count = (await session.execute(select(func.count(CommunityPost.id)).where(CommunityPost.customer_id == customer_id))).scalar_one()
        helpful = (await session.execute(select(func.coalesce(func.sum(CommunityPost.likes_count), 0)).where(CommunityPost.customer_id == customer_id))).scalar_one()
        trips_count = (await session.execute(select(func.count(Trip.id)).where(Trip.customer_id == customer_id))).scalar_one()
        return {
            "customer_id": str(prof.customer_id), "name": prof.name or "", "bio": prof.bio,
            "profile_views": prof.profile_views, "followers_count": followers or 0,
            "following_count": following or 0, "posts_count": posts_count or 0,
            "is_verified": prof.is_verified, "countries_visited": prof.countries_visited,
            "local_in": prof.local_in, "avatar": prof.avatar_url, "cover": prof.cover_url,
            "about": prof.about, "interests": prof.interests or [], "member_since": prof.created_at,
            "helpful_count": helpful or 0, "trips_count": trips_count or 0,
            "photos_count": posts_count or 0, "post_visibility": prof.post_visibility
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
            "is_verified": profile.is_verified, "countries_visited": profile.countries_visited, "local_in": profile.local_in,
            "about": profile.about, "interests": profile.interests or [], "post_visibility": profile.post_visibility
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

        # NOTE: we intentionally use the planner-owned `community_profiles` table
        # only. The identity-owned `customer_profiles` table lives in a different
        # database (identity_db) and is not readable from the planner connection.
        real_name = prof.name if prof and prof.name else "Traveler"
        real_avatar = prof.avatar_url if prof else None

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
        helpful_count = (await session.execute(select(func.coalesce(func.sum(CommunityPost.likes_count), 0)).where(CommunityPost.customer_id == customer_id))).scalar() or 0
        trips_count = (await session.execute(select(func.count()).select_from(Trip).where(Trip.customer_id == customer_id))).scalar() or 0
        photos_count = (await session.execute(select(func.count()).select_from(CommunityPost).where(CommunityPost.customer_id == customer_id, CommunityPost.images.isnot(None)))).scalar() or 0
        is_following = False

        # --- In Common (mutual connections / overlapping dates / shared circles) ---
        mutual_connections_count = 0
        mutual_connections = []
        overlapping_dates = 0
        shared_circles = 0
        shared_destinations = []
        if viewer_id and viewer_id != customer_id:
            if (await session.execute(select(UserFollow).where(UserFollow.follower_id == viewer_id, UserFollow.following_id == customer_id))).scalar_one_or_none():
                is_following = True
            viewer_following = set((await session.execute(
                select(UserFollow.following_id).where(UserFollow.follower_id == viewer_id)
            )).scalars().all())
            customer_following = set((await session.execute(
                select(UserFollow.following_id).where(UserFollow.follower_id == customer_id)
            )).scalars().all())
            common = (viewer_following & customer_following) - {customer_id}
            mutual_connections_count = len(common)
            if common:
                muts = (await session.execute(
                    select(CommunityProfile, UserFollow.created_at)
                    .join(UserFollow, UserFollow.following_id == CommunityProfile.customer_id)
                    .where(CommunityProfile.customer_id.in_(list(common)))
                    .order_by(UserFollow.created_at.desc())
                    .limit(6)
                )).all()
                mutual_connections = [
                    {"id": str(m.customer_id), "name": m.name or "Traveler", "avatar": m.avatar_url}
                    for m, _ in muts
                ]
            # Overlapping trips (date ranges intersect)
            viewer_trips = (await session.execute(select(Trip.start_date, Trip.end_date).where(Trip.customer_id == viewer_id))).all()
            customer_trips = (await session.execute(select(Trip.start_date, Trip.end_date, Trip.destination).where(Trip.customer_id == customer_id))).all()
            def _overlaps(a_start, a_end, b_start, b_end):
                try:
                    from datetime import date as _d
                    from datetime import datetime as _dt
                    f = lambda s: _dt.strptime(s.strip()[:10], "%Y-%m-%d").date() if s else None
                    as_, ae = f(a_start), f(a_end)
                    bs, be = f(b_start), f(b_end)
                    if not (as_ and ae and bs and be):
                        return False
                    return as_ <= be and bs <= ae
                except Exception:
                    return False
            for vt in viewer_trips:
                for ct in customer_trips:
                    if _overlaps(vt[0], vt[1], ct[0], ct[1]):
                        overlapping_dates += 1
            viewer_dests = set((await session.execute(
                select(Trip.destination).where(Trip.customer_id == viewer_id)
            )).scalars().all())
            normalized = lambda d: d.strip().lower() if d and d.strip() else None
            customer_dests = {normalized(ct[2]) for ct in customer_trips}
            viewer_dests_norm = {normalized(d) for d in viewer_dests}
            shared = (customer_dests & viewer_dests_norm) - {None}
            shared_circles = len(shared)
            # Keep original-cased destination names for display
            seen = set()
            for ct in customer_trips:
                norm = normalized(ct[2])
                if norm in shared and ct[2] not in seen:
                    shared_destinations.append(ct[2].strip())
                    seen.add(ct[2])
        return {
            "customer_id": str(customer_id), "name": name, "avatar": avatar, "bio": bio, "is_verified": is_verified,
            "countries_visited": countries_visited, "local_in": local_in, "posts_count": posts_count,
            "followers_count": followers_count, "following_count": following_count, "is_following": is_following,
            "cover": prof.cover_url if prof else None,
            "about": prof.about if prof else None,
            "interests": (prof.interests or []) if prof else [],
            "member_since": prof.created_at if prof else None,
            "helpful_count": helpful_count, "trips_count": trips_count, "photos_count": photos_count,
            "mutual_connections_count": mutual_connections_count,
            "mutual_connections": mutual_connections,
            "overlapping_dates": overlapping_dates,
            "shared_circles": shared_circles,
            "shared_destinations": shared_destinations,
            "post_visibility": prof.post_visibility if prof else "everyone",
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
