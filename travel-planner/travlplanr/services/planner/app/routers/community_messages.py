import logging
from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select, or_, and_, update, desc
from datetime import datetime
from pydantic import BaseModel

from shared.auth_dependencies import require_customer
from shared.rate_limit import rate_limiter
from app.models.community import Conversation, DirectMessage, CommunityProfile, Notification, Block
from .community_shared import should_notify

logger = logging.getLogger(__name__)
router = APIRouter()

class SendMessageRequest(BaseModel):
    recipient_id: str
    content: str

@router.get("/conversations")
async def get_conversations(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        query = select(Conversation).where(
            or_(Conversation.participant1_id == customer_id, Conversation.participant2_id == customer_id)
        ).order_by(desc(Conversation.last_message_at))
        conversations = (await session.execute(query)).scalars().all()
        if not conversations: return []
        
        other_user_ids = [c.participant2_id if c.participant1_id == customer_id else c.participant1_id for c in conversations]
        profiles = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id.in_(other_user_ids)))).scalars().all()
        profile_map = {p.customer_id: p for p in profiles}
        
        from sqlalchemy import func
        conv_ids = [c.id for c in conversations]
        unread_query = select(DirectMessage.conversation_id, func.count()).where(
            DirectMessage.conversation_id.in_(conv_ids),
            DirectMessage.sender_id != customer_id,
            DirectMessage.is_read == False
        ).group_by(DirectMessage.conversation_id)
        unread_counts = dict((await session.execute(unread_query)).all())
        
        last_messages_query = (
            select(DirectMessage.conversation_id, DirectMessage.content)
            .distinct(DirectMessage.conversation_id)
            .where(DirectMessage.conversation_id.in_(conv_ids))
            .order_by(DirectMessage.conversation_id, DirectMessage.created_at.desc())
        )
        last_messages = dict((await session.execute(last_messages_query)).all())
        
        response = []
        for conv in conversations:
            other_user_id = conv.participant2_id if conv.participant1_id == customer_id else conv.participant1_id
            profile = profile_map.get(other_user_id)
            other_user_name = profile.name if profile and profile.name else "Traveler"
            other_user_avatar = profile.avatar_url if profile else None
            
            response.append({
                "id": str(conv.id),
                "other_user": {"id": str(other_user_id), "name": other_user_name, "avatar": other_user_avatar},
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "unread_count": unread_counts.get(conv.id, 0),
                "last_message_preview": last_messages.get(conv.id, "")
            })
        return response

@router.get("/{conversation_id}")
async def get_messages(conversation_id: UUID, request: Request, limit: int = 50, offset: int = 0, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    limit = max(1, min(limit, 100))
    async with request.app.state.session_factory() as session:
        conv = await session.get(Conversation, conversation_id)
        if not conv or (conv.participant1_id != customer_id and conv.participant2_id != customer_id):
            raise HTTPException(status_code=404, detail="Conversation not found")

        stmt = update(DirectMessage).where(
            DirectMessage.conversation_id == conversation_id,
            DirectMessage.sender_id != customer_id, DirectMessage.is_read == False
        ).values(is_read=True)
        await session.execute(stmt)
        await session.commit()

        query = (
            select(DirectMessage)
            .where(DirectMessage.conversation_id == conversation_id)
            .order_by(desc(DirectMessage.created_at), desc(DirectMessage.id))
            .limit(limit)
            .offset(offset)
        )
        messages = list((await session.execute(query)).scalars().all())
        messages.reverse()

        return [{
            "id": str(m.id), "sender_id": str(m.sender_id), "content": m.content,
            "is_read": m.is_read, "created_at": m.created_at.isoformat()
        } for m in messages]

@router.post("", dependencies=[Depends(rate_limiter("send-message", 30, 60))])
async def send_message(data: SendMessageRequest, request: Request, auth: dict = Depends(require_customer)):
    sender_id = UUID(auth["customer_id"])
    recipient_id = UUID(data.recipient_id)
    if sender_id == recipient_id: raise HTTPException(status_code=400, detail="Cannot send message to yourself")
    if not data.content or not data.content.strip(): raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(data.content) > 5000: raise HTTPException(status_code=400, detail="Message exceeds maximum length of 5000 characters")

    async with request.app.state.session_factory() as session:
        blocked = (await session.execute(select(Block).where(
            or_(
                and_(Block.blocker_id == recipient_id, Block.blocked_id == sender_id),
                and_(Block.blocker_id == sender_id, Block.blocked_id == recipient_id),
            )
        ))).scalar_one_or_none()
        if blocked:
            raise HTTPException(status_code=403, detail="You cannot message this user")

        query = select(Conversation).where(
            or_(
                and_(Conversation.participant1_id == sender_id, Conversation.participant2_id == recipient_id),
                and_(Conversation.participant1_id == recipient_id, Conversation.participant2_id == sender_id)
            )
        )
        conv = (await session.execute(query)).scalar_one_or_none()

        if not conv:
            conv = Conversation(participant1_id=sender_id, participant2_id=recipient_id, last_message_at=datetime.utcnow())
            session.add(conv)
            await session.flush()

        conv.last_message_at = datetime.utcnow()
        new_msg = DirectMessage(conversation_id=conv.id, sender_id=sender_id, content=data.content.strip())
        session.add(new_msg)

        if await should_notify(session, recipient_id, "messages"):
            sender_profile = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id == sender_id))).scalar_one_or_none()
            sender_name = sender_profile.name if sender_profile and sender_profile.name else "Someone"
            session.add(Notification(
                customer_id=recipient_id, type="message", actor_id=sender_id,
                message=f"{sender_name} sent you a message.", link_url=f"/community/messages/{conv.id}"
            ))

        await session.commit()

        try:
            from app.utils.pubsub import publish_message
            await publish_message(
                str(recipient_id),
                "direct_message",
                {
                    "id": str(new_msg.id),
                    "conversation_id": str(conv.id),
                    "sender_id": str(new_msg.sender_id),
                    "content": new_msg.content,
                    "is_read": new_msg.is_read,
                    "created_at": new_msg.created_at.isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Failed to publish WS message: {e}")

        return {
            "id": str(new_msg.id), "conversation_id": str(conv.id), "sender_id": str(new_msg.sender_id),
            "content": new_msg.content, "is_read": new_msg.is_read, "created_at": new_msg.created_at.isoformat()
        }
