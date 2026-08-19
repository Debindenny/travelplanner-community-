"""
Admin staff management endpoints — identity service.
Replaces the hardcoded staffList array in staff.component.ts.
"""

from __future__ import annotations

import logging
import re
import uuid
import httpx
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query, Request, HTTPException, status, Depends
from pydantic import BaseModel, field_validator

# Dependency-free email check (email-validator/EmailStr is not installed).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import User, UserStatus, UserKind
from app.models.staff import StaffProfile, StaffRole
from shared.auth_dependencies import require_staff, require_manager
from shared.events import DomainEvent, EventType, STREAM_IDENTITY
from shared.redis_client import emit_event

logger = logging.getLogger(__name__)
router = APIRouter()


class StaffListItem(BaseModel):
    id: str
    display_code: str
    name: str
    email: str
    phone: str | None
    role: str
    date_joined: str
    is_active: bool


class StaffDetail(BaseModel):
    id: str
    display_code: str
    name: str
    email: str
    phone: str | None
    role: str
    is_active: bool
    last_login_at: str | None
    date_joined: str
    stats: dict[str, int]


class StaffListResponse(BaseModel):
    kpis: dict[str, int]
    items: list[StaffListItem]
    page: int
    page_size: int
    total: int
    total_pages: int


@router.get("", response_model=StaffListResponse)
async def list_staff(
    request: Request,
    status_filter: str = Query("all", alias="status"),
    sort: str = Query("-date_joined"),
    q: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: dict = Depends(require_staff),
):
    """List staff with real pagination — replaces hardcoded of 80."""
    async with request.app.state.session_factory() as session:
        base = (
            select(StaffProfile, User.email, User.last_login_at)
            .join(User, StaffProfile.user_id == User.id)
            .where(User.deleted_at.is_(None))
        )

        if status_filter == "active":
            base = base.where(StaffProfile.is_active.is_(True))
        elif status_filter == "inactive":
            base = base.where(StaffProfile.is_active.is_(False))

        if q:
            term = f"%{q}%"
            base = base.where(
                or_(
                    StaffProfile.name.ilike(term),
                    StaffProfile.phone.ilike(term),
                    User.email.ilike(term),
                    StaffProfile.display_code.ilike(term),
                )
            )

        # Total count
        count_q = select(func.count()).select_from(base.subquery())
        total = (await session.execute(count_q)).scalar() or 0

        # Sort
        if sort == "-date_joined":
            base = base.order_by(StaffProfile.date_joined.desc())
        else:
            base = base.order_by(StaffProfile.date_joined.desc())

        offset = (page - 1) * page_size
        base = base.offset(offset).limit(page_size)

        result = await session.execute(base)
        rows = result.all()

        items = [
            StaffListItem(
                id=str(sp.id),
                display_code=sp.display_code,
                name=sp.name,
                email=email,
                phone=sp.phone,
                role=sp.role.value,
                date_joined=sp.date_joined.isoformat() if sp.date_joined else "",
                is_active=sp.is_active,
            )
            for sp, email, _login in rows
        ]

        # KPIs
        kpi_base = (
            select(StaffProfile)
            .join(User, StaffProfile.user_id == User.id)
            .where(User.deleted_at.is_(None))
        )
        total_all = (await session.execute(
            select(func.count()).select_from(kpi_base.subquery())
        )).scalar() or 0
        active_count = (await session.execute(
            select(func.count()).select_from(
                kpi_base.where(StaffProfile.is_active.is_(True)).subquery()
            )
        )).scalar() or 0

        total_pages = max(1, (total + page_size - 1) // page_size)

        return StaffListResponse(
            kpis={"total": total_all, "active": active_count, "inactive": total_all - active_count},
            items=items,
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )


@router.get("/{staff_id}", response_model=StaffDetail)
async def get_staff(staff_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Staff detail — stats fetched live from the reporting service's E18 read model."""
    async with request.app.state.session_factory() as session:
        sid = uuid.UUID(staff_id)
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(StaffProfile, User.email, User.last_login_at)
            .join(User, StaffProfile.user_id == User.id)
            .where(StaffProfile.id == sid, StaffProfile.tenant_id == tenant_id)
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff not found")

        sp, email, last_login = row

        # Stats — live call to reporting; zeros if reporting is unreachable.
        stats = {"customers": 0, "itineraries": 0, "booked": 0, "pending": 0, "created": 0}
        try:
            import os
            reporting_url = os.getenv("REPORTING_URL", "http://reporting:8000")
            internal_secret = os.getenv("INTERNAL_API_SECRET", "dev-internal-secret")
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{reporting_url}/api/v1/internal/stats/staff/{sid}",
                    params={"tenant_id": str(tenant_id)},
                    headers={"X-Internal-Secret": internal_secret},
                    timeout=2.0,
                )
                if res.status_code == 200:
                    stats = res.json()
        except Exception as e:
            logger.warning(f"Failed to fetch staff stats from reporting: {e}")

        return StaffDetail(
            id=str(sp.id),
            display_code=sp.display_code,
            name=sp.name,
            email=email,
            phone=sp.phone,
            role=sp.role.value,
            is_active=sp.is_active,
            last_login_at=last_login.isoformat() if last_login else None,
            date_joined=sp.date_joined.isoformat() if sp.date_joined else "",
            stats=stats,
        )


class StaffCreateBody(BaseModel):
    name: str
    email: str
    phone: str | None = None
    role: str = "Staff"

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        if not _EMAIL_RE.match((v or "").strip()):
            raise ValueError("Invalid email address")
        return v.strip()

    @field_validator("name")
    @classmethod
    def _name_required(cls, v: str) -> str:
        if not (v or "").strip():
            raise ValueError("Name is required")
        return v.strip()


class StaffUpdateBody(BaseModel):
    name: str | None = None
    phone: str | None = None
    role: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def _name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v else v


@router.post("")
async def create_staff(body: StaffCreateBody, request: Request, auth: dict = Depends(require_manager)):
    """Create a new staff member."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        
        # Check if user exists
        result = await session.execute(select(User).where(User.email == body.email))
        if result.scalar_one_or_none():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

        from sqlalchemy.exc import IntegrityError
        import secrets

        for attempt in range(3):
            try:
                user = User(
                    email=body.email,
                    user_kind=UserKind.STAFF,
                    status=UserStatus.ACTIVE,
                    tenant_id=tenant_id,
                )
                session.add(user)
                await session.flush()

                random_suffix = "".join(secrets.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(6))
                display_code = f"TPE{random_suffix}"

                try:
                    role = StaffRole(body.role)
                except ValueError:
                    role = StaffRole.STAFF

                profile = StaffProfile(
                    user_id=user.id,
                    display_code=display_code,
                    name=body.name,
                    phone=body.phone,
                    role=role,
                    tenant_id=tenant_id,
                )
                session.add(profile)
                await session.commit()
                break
            except IntegrityError as e:
                await session.rollback()
                if "user_email_key" in str(e) or "ix_users_email" in str(e):
                    raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
                if attempt == 2:
                    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not generate unique display code")
                continue
        
        # Emit Domain Event
        event = DomainEvent(
            event_type=EventType.STAFF_CREATED,
            subject_id=str(profile.id),
            tenant_id=str(tenant_id),
            payload={"name": profile.name, "email": body.email, "role": role.value}
        )
        await emit_event(request.app.state.redis, STREAM_IDENTITY, event)

        return {"id": str(profile.id), "display_code": display_code, "status": "created"}


@router.put("/{staff_id}")
async def update_staff(staff_id: str, body: StaffUpdateBody, request: Request, auth: dict = Depends(require_manager)):
    """Update staff details."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(StaffProfile).where(StaffProfile.id == uuid.UUID(staff_id), StaffProfile.tenant_id == tenant_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff not found")

        if body.name is not None: profile.name = body.name
        if body.phone is not None: profile.phone = body.phone
        if body.role is not None:
            try:
                profile.role = StaffRole(body.role)
            except ValueError:
                pass
        if body.is_active is not None: profile.is_active = body.is_active

        await session.commit()
        return {"id": str(profile.id), "status": "updated"}


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(staff_id: str, request: Request, auth: dict = Depends(require_manager)):
    """Delete staff member."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(StaffProfile).where(StaffProfile.id == uuid.UUID(staff_id), StaffProfile.tenant_id == tenant_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff not found")

        user_result = await session.execute(select(User).where(User.id == profile.user_id))
        user = user_result.scalar_one_or_none()

        # Soft-delete: flag the user as deleted and deactivate the profile.
        if user:
            user.deleted_at = datetime.now(timezone.utc)
        if hasattr(profile, "is_active"):
            profile.is_active = False

        event = DomainEvent(
            event_type=EventType.STAFF_DELETED,
            actor_user_id=auth.get("sub"),
            subject_id=str(profile.id),
            tenant_id=str(tenant_id),
            payload={"role": profile.role.value if getattr(profile, "role", None) else None},
        )
        await emit_event(request.app.state.redis, STREAM_IDENTITY, event)
        await session.commit()
        from fastapi import Response
        return Response(status_code=status.HTTP_204_NO_CONTENT)
