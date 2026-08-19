"""
Admin customer management endpoints — identity service.
Replaces the hardcoded customerList array in customer.component.ts.
"""

from __future__ import annotations

import httpx
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import User, UserStatus
from app.models.customer_profiles import CustomerProfile, CustomerType
from app.models.customer_assignments import CustomerAssignment, AssignmentRole
from shared.auth_dependencies import require_staff

router = APIRouter()

# Dependency-free email check (email-validator/EmailStr is not installed).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# --- Schemas ---

class CustomerKpis(BaseModel):
    total: int
    active: int
    inactive: int


class CustomerListItem(BaseModel):
    id: str
    display_code: str
    name: str
    email: str
    phone: str | None
    customer_type: str | None
    date_joined: str
    is_active: bool
    ltv: float
    segment: str


class CustomerDetail(BaseModel):
    id: str
    display_code: str
    name: str
    email: str
    phone: str | None
    customer_type: str | None
    is_active: bool
    last_login_at: str | None
    date_joined: str
    stats: dict[str, Any]


class CustomerListResponse(BaseModel):
    kpis: CustomerKpis
    items: list[CustomerListItem]
    page: int
    page_size: int
    total: int
    total_pages: int


class CreateCustomerRequest(BaseModel):
    name: str
    email: str
    phone: str | None = None
    customer_type: str | None = None

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


# --- Endpoints ---

