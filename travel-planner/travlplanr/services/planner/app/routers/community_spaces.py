from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import CommunitySpace, SpaceMember, CommunityProfile

router = APIRouter()


class CreateSpaceRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    cover_image: str | None = None


async def _member_counts(session, space_ids: list[UUID]) -> dict:
    if not space_ids:
        return {}
    rows = (await session.execute(
        select(SpaceMember.space_id, func.count(SpaceMember.id))
        .where(SpaceMember.space_id.in_(space_ids))
        .group_by(SpaceMember.space_id)
    )).all()
    return {space_id: count for space_id, count in rows}


async def _my_memberships(session, space_ids: list[UUID], customer_id: UUID | None) -> dict:
    if not customer_id or not space_ids:
        return {}
    rows = (await session.execute(
        select(SpaceMember.space_id, SpaceMember.role)
        .where(SpaceMember.space_id.in_(space_ids), SpaceMember.customer_id == customer_id)
    )).all()
    return {space_id: role for space_id, role in rows}


async def _authors_map(session, customer_ids: set[UUID]) -> dict:
    if not customer_ids:
        return {}
    profiles = (await session.execute(
        select(CommunityProfile).where(CommunityProfile.customer_id.in_(customer_ids))
    )).scalars().all()
    return {p.customer_id: p for p in profiles}


def _serialize_space(space: CommunitySpace, member_count: int, role: str | None, creator_profile: CommunityProfile | None) -> dict:
    return {
        "id": str(space.id),
        "name": space.name,
        "description": space.description,
        "cover_image": space.cover_image,
        "created_at": space.created_at.isoformat() if space.created_at else None,
        "created_by": {
            "id": str(space.created_by),
            "name": creator_profile.name if creator_profile and creator_profile.name else "Traveler",
            "avatar": creator_profile.avatar_url if creator_profile else None,
        },
        "member_count": member_count or 0,
        "is_joined": role is not None,
        "role": role,
    }


@router.post("", dependencies=[Depends(rate_limiter("space-create", 5, 3600))])
async def create_space(data: CreateSpaceRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    async with request.app.state.session_factory() as session:
        space = CommunitySpace(
            created_by=customer_id,
            name=data.name.strip(),
            description=data.description,
            cover_image=data.cover_image,
        )
        session.add(space)
        await session.flush()
        session.add(SpaceMember(space_id=space.id, customer_id=customer_id, role="admin"))
        await session.commit()
        await session.refresh(space)
        profile = (await session.execute(
            select(CommunityProfile).where(CommunityProfile.customer_id == customer_id)
        )).scalar_one_or_none()
        return _serialize_space(space, 1, "admin", profile)


@router.get("")
async def list_spaces(request: Request, limit: int = 20, offset: int = 0, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        spaces = (await session.execute(
            select(CommunitySpace).order_by(desc(CommunitySpace.created_at)).limit(limit).offset(offset)
        )).scalars().all()
        space_ids = [s.id for s in spaces]
        counts = await _member_counts(session, space_ids)
        memberships = await _my_memberships(session, space_ids, customer_id)
        authors = await _authors_map(session, {s.created_by for s in spaces})
        return [
            _serialize_space(s, counts.get(s.id, 0), memberships.get(s.id), authors.get(s.created_by))
            for s in spaces
        ]


@router.get("/mine")
async def get_my_spaces(request: Request, limit: int = 50, offset: int = 0, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        memberships = (await session.execute(
            select(SpaceMember).where(SpaceMember.customer_id == customer_id)
            .order_by(desc(SpaceMember.joined_at)).limit(limit).offset(offset)
        )).scalars().all()
        space_ids = [m.space_id for m in memberships]
        if not space_ids:
            return []
        spaces = (await session.execute(select(CommunitySpace).where(CommunitySpace.id.in_(space_ids)))).scalars().all()
        space_map = {s.id: s for s in spaces}
        counts = await _member_counts(session, space_ids)
        role_map = {m.space_id: m.role for m in memberships}
        authors = await _authors_map(session, {s.created_by for s in spaces})
        return [
            _serialize_space(space_map[sid], counts.get(sid, 0), role_map.get(sid), authors.get(space_map[sid].created_by))
            for sid in space_ids if sid in space_map
        ]


@router.get("/{space_id}")
async def get_space(space_id: UUID, request: Request, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        space = (await session.execute(select(CommunitySpace).where(CommunitySpace.id == space_id))).scalar_one_or_none()
        if not space:
            raise HTTPException(status_code=404, detail="Space not found")
        counts = await _member_counts(session, [space_id])
        memberships = await _my_memberships(session, [space_id], customer_id)
        profile = (await session.execute(
            select(CommunityProfile).where(CommunityProfile.customer_id == space.created_by)
        )).scalar_one_or_none()
        return _serialize_space(space, counts.get(space_id, 0), memberships.get(space_id), profile)


@router.post("/{space_id}/join", dependencies=[Depends(rate_limiter("space-join", 30, 60))])
async def toggle_space_membership(space_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        space = (await session.execute(select(CommunitySpace).where(CommunitySpace.id == space_id))).scalar_one_or_none()
        if not space:
            raise HTTPException(status_code=404, detail="Space not found")

        existing = (await session.execute(
            select(SpaceMember).where(SpaceMember.space_id == space_id, SpaceMember.customer_id == customer_id)
        )).scalar_one_or_none()

        if existing:
            if existing.role == "admin":
                admin_count = (await session.execute(
                    select(func.count(SpaceMember.id)).where(SpaceMember.space_id == space_id, SpaceMember.role == "admin")
                )).scalar() or 0
                if admin_count <= 1:
                    raise HTTPException(status_code=400, detail="creator cannot leave")
            await session.delete(existing)
            action = "left"
        else:
            session.add(SpaceMember(space_id=space_id, customer_id=customer_id, role="member"))
            action = "joined"

        await session.commit()
        member_count = (await session.execute(
            select(func.count(SpaceMember.id)).where(SpaceMember.space_id == space_id)
        )).scalar() or 0
        return {"status": "success", "action": action, "member_count": member_count}


@router.get("/{space_id}/members")
async def get_space_members(space_id: UUID, request: Request, limit: int = 50, offset: int = 0, auth: dict | None = Depends(optional_customer)):
    async with request.app.state.session_factory() as session:
        space = (await session.execute(select(CommunitySpace).where(CommunitySpace.id == space_id))).scalar_one_or_none()
        if not space:
            raise HTTPException(status_code=404, detail="Space not found")
        members = (await session.execute(
            select(SpaceMember).where(SpaceMember.space_id == space_id)
            .order_by(SpaceMember.joined_at.asc()).limit(limit).offset(offset)
        )).scalars().all()
        profiles = await _authors_map(session, {m.customer_id for m in members})
        result = []
        for m in members:
            prof = profiles.get(m.customer_id)
            result.append({
                "customer_id": str(m.customer_id),
                "name": prof.name if prof and prof.name else "Traveler",
                "avatar": prof.avatar_url if prof else None,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            })
        return result
