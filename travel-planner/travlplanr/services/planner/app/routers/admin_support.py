from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from shared.database import get_db
from shared.auth_dependencies import require_staff
from app.models.support import SupportTicket

router = APIRouter()

class SupportTicketUpdate(BaseModel):
    status: str

class SupportTicketResponse(BaseModel):
    id: uuid.UUID
    customer_id: Optional[uuid.UUID]
    customer_name: str
    customer_email: str
    subject: str
    message: str
    status: str
    created_at: datetime

@router.get("/", response_model=List[SupportTicketResponse])
async def list_tickets(
    status: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    query = select(SupportTicket).order_by(SupportTicket.created_at.desc())
    if status:
        query = query.where(SupportTicket.status == status)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{ticket_id}", response_model=SupportTicketResponse)
async def update_ticket_status(ticket_id: uuid.UUID, update_data: SupportTicketUpdate, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_staff)):
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.status = update_data.status
    await db.commit()
    await db.refresh(ticket)
    return ticket
