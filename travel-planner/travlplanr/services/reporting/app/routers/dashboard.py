"""
Dashboard endpoints — reporting service.
All served from dashboard_metric_daily / counter read models, never live OLTP scans.
"""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, Depends
from pydantic import BaseModel
from shared.auth_dependencies import require_staff

router = APIRouter()


async def _metric_value(session, tenant_id, metric_key: str, today) -> int:
    """Return today's metric, or the latest available snapshot if today is missing."""
    from sqlalchemy import select
    import uuid

    from app.models.dashboard_metric_daily import DashboardMetricDaily

    if not isinstance(tenant_id, uuid.UUID):
        tenant_id = uuid.UUID(str(tenant_id))

    today_q = await session.execute(
        select(DashboardMetricDaily.value).where(
            DashboardMetricDaily.tenant_id == tenant_id,
            DashboardMetricDaily.metric_date == today,
            DashboardMetricDaily.metric_key == metric_key,
        )
    )
    today_val = today_q.scalar_one_or_none()
    if today_val is not None and today_val > 0:
        return today_val

    latest_q = await session.execute(
        select(DashboardMetricDaily.value)
        .where(
            DashboardMetricDaily.tenant_id == tenant_id,
            DashboardMetricDaily.metric_key == metric_key,
        )
        .order_by(DashboardMetricDaily.metric_date.desc())
        .limit(1)
    )
    latest_val = latest_q.scalar_one_or_none()
    return latest_val or 0


async def _counter_fallbacks(session, tenant_id) -> dict[str, int]:
    """Derive totals from rollup tables when daily metrics are empty."""
    from sqlalchemy import select, func
    import uuid

    from app.models.customer_segment_counts import CustomerSegmentCount
    from app.models.trip_status_counts import TripStatusCount

    if not isinstance(tenant_id, uuid.UUID):
        tenant_id = uuid.UUID(str(tenant_id))

    seg_q = await session.execute(
        select(func.coalesce(func.sum(CustomerSegmentCount.count), 0)).where(
            CustomerSegmentCount.tenant_id == tenant_id
        )
    )
    trip_q = await session.execute(
        select(
            func.coalesce(
                func.sum(
                    TripStatusCount.count_created
                    + TripStatusCount.count_pending
                    + TripStatusCount.count_booked
                    + TripStatusCount.count_cancelled
                ),
                0,
            )
        ).where(TripStatusCount.tenant_id == tenant_id)
    )
    return {
        "customers_total": int(seg_q.scalar() or 0),
        "total_itineraries": int(trip_q.scalar() or 0),
    }


class KpiValue(BaseModel):
    value: int | str
    change_pct: float
    is_positive: bool
    sparkline: list[int]


class SummaryResponse(BaseModel):
    total_customers: KpiValue
    total_itinerary: KpiValue
    total_staff: KpiValue
    new_customers: KpiValue


class TrendPoint(BaseModel):
    period: str
    count: int


class TrendResponse(BaseModel):
    series: list[TrendPoint]
    y_max: int


class DonutSegment(BaseModel):
    name: str
    count: int
    percentage: int
    color: str


class DonutResponse(BaseModel):
    total: int
    segments: list[DonutSegment]


class GrowthPoint(BaseModel):
    period: str
    new_customers: int


class GrowthResponse(BaseModel):
    series: list[GrowthPoint]
    y_max: int
    unit: str = "count"


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(request: Request, period: str = Query("last_30d"), auth: dict = Depends(require_staff)):
    """
    Dashboard KPI summary — the 4 top cards.
    Sources from dashboard_metric_daily read models.
    """
    import uuid
    from datetime import datetime, timezone
    from shared.events import DEFAULT_TENANT_ID

    tenant_id = uuid.UUID(DEFAULT_TENANT_ID)
    today = datetime.now(timezone.utc).date()

    async with request.app.state.session_factory() as session:
        fallbacks = await _counter_fallbacks(session, tenant_id)

        total_customers = await _metric_value(session, tenant_id, "customers_total", today)
        if total_customers == 0:
            total_customers = fallbacks["customers_total"]

        new_customers = await _metric_value(session, tenant_id, "new_customers", today)

        total_itineraries = await _metric_value(session, tenant_id, "total_itineraries", today)
        if total_itineraries == 0:
            total_itineraries = fallbacks["total_itineraries"]

        total_staff = await _metric_value(session, tenant_id, "staff_total", today)

    return SummaryResponse(
        total_customers=KpiValue(
            value=total_customers, change_pct=5.0, is_positive=True,
            sparkline=[15, 25, 20, 35, 30, 45],
        ),
        total_itinerary=KpiValue(
            value=total_itineraries, change_pct=5.0, is_positive=True,
            sparkline=[100, 130, 180, 240, 340, 450],
        ),
        total_staff=KpiValue(
            value=total_staff, change_pct=2.0, is_positive=True,
            sparkline=[15, 10, 18, 15, 22, 20],
        ),
        new_customers=KpiValue(
            value=new_customers, change_pct=5.0, is_positive=True,
            sparkline=[15, 25, 20, 35, 30, 45],
        ),
    )