@router.get("", response_model=CustomerListResponse)
async def list_customers(
    request: Request,
    period: str = Query("last_30d"),
    status_filter: str = Query("all", alias="status"),
    sort: str = Query("-date_joined"),
    q: str = Query("", description="Search name/phone/email"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: dict = Depends(require_staff),
):
    """List customers with real pagination, search, sort, and filter."""
    async with request.app.state.session_factory() as session:
        # Base query: non-deleted customers with their users
        base = (
            select(CustomerProfile, User.email, User.last_login_at)
            .join(User, CustomerProfile.user_id == User.id)
            .where(User.deleted_at.is_(None))
        )

        # Status filter
        if status_filter == "active":
            base = base.where(CustomerProfile.is_active.is_(True))
        elif status_filter == "inactive":
            base = base.where(CustomerProfile.is_active.is_(False))

        # Search
        if q:
            search_term = f"%{q}%"
            base = base.where(
                or_(
                    CustomerProfile.name.ilike(search_term),
                    CustomerProfile.phone.ilike(search_term),
                    User.email.ilike(search_term),
                    CustomerProfile.display_code.ilike(search_term),
                )
            )

        # Count total (filtered)
        count_q = select(func.count()).select_from(base.subquery())
        total_result = await session.execute(count_q)
        total = total_result.scalar() or 0

        # Sort
        if sort == "-date_joined":
            base = base.order_by(CustomerProfile.date_joined.desc())
        elif sort == "date_joined":
            base = base.order_by(CustomerProfile.date_joined.asc())
        elif sort == "name":
            base = base.order_by(CustomerProfile.name.asc())
        else:
            base = base.order_by(CustomerProfile.date_joined.desc())

        # Paginate
        offset = (page - 1) * page_size
        base = base.offset(offset).limit(page_size)

        result = await session.execute(base)
        rows = result.all()

        import hashlib
        
        items = []
        for cp, email, _login in rows:
            # Pseudo-random mock values for demo since identity DB doesn't have LTV
            hash_val = int(hashlib.md5(str(cp.id).encode()).hexdigest(), 16)
            mock_ltv = float((hash_val % 5000) + 1250) if (hash_val % 3) != 0 else 0.0
            
            if mock_ltv > 4000:
                mock_segment = "High Value"
            elif mock_ltv > 0:
                mock_segment = "Active Customer"
            elif (hash_val % 5) == 0:
                mock_segment = "Churn Risk"
            else:
                mock_segment = "Prospect"

            items.append(
                CustomerListItem(
                    id=str(cp.id),
                    display_code=cp.display_code,
                    name=cp.name,
                    email=email,
                    phone=cp.phone,
                    customer_type=cp.customer_type.value if cp.customer_type else None,
                    date_joined=cp.date_joined.isoformat() if cp.date_joined else "",
                    ltv=mock_ltv,
                    segment=mock_segment,
                )
            )

        # KPIs — computed over the FULL non-deleted set (not filtered)
        kpi_base = (
            select(CustomerProfile)
            .join(User, CustomerProfile.user_id == User.id)
            .where(User.deleted_at.is_(None))
        )
        total_all = (await session.execute(
            select(func.count()).select_from(kpi_base.subquery())
        )).scalar() or 0
        active_count = (await session.execute(
            select(func.count()).select_from(
                kpi_base.where(CustomerProfile.is_active.is_(True)).subquery()
            )
        )).scalar() or 0
        inactive_count = total_all - active_count

        total_pages = max(1, (total + page_size - 1) // page_size)

        return CustomerListResponse(
            kpis=CustomerKpis(total=total_all, active=active_count, inactive=inactive_count),
            items=items,
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )


@router.get("/recent")
async def recent_customers(request: Request, limit: int = Query(5), auth: dict = Depends(require_staff)):
    """Top N customers by date_joined DESC — powers dashboard Recent Customers."""
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(CustomerProfile, User.email)
            .join(User, CustomerProfile.user_id == User.id)
            .where(User.deleted_at.is_(None))
            .order_by(CustomerProfile.date_joined.desc())
            .limit(limit)
        )
        rows = result.all()
        customer_ids = [cp.id for cp, _ in rows]

        # Batch-load "onboarded by" staff names in two queries (avoids N+1).
        from app.models.staff import StaffProfile
        onboarded_by_map: dict = {}
        if customer_ids:
            assignments = (await session.execute(
                select(CustomerAssignment).where(
                    CustomerAssignment.customer_id.in_(customer_ids),
                    CustomerAssignment.role == AssignmentRole.ONBOARDED_BY,
                )
            )).scalars().all()
            staff_ids = {a.staff_id for a in assignments}
            staff_names: dict = {}
            if staff_ids:
                staff_rows = (await session.execute(
                    select(StaffProfile).where(StaffProfile.id.in_(staff_ids))
                )).scalars().all()
                staff_names = {s.id: s.name for s in staff_rows}
            onboarded_by_map = {
                a.customer_id: staff_names.get(a.staff_id, "Unknown") for a in assignments
            }

        items = []
        for cp, email in rows:
            onboarded_by = onboarded_by_map.get(cp.id, "Unknown")

            # Relative time
            now = datetime.now(timezone.utc)
            diff = now - cp.date_joined.replace(tzinfo=timezone.utc) if cp.date_joined else None
            if diff:
                if diff.total_seconds() < 3600:
                    relative_time = f"{int(diff.total_seconds() / 60)}min ago"
                elif diff.total_seconds() < 86400:
                    relative_time = f"{int(diff.total_seconds() / 3600)}h ago"
                else:
                    relative_time = f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
            else:
                relative_time = ""

            items.append({
                "id": str(cp.id),
                "name": cp.name,
                "type": cp.customer_type.value if cp.customer_type else None,
                "onboardBy": onboarded_by,
                "time": relative_time,
            })

        return {"items": items}


@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(customer_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Customer detail — with stats from reporting E18 (stubbed for now)."""
    async with request.app.state.session_factory() as session:
        cid = uuid.UUID(customer_id)
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(CustomerProfile, User.email, User.last_login_at)
            .join(User, CustomerProfile.user_id == User.id)
            .where(CustomerProfile.id == cid, CustomerProfile.tenant_id == tenant_id)
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

        cp, email, last_login = row

        # Stats — fetched from reporting service
        stats = {"cancelled": 0, "itineraries": 0, "booked": 0, "pending": 0, "created": 0}
        try:
            import os
            reporting_url = os.getenv("REPORTING_URL", "http://reporting:8000")
            async with httpx.AsyncClient() as client:
                # Gateway or direct routing in local docker compose
                # In k8s/compose, 'reporting' resolves to the reporting service
                # We use HTTP internal port 8000
                internal_secret = os.getenv("INTERNAL_API_SECRET", "dev-internal-secret")
                res = await client.get(
                    f"{reporting_url}/api/v1/internal/stats/customer/{cid}",
                    params={"tenant_id": str(tenant_id)},
                    headers={"X-Internal-Secret": internal_secret},
                    timeout=2.0,
                )
                if res.status_code == 200:
                    stats = res.json()
        except Exception as e:
            # Fallback on zeros if reporting service is down
            pass

        return CustomerDetail(
            id=str(cp.id),
            display_code=cp.display_code,
            name=cp.name,
            email=email,
            phone=cp.phone,
            customer_type=cp.customer_type.value if cp.customer_type else None,
            is_active=cp.is_active,
            last_login_at=last_login.isoformat() if last_login else None,
            date_joined=cp.date_joined.isoformat() if cp.date_joined else "",
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(body: CreateCustomerRequest, request: Request, auth: dict = Depends(require_staff)):
    """Staff onboards a customer. Emits customer.created event."""
    from passlib.hash import argon2 as argon2_hash
    from shared.events import DomainEvent, EventType, STREAM_IDENTITY, DEFAULT_TENANT_ID
    from shared.redis_client import emit_event

    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(DEFAULT_TENANT_ID)

        # Check email uniqueness
        existing = await session.execute(
            select(User).where(User.email == body.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

        # Create user
        user = User(
            email=body.email,
            user_kind="customer",
            status=UserStatus.ACTIVE,
            tenant_id=tenant_id,
        )
        session.add(user)
        await session.flush()

        # Generate display_code CUSxxxxxx
        count_result = await session.execute(select(func.count()).select_from(CustomerProfile))
        count = (count_result.scalar() or 0) + 1
        display_code = f"CUS{count:06d}"

        customer_type = None
        if body.customer_type:
            try:
                customer_type = CustomerType(body.customer_type)
            except ValueError:
                pass

        profile = CustomerProfile(
            user_id=user.id,
            display_code=display_code,
            name=body.name,
            phone=body.phone,
            customer_type=customer_type,
            tenant_id=tenant_id,
        )
        session.add(profile)
        await session.commit()

        # Emit domain event
        event = DomainEvent(
            event_type=EventType.CUSTOMER_CREATED,
            subject_id=str(profile.id),
            tenant_id=str(tenant_id),
            payload={
                "name": profile.name,
                "display_code": display_code,
                "customer_type": body.customer_type,
            },
        )
        await emit_event(request.app.state.redis, STREAM_IDENTITY, event)

        return {
            "id": str(profile.id),
            "display_code": display_code,
            "name": profile.name,
            "is_active": True,
        }


@router.put("/{customer_id}")
async def update_customer(customer_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Update customer profile."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(CustomerProfile).where(
                CustomerProfile.id == uuid.UUID(customer_id),
                CustomerProfile.tenant_id == tenant_id
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

        body = await request.json()
        updated = False
        status_changed = False
        old_status = profile.is_active

        if "name" in body and profile.name != body["name"]: 
            profile.name = body["name"]
            updated = True
        if "phone" in body and profile.phone != body["phone"]: 
            profile.phone = body["phone"]
            updated = True
        if "customer_type" in body:
            try:
                new_type = CustomerType(body["customer_type"])
                if profile.customer_type != new_type:
                    profile.customer_type = new_type
                    updated = True
            except ValueError:
                pass
        if "is_active" in body and profile.is_active != body["is_active"]:
            profile.is_active = body["is_active"]
            status_changed = True

        await session.commit()
        
        from shared.events import DomainEvent, EventType, STREAM_IDENTITY
        from shared.redis_client import emit_event

        if status_changed:
            event = DomainEvent(
                event_type=EventType.CUSTOMER_STATUS_CHANGED,
                actor_user_id=auth.get("sub"),
                subject_id=str(profile.id),
                tenant_id=str(tenant_id),
                payload={"old_is_active": old_status, "new_is_active": profile.is_active},
            )
            await emit_event(request.app.state.redis, STREAM_IDENTITY, event)
            
        if updated:
            event = DomainEvent(
                event_type=EventType.CUSTOMER_UPDATED,
                actor_user_id=auth.get("sub"),
                subject_id=str(profile.id),
                tenant_id=str(tenant_id),
                payload={"name": profile.name, "phone": profile.phone, "customer_type": profile.customer_type.value if profile.customer_type else None},
            )
            await emit_event(request.app.state.redis, STREAM_IDENTITY, event)

        return {"id": str(profile.id), "status": "updated"}


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Soft-delete a customer (preserves history for audit/reporting)."""
    async with request.app.state.session_factory() as session:
        tenant_id = uuid.UUID(auth["tenant_id"])
        result = await session.execute(
            select(CustomerProfile).where(
                CustomerProfile.id == uuid.UUID(customer_id),
                CustomerProfile.tenant_id == tenant_id
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

        # Soft-delete: flag the user as deleted (lists filter on deleted_at) and
        # deactivate the profile, rather than hard-deleting the records.
        user_result = await session.execute(select(User).where(User.id == profile.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            user.deleted_at = datetime.now(timezone.utc)
        if hasattr(profile, "is_active"):
            profile.is_active = False

        from shared.events import DomainEvent, EventType, STREAM_IDENTITY
        from shared.redis_client import emit_event

        event = DomainEvent(
            event_type=EventType.CUSTOMER_DELETED,
            actor_user_id=auth.get("sub"),
            subject_id=str(profile.id),
            tenant_id=str(tenant_id),
            payload={"customer_type": profile.customer_type.value if profile.customer_type else None},
        )
        await emit_event(request.app.state.redis, STREAM_IDENTITY, event)
        await session.commit()
        return {"id": customer_id, "status": "deleted"}
