from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc, func, update

from shared.auth_dependencies import require_customer
from app.models.community import Notification, NotificationPreference

router = APIRouter()


class UpdateNotificationPreferencesRequest(BaseModel):
    likes: bool | None = None
    comments: bool | None = None
    follows: bool | None = None
    messages: bool | None = None
    weekly_digest: bool | None = None


def _serialize_preferences(pref: NotificationPreference) -> dict:
    return {
        "likes": pref.likes, "comments": pref.comments, "follows": pref.follows,
        "messages": pref.messages, "weekly_digest": pref.weekly_digest,
    }


@router.get("/preferences")
async def get_notification_preferences(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        pref = await session.get(NotificationPreference, customer_id)
        if not pref:
            pref = NotificationPreference(customer_id=customer_id)
            session.add(pref)
            await session.commit()
        return _serialize_preferences(pref)


@router.put("/preferences")
async def update_notification_preferences(data: UpdateNotificationPreferencesRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        pref = await session.get(NotificationPreference, customer_id)
        if not pref:
            pref = NotificationPreference(customer_id=customer_id)
            session.add(pref)
        for field in ("likes", "comments", "follows", "messages", "weekly_digest"):
            value = getattr(data, field)
            if value is not None:
                setattr(pref, field, value)
        await session.commit()
        await session.refresh(pref)
        return _serialize_preferences(pref)

@router.get("")
async def get_notifications(request: Request, limit: int = 20, offset: int = 0, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        query = select(Notification).where(Notification.customer_id == customer_id).order_by(desc(Notification.created_at)).limit(limit).offset(offset)
        notifications = (await session.execute(query)).scalars().all()

        response = []
        for n in notifications:
            response.append({
                "id": str(n.id), "type": n.type, "actor_id": str(n.actor_id) if n.actor_id else None,
                "message": n.message, "link_url": n.link_url, "is_read": n.is_read, "created_at": n.created_at.isoformat()
            })
        return response

@router.get("/unread-count")
async def get_unread_count(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        query = select(func.count()).select_from(Notification).where(Notification.customer_id == customer_id, Notification.is_read == False)
        count = (await session.execute(query)).scalar() or 0
        return {"unread_count": count}

@router.patch("/{notification_id}/read")
async def mark_notification_read(notification_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        n = await session.get(Notification, notification_id)
        if not n: raise HTTPException(status_code=404, detail="Notification not found")
        if n.customer_id != customer_id: raise HTTPException(status_code=403, detail="Not authorized")
        n.is_read = True
        await session.commit()
        return {"status": "success"}

@router.post("/read-all")
async def mark_all_read(request: Request, auth: dict = Depends(require_customer), limit: int = Query(default=500)):
    if limit < 1 or limit > 5000:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 5000")
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        # Early exit: if fewer notifications than the limit, just mark all in one shot.
        total_res = await session.execute(
            select(func.count(Notification.id)).where(
                Notification.customer_id == customer_id,
                Notification.is_read == False
            )
        )
        total_unread = total_res.scalar() or 0
        if total_unread <= limit:
            stmt = update(Notification).where(
                Notification.customer_id == customer_id,
                Notification.is_read == False
            ).values(is_read=True)
            await session.execute(stmt)
        else:
            # Update only the oldest `limit` unread messages — prevent a single user from
            # blowing up memory/CPU if they have thousands of notifications.
            ids_to_update = [
                n.id
                for n in (await session.execute(
                    select(Notification.id)
                    .where(
                        Notification.customer_id == customer_id,
                        Notification.is_read == False
                    )
                    .order_by(Notification.created_at.asc())
                    .limit(limit)
                )).scalars().all()
            ]
            if ids_to_update:
                stmt = update(Notification).where(Notification.id.in_(ids_to_update)).values(is_read=True)
                await session.execute(stmt)
        await session.commit()
        return {"status": "success", "marked_count": min(total_unread, limit)}
