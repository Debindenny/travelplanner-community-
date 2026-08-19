"""Public footer newsletter signup."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.email import send_email
from shared.rate_limit import rate_limiter

from app.models.newsletter import NewsletterSubscriber

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class NewsletterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    consent: bool

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        if not _EMAIL_RE.match(value.strip()):
            raise ValueError("Enter a valid email address.")
        return value.strip()

    @field_validator("consent")
    @classmethod
    def _require_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Consent is required to subscribe.")
        return value


@router.post("/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limiter("newsletter", 5, 300))])
async def subscribe(body: NewsletterRequest, db: AsyncSession = Depends(get_db)):
    existing = (
        await db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.email == body.email))
    ).scalar_one_or_none()
    if existing:
        # Already subscribed — treat as success rather than erroring, so a
        # repeat signup from the same visitor doesn't look like a failure.
        return {"status": "subscribed"}

    subscriber = NewsletterSubscriber(email=body.email, consent=body.consent)
    db.add(subscriber)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not subscribe right now. Please try again shortly.",
        ) from exc

    await send_email(
        to=body.email,
        subject="You're subscribed to Travl Planr",
        body="Thanks for subscribing — we'll send trip inspiration and product updates here.",
    )
    return {"status": "subscribed"}
