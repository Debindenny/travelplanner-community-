from __future__ import annotations

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from app.models.users import User, UserKind, UserStatus
from shared.auth_dependencies import require_staff

router = APIRouter()

class AgentListItem(BaseModel):
    id: str
    email: str
    status: str
    created_at: str


class AgentListResponse(BaseModel):
    items: list[AgentListItem]


class AgentStatusResponse(BaseModel):
    id: str
    status: str


@router.get("", response_model=AgentListResponse)
async def list_agents(request: Request, auth: dict = Depends(require_staff)):
    """List B2B agents (Corporate Admins and Travel Agents)."""
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(User)
            .where(User.user_kind.in_([UserKind.TRAVEL_AGENT, UserKind.CORPORATE_ADMIN]))
            .where(User.deleted_at.is_(None))
            .order_by(User.created_at.desc())
        )
        users = result.scalars().all()

        return AgentListResponse(
            items=[
                AgentListItem(
                    id=str(u.id),
                    email=u.email,
                    status=u.status.value,
                    created_at=u.created_at.isoformat() if u.created_at else "",
                )
                for u in users
            ]
        )

@router.post("/{agent_id}/approve", response_model=AgentStatusResponse)
async def approve_agent(agent_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Approve a B2B agent, activating their account."""
    async with request.app.state.session_factory() as session:
        uid = uuid.UUID(agent_id)
        user = await session.get(User, uid)
        if not user or user.user_kind not in [UserKind.TRAVEL_AGENT, UserKind.CORPORATE_ADMIN]:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")

        user.status = UserStatus.ACTIVE
        await session.commit()
        return AgentStatusResponse(id=str(user.id), status="approved")

@router.post("/{agent_id}/reject", response_model=AgentStatusResponse)
async def reject_agent(agent_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Reject a B2B agent, suspending their account."""
    async with request.app.state.session_factory() as session:
        uid = uuid.UUID(agent_id)
        user = await session.get(User, uid)
        if not user or user.user_kind not in [UserKind.TRAVEL_AGENT, UserKind.CORPORATE_ADMIN]:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")

        user.status = UserStatus.SUSPENDED
        await session.commit()
        return AgentStatusResponse(id=str(user.id), status="rejected")


@router.post("/me/keys", response_model=dict)
async def generate_api_key(request: Request, auth: dict = Depends(require_staff)):
    """Generate a long-lived API key for a B2B agent."""
    if auth.get("user_kind") not in ("travel_agent", "corporate_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent access required",
        )
    
    import secrets
    import json
    
    new_key = f"tp_key_{secrets.token_hex(24)}"
    redis = request.app.state.redis
    payload = {
        "sub": auth["sub"],
        "email": auth["email"],
        "user_kind": auth["user_kind"],
        "tenant_id": auth["tenant_id"],
        "role": auth.get("role", "Agent"),
    }
    
    # Cache key for 30 days (2592000 seconds)
    await redis.set(f"b2b_apikey:{new_key}", json.dumps(payload), ex=2592000)
    return {"api_key": new_key, "expires_in_seconds": 2592000}
