from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Depends, Header, Request, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func

from app.models.trip_status_counts import TripStatusCount
from app.models.staff_customer_counts import StaffCustomerCount
from app.models.dashboard_metric_daily import DashboardMetricDaily

router = APIRouter()


# Shared secret for service-to-service calls (identity → reporting). These
# endpoints are not behind user auth, so callers must present this header.
async def verify_internal_secret(request: Request, x_internal_secret: str = Header(default="")):
    expected = request.app.state.settings.internal_api_secret
    if not secrets.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

class CustomerStats(BaseModel):
    cancelled: int
    itineraries: int
    booked: int
    pending: int
    created: int
    ltv: float
    segment: str

class StaffStats(BaseModel):
    customers: int
    itineraries: int
    booked: int
    pending: int
    created: int

@router.get("/customer/{customer_id}", response_model=CustomerStats)
async def get_customer_stats(
    customer_id: str,
    tenant_id: str,
    request: Request,
    _: None = Depends(verify_internal_secret),
):
    """Internal endpoint to fetch E18 customer stats."""
    async with request.app.state.session_factory() as session:
        cid = uuid.UUID(customer_id)
        tid = uuid.UUID(tenant_id)
        # Sum across destinations
        stmt = select(
            func.sum(TripStatusCount.count_created).label("created"),
            func.sum(TripStatusCount.count_pending).label("pending"),
            func.sum(TripStatusCount.count_booked).label("booked"),
            func.sum(TripStatusCount.count_cancelled).label("cancelled"),
        ).where(TripStatusCount.customer_id == cid, TripStatusCount.tenant_id == tid)
        
        row = (await session.execute(stmt)).one_or_none()
        
        if not row:
            return CustomerStats(cancelled=0, itineraries=0, booked=0, pending=0, created=0, ltv=0.0, segment="New")
            
        c_created = row.created or 0
        c_pending = row.pending or 0
        c_booked = row.booked or 0
        c_cancelled = row.cancelled or 0
        c_itineraries = c_created + c_pending + c_booked + c_cancelled
        
        # LTV = this customer's bookings × the tenant's real average order value,
        # derived from actual GBV recorded by the affiliate consumer. Falls back
        # to a flat estimate only while no real booking revenue has landed yet.
        gbv_total_stmt = select(func.sum(DashboardMetricDaily.value)).where(
            DashboardMetricDaily.tenant_id == tid, DashboardMetricDaily.metric_key == "gbv_cents"
        )
        bookings_total_stmt = select(func.sum(DashboardMetricDaily.value)).where(
            DashboardMetricDaily.tenant_id == tid, DashboardMetricDaily.metric_key == "bookings_count"
        )
        gbv_total_cents = (await session.execute(gbv_total_stmt)).scalar() or 0
        bookings_total = (await session.execute(bookings_total_stmt)).scalar() or 0
        avg_order_value = (gbv_total_cents / 100.0 / bookings_total) if bookings_total > 0 else 1250.00

        ltv_value = c_booked * avg_order_value
        if c_booked >= 3:
            segment = "High Value"
        elif c_cancelled > c_booked:
            segment = "Churn Risk"
        elif c_booked > 0:
            segment = "Active Customer"
        else:
            segment = "Prospect"

        return CustomerStats(
            cancelled=c_cancelled,
            itineraries=c_itineraries,
            booked=c_booked,
            pending=c_pending,
            created=c_created,
            ltv=ltv_value,
            segment=segment
        )

@router.get("/staff/{staff_id}", response_model=StaffStats)
async def get_staff_stats(
    staff_id: str,
    tenant_id: str,
    request: Request,
    _: None = Depends(verify_internal_secret),
):
    """Internal endpoint to fetch staff stats."""
    async with request.app.state.session_factory() as session:
        sid = uuid.UUID(staff_id)
        tid = uuid.UUID(tenant_id)
        stmt = select(StaffCustomerCount).where(
            StaffCustomerCount.staff_id == sid, StaffCustomerCount.tenant_id == tid
        )
        row = (await session.execute(stmt)).scalar_one_or_none()
        
        if not row:
            return StaffStats(customers=0, itineraries=0, booked=0, pending=0, created=0)
            
        return StaffStats(
            customers=row.count_customers,
            itineraries=row.count_itineraries,
            booked=row.count_booked,
            pending=row.count_pending,
            created=row.count_created,
        )
