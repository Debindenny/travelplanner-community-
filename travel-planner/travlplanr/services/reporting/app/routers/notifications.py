"""
Notification endpoints — reporting service (E17).
Powers the admin header notification badge.
"""

from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy import select, func

from shared.auth_dependencies import require_staff
from app.models.notifications import AdminNotification

router = APIRouter()


@router.get("")
async def list_notifications(
    request: Request,
    unread: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: dict = Depends(require_staff),
):
    """List notifications — powers the header badge count and dropdown."""
    tenant_id = uuid.UUID(auth["tenant_id"])
    async with request.app.state.session_factory() as session:
        # Get unread count
        unread_q = await session.execute(
            select(func.count()).where(
                AdminNotification.tenant_id == tenant_id,
                AdminNotification.is_read == False
            )
        )
        unread_count = unread_q.scalar() or 0

        # Query builder
        base_query = select(AdminNotification).where(AdminNotification.tenant_id == tenant_id)
        if unread:
            base_query = base_query.where(AdminNotification.is_read == False)

        # Get total for this filter
        total_q = await session.execute(select(func.count()).select_from(base_query.subquery()))
        total = total_q.scalar() or 0

        # Get paginated items
        offset = (page - 1) * page_size
        items_q = await session.execute(
            base_query.order_by(AdminNotification.created_at.desc())
            .offset(offset).limit(page_size)
        )
        items = items_q.scalars().all()

    return {
        "unread_count": unread_count,
        "items": [item.to_dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Mark a notification as read."""
    tenant_id = uuid.UUID(auth["tenant_id"])
    async with request.app.state.session_factory() as session:
        try:
            notif_uuid = uuid.UUID(notification_id)
        except ValueError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
            
        result = await session.execute(
            select(AdminNotification).where(
                AdminNotification.id == notif_uuid, 
                AdminNotification.tenant_id == tenant_id
            )
        )
        notif = result.scalar_one_or_none()
        if not notif:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
            
        notif.is_read = True
        await session.commit()
        
    return {"status": "ok"}
