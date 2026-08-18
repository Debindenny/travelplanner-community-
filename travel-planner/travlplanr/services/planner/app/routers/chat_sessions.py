"""Server-side chat session memory endpoints (T2.4).

Provides create/list/append/read for ChatSession and ChatMessage so the
server is the source of truth for logged-in users.  Frontend localStorage
remains a fast offline cache; these endpoints sync state on login and
across devices.

Uses the existing ChatSession / ChatMessage models from communications.py.
Migration 0019 adds a `title` column to chat_sessions and an `interaction_id`
column to chat_messages for learning-flywheel linkage.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from shared.auth_dependencies import require_customer
from shared.rate_limit import rate_limiter
from sqlalchemy import func, select

from app.models.communications import ChatMessage, ChatSession
from app.services.chat_learning_service import _customer_uuid

router = APIRouter()

_MAX_MESSAGES_PER_SESSION = 200
_MAX_SESSIONS_PER_CUSTOMER = 50


class CreateSessionRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    trip_id: str | None = None


class AppendMessageRequest(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)
    interaction_id: str | None = None


@router.post("", dependencies=[Depends(rate_limiter("chat-sessions", 30, 60))])
async def create_session(
    body: CreateSessionRequest,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Create a new chat session for the authenticated customer."""
    customer_id = _customer_uuid(auth)
    if not customer_id:
        raise HTTPException(status_code=400, detail="No customer identity")

    trip_uuid: uuid.UUID | None = None
    if body.trip_id:
        try:
            trip_uuid = uuid.UUID(body.trip_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid trip_id")

    async with request.app.state.session_factory() as session:
        count = (
            await session.scalar(
                select(func.count()).select_from(ChatSession).where(ChatSession.customer_id == customer_id)
            )
        ) or 0
        if count >= _MAX_SESSIONS_PER_CUSTOMER:
            raise HTTPException(
                status_code=429,
                detail=f"Maximum {_MAX_SESSIONS_PER_CUSTOMER} sessions per customer",
            )
        new_session = ChatSession(
            customer_id=customer_id,
            trip_id=trip_uuid,
            status="active",
        )
        # title column added by migration 0019 — set via setattr to survive
        # gracefully if the column hasn't been migrated yet.
        if body.title:
            try:
                setattr(new_session, "title", body.title)
            except Exception:
                pass
        session.add(new_session)
        await session.commit()
        await session.refresh(new_session)
        return {
            "id": str(new_session.id),
            "title": getattr(new_session, "title", None),
            "trip_id": str(new_session.trip_id) if new_session.trip_id else None,
            "created_at": new_session.created_at.isoformat(),
        }


@router.get("", dependencies=[Depends(rate_limiter("chat-sessions", 60, 60))])
async def list_sessions(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    auth: dict = Depends(require_customer),
):
    """List the customer's chat sessions, newest first."""
    customer_id = _customer_uuid(auth)
    if not customer_id:
        raise HTTPException(status_code=400, detail="No customer identity")

    async with request.app.state.session_factory() as session:
        rows = (
            await session.execute(
                select(ChatSession)
                .where(ChatSession.customer_id == customer_id)
                .order_by(ChatSession.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return [
            {
                "id": str(s.id),
                "title": getattr(s, "title", None),
                "trip_id": str(s.trip_id) if s.trip_id else None,
                "status": s.status,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
            }
            for s in rows
        ]


@router.get("/{session_id}/messages", dependencies=[Depends(rate_limiter("chat-sessions", 60, 60))])
async def get_messages(
    session_id: uuid.UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: dict = Depends(require_customer),
):
    """Return messages in a session, oldest first (ready to use as LLM history)."""
    customer_id = _customer_uuid(auth)
    async with request.app.state.session_factory() as session:
        chat_session = await session.get(ChatSession, session_id)
        if not chat_session:
            raise HTTPException(status_code=404, detail="Session not found")
        if chat_session.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="Not your session")

        messages = (
            await session.execute(
                select(ChatMessage)
                .where(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at)
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return [
            {
                "id": str(m.id),
                "role": m.sender,                  # existing field: sender
                "content": m.text_content or "",   # existing field: text_content
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]


@router.post(
    "/{session_id}/messages",
    dependencies=[Depends(rate_limiter("chat-sessions", 60, 60))],
)
async def append_message(
    session_id: uuid.UUID,
    body: AppendMessageRequest,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Append a user or assistant message to a session."""
    customer_id = _customer_uuid(auth)

    async with request.app.state.session_factory() as session:
        chat_session = await session.get(ChatSession, session_id)
        if not chat_session:
            raise HTTPException(status_code=404, detail="Session not found")
        if chat_session.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="Not your session")

        count = (
            await session.scalar(
                select(func.count()).select_from(ChatMessage).where(ChatMessage.session_id == session_id)
            )
        ) or 0
        if count >= _MAX_MESSAGES_PER_SESSION:
            raise HTTPException(
                status_code=429,
                detail=f"Session has reached the {_MAX_MESSAGES_PER_SESSION}-message limit",
            )

        msg = ChatMessage(
            session_id=session_id,
            sender=body.role,          # map role → sender (existing field)
            content_type="text",
            text_content=body.content, # map content → text_content (existing field)
        )
        # interaction_id column added by migration 0019
        if body.interaction_id:
            try:
                setattr(msg, "interaction_id", uuid.UUID(body.interaction_id))
            except (ValueError, AttributeError):
                pass

        session.add(msg)
        from datetime import datetime, timezone
        chat_session.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(msg)
        return {
            "id": str(msg.id),
            "role": msg.sender,
            "content": msg.text_content or "",
            "created_at": msg.created_at.isoformat(),
        }
