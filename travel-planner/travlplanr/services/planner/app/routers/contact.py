"""Public contact form — creates a support ticket customers/staff can triage."""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from shared.auth_dependencies import optional_customer
from shared.database import get_db
from shared.email import send_email
from shared.rate_limit import rate_limiter

from app.models.support import SupportTicket

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=20, max_length=5000)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        if not _EMAIL_RE.match(value.strip()):
            raise ValueError("Enter a valid email address.")
        return value.strip()


@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limiter("contact", 5, 300))])
async def submit_contact_message(
    body: ContactRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth: dict | None = Depends(optional_customer),
):
    """Create a support ticket from the public contact form. Works for logged-out visitors."""
    customer_id = uuid.UUID(auth["customer_id"]) if auth and "customer_id" in auth else None

    ticket = SupportTicket(
        customer_id=customer_id,
        customer_name=body.name.strip(),
        customer_email=body.email,
        subject=body.subject.strip(),
        message=body.message.strip(),
    )
    db.add(ticket)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not submit your message right now. Please try again shortly.",
        ) from exc

    await send_email(
        to=body.email,
        subject="We received your message",
        body=(
            f"Hi {body.name.strip()}, thanks for reaching out about \"{body.subject.strip()}\". "
            f"Our team will reply within 24 hours. Your reference ID is {ticket.id}."
        ),
    )

    return {"id": str(ticket.id), "status": "received"}