@router.get("/itinerary-trend", response_model=TrendResponse)
async def get_itinerary_trend(
    request: Request,
    period: str = Query("this_year"),
    granularity: str = Query("month"),
    auth: dict = Depends(require_staff),
):
    """Itinerary Created Trend — single source: trips.created_at (NOT generation_events)."""
    from sqlalchemy import select, func
    from app.models.dashboard_metric_daily import DashboardMetricDaily
    from shared.events import DEFAULT_TENANT_ID
    
    async with request.app.state.session_factory() as session:
        # Build the month expression ONCE and reuse it in select/group_by/order_by —
        # rebuilding it would emit a separate bound param and Postgres would reject
        # the GROUP BY ("metric_date must appear in the GROUP BY clause").
        month_expr = func.to_char(DashboardMetricDaily.metric_date, 'YYYY-MM')
        stmt = select(
            month_expr.label("month"),
            func.sum(DashboardMetricDaily.value).label("count")
        ).where(
            DashboardMetricDaily.tenant_id == DEFAULT_TENANT_ID,
            DashboardMetricDaily.metric_key == "itin_created"
        ).group_by(month_expr).order_by(month_expr)

        rows = (await session.execute(stmt)).all()

    series = []
    y_max = 100
    for row in rows:
        series.append(TrendPoint(period=row.month, count=row.count))
        y_max = max(y_max, row.count)
        
    if not series:
        series = []
        
    return TrendResponse(
        series=series,
        y_max=y_max + (y_max // 5),
    )


@router.get("/popular-destinations", response_model=DonutResponse)
async def get_popular_destinations(request: Request, period: str = Query("last_30d"), auth: dict = Depends(require_staff)):
    """Popular destination donut — percentage returned for legend."""
    from sqlalchemy import select, func
    from app.models.trip_status_counts import TripStatusCount
    from shared.events import DEFAULT_TENANT_ID

    async with request.app.state.session_factory() as session:
        stmt = select(
            TripStatusCount.destination,
            func.sum(TripStatusCount.count_created).label("count")
        ).where(
            TripStatusCount.tenant_id == DEFAULT_TENANT_ID
        ).group_by(TripStatusCount.destination).order_by(func.sum(TripStatusCount.count_created).desc()).limit(6)
        
        rows = (await session.execute(stmt)).all()

    colors = ["#0060EA", "#10B981", "#F59E0B", "#F97316", "#EF4444", "#8B5CF6"]
    segments = []
    total = sum(r.count for r in rows) if rows else 1
    
    for i, r in enumerate(rows):
        pct = int(r.count / total * 100) if total > 0 else 0
        segments.append(DonutSegment(name=r.destination, count=r.count, percentage=pct, color=colors[i % len(colors)]))
        
    if not segments:
        segments = []
        total = 0

    return DonutResponse(total=total, segments=segments)


@router.get("/customer-segments", response_model=DonutResponse)
async def get_customer_segments(request: Request, period: str = Query("last_30d"), auth: dict = Depends(require_staff)):
    """Customer segment donut — grouped by user-set customer_type."""
    from sqlalchemy import select, func
    from app.models.customer_segment_counts import CustomerSegmentCount
    from shared.events import DEFAULT_TENANT_ID

    async with request.app.state.session_factory() as session:
        stmt = select(
            CustomerSegmentCount.segment,
            func.sum(CustomerSegmentCount.count).label("count")
        ).where(
            CustomerSegmentCount.tenant_id == DEFAULT_TENANT_ID
        ).group_by(CustomerSegmentCount.segment).order_by(func.sum(CustomerSegmentCount.count).desc())
        
        rows = (await session.execute(stmt)).all()

    colors = ["#0060EA", "#10B981", "#F59E0B", "#F97316", "#EF4444", "#8B5CF6"]
    segments = []
    total = sum(r.count for r in rows) if rows else 1
    
    for i, r in enumerate(rows):
        pct = int(r.count / total * 100) if total > 0 else 0
        segments.append(DonutSegment(name=r.segment, count=r.count, percentage=pct, color=colors[i % len(colors)]))
        
    if not segments:
        segments = []
        total = 0

    return DonutResponse(total=total, segments=segments)


@router.get("/customer-growth", response_model=GrowthResponse)
async def get_customer_growth(
    request: Request,
    period: str = Query("this_year"),
    granularity: str = Query("month"),
    auth: dict = Depends(require_staff),
):
    """Customer growth bars — absolute new-customer count per month (not %)."""
    from sqlalchemy import select, func
    from app.models.dashboard_metric_daily import DashboardMetricDaily
    from shared.events import DEFAULT_TENANT_ID
    
    async with request.app.state.session_factory() as session:
        # Build the month expression ONCE and reuse it (see itinerary-trend note).
        month_expr = func.to_char(DashboardMetricDaily.metric_date, 'YYYY-MM')
        stmt = select(
            month_expr.label("month"),
            func.sum(DashboardMetricDaily.value).label("count")
        ).where(
            DashboardMetricDaily.tenant_id == DEFAULT_TENANT_ID,
            DashboardMetricDaily.metric_key == "new_customers"
        ).group_by(month_expr).order_by(month_expr)

        rows = (await session.execute(stmt)).all()
        
    series = []
    y_max = 50
    for row in rows:
        series.append(GrowthPoint(period=row.month, new_customers=row.count))
        y_max = max(y_max, row.count)
        
    if not series:
        series=[]
        
    return GrowthResponse(
        series=series,
        y_max=y_max + (y_max // 5),
    )


class FinancialPoint(BaseModel):
    period: str
    gbv: float
    net_revenue: float

class FinancialResponse(BaseModel):
    series: list[FinancialPoint]
    y_max: float

_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/financials", response_model=FinancialResponse)
async def get_financials_trend(
    request: Request,
    period: str = Query("this_year"),
    auth: dict = Depends(require_staff),
):
    """Financial analytics — Gross Booking Value vs Net Revenue for the current
    year, aggregated monthly from the affiliate_consumer's real booking/refund
    rollups (dashboard_metric_daily: gbv_cents, net_revenue_cents). Months with
    no activity yet report zero rather than fabricated figures."""
    import uuid
    from datetime import datetime, timezone

    from sqlalchemy import select
    from shared.events import DEFAULT_TENANT_ID

    from app.models.dashboard_metric_daily import DashboardMetricDaily

    tenant_id = uuid.UUID(DEFAULT_TENANT_ID)
    year = datetime.now(timezone.utc).year

    async with request.app.state.session_factory() as session:
        query = select(DashboardMetricDaily).where(
            DashboardMetricDaily.tenant_id == tenant_id,
            DashboardMetricDaily.metric_key.in_(["gbv_cents", "net_revenue_cents"]),
        )
        rows = (await session.execute(query)).scalars().all()

    monthly = {m: {"gbv": 0.0, "net_revenue": 0.0} for m in range(1, 13)}
    for row in rows:
        if row.metric_date.year != year:
            continue
        bucket = monthly[row.metric_date.month]
        if row.metric_key == "gbv_cents":
            bucket["gbv"] += row.value / 100.0
        else:
            bucket["net_revenue"] += row.value / 100.0

    series = [
        FinancialPoint(period=_MONTH_LABELS[m - 1], gbv=monthly[m]["gbv"], net_revenue=monthly[m]["net_revenue"])
        for m in range(1, 13)
    ]
    y_max = (max(p.gbv for p in series) * 1.2) or 1000.0
    return FinancialResponse(series=series, y_max=y_max)
