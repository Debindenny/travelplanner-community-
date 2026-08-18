from uuid import UUID
from datetime import datetime
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError

from shared.auth_dependencies import require_customer
from shared.rate_limit import rate_limiter
from app.models.community import Report, Block, CommunityProfile

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_TARGET_TYPES = {"post", "comment", "story", "user", "message"}
VALID_REASONS = {"spam", "harassment", "inappropriate", "misinformation", "copyright", "other"}


class CreateReportRequest(BaseModel):
    target_type: str
    target_id: str
    reason: str
    details: str | None = None


@router.post("/reports", dependencies=[Depends(rate_limiter("report-create", 20, 3600))])
async def create_report(data: CreateReportRequest, request: Request, auth: dict = Depends(require_customer)):
    reporter_id = UUID(auth["customer_id"])
    if data.target_type not in VALID_TARGET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid target_type")
    if data.reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail="Invalid reason")
    try:
        target_id = UUID(data.target_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid target_id")
    if data.details and len(data.details) > 1000:
        raise HTTPException(status_code=400, detail="Details exceed maximum length of 1000 characters")

    async with request.app.state.session_factory() as session:
        report = Report(
            reporter_id=reporter_id, target_type=data.target_type, target_id=target_id,
            reason=data.reason, details=data.details
        )
        session.add(report)
        await session.commit()
        return {"status": "success", "report_id": str(report.id)}


@router.post("/users/{customer_id}/block", dependencies=[Depends(rate_limiter("toggle-block", 30, 60))])
async def toggle_block(customer_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    blocker_id = UUID(auth["customer_id"])
    if blocker_id == customer_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    async with request.app.state.session_factory() as session:
        existing = (await session.execute(
            select(Block).where(Block.blocker_id == blocker_id, Block.blocked_id == customer_id)
        )).scalar_one_or_none()
        if existing:
            await session.delete(existing)
            action = "unblocked"; is_blocked = False
        else:
            try:
                session.add(Block(blocker_id=blocker_id, blocked_id=customer_id))
            except (ValueError, TypeError):
                pass  # will fail on flush/commit if model validation exists
            action = "blocked"; is_blocked = True
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            logger.warning("Concurrent block toggle for blocker=%s blocked=%s", blocker_id, customer_id, exc_info=True)
            existing = (await session.execute(
                select(Block).where(Block.blocker_id == blocker_id, Block.blocked_id == customer_id)
            )).scalar_one_or_none()
            if existing:
                await session.delete(existing)
                action = "unblocked"; is_blocked = False
                await session.commit()
        return {"status": "success", "action": action, "is_blocked": is_blocked}


@router.get("/blocks")
async def list_blocks(request: Request, auth: dict = Depends(require_customer)):
    blocker_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        blocks = (await session.execute(select(Block).where(Block.blocker_id == blocker_id))).scalars().all()
        if not blocks:
            return []
        blocked_ids = [b.blocked_id for b in blocks]
        profiles = (await session.execute(select(CommunityProfile).where(CommunityProfile.customer_id.in_(blocked_ids)))).scalars().all()
        profile_map = {p.customer_id: p for p in profiles}
        return [
            {
                "id": str(b.blocked_id),
                "name": profile_map[b.blocked_id].name if b.blocked_id in profile_map and profile_map[b.blocked_id].name else "Traveler",
                "avatar": profile_map[b.blocked_id].avatar_url if b.blocked_id in profile_map else None,
                "blocked_at": b.created_at.isoformat(),
            }
            for b in blocks
        ]
