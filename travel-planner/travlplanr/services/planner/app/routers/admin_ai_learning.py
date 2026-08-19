"""Admin dashboard for AI learning flywheel metrics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from shared.auth_dependencies import require_staff

from app.services.chat_learning_service import learning_dashboard_stats

router = APIRouter()


@router.get("/stats")
async def ai_learning_stats(
    request: Request,
    days: int = Query(30, ge=1, le=365),
    auth: dict = Depends(require_staff),
):
    """KPIs for chat intent accuracy, feedback, and low-acceptance activities."""
    async with request.app.state.session_factory() as session:
        return await learning_dashboard_stats(session, days=days)
