from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, desc

from shared.auth_dependencies import optional_customer, require_customer
from app.models.community import GamificationProfile, XpEvent, UserBadge, ChallengeProgress, CommunityProfile
from app.services.gamification import BADGES, CHALLENGES, week_start

router = APIRouter()

# ── Level tiers ──────────────────────────────────────────────────────────
# Mirrors the frontend's TRAVELER_LEVELS thresholds/names for continuity.
LEVELS: list[dict] = [
    {"rank": 1, "name": "Wanderer", "min_xp": 0},
    {"rank": 2, "name": "Explorer", "min_xp": 200},
    {"rank": 3, "name": "Adventurer", "min_xp": 600},
    {"rank": 4, "name": "Globe-Trotter", "min_xp": 1500},
    {"rank": 5, "name": "Nomad", "min_xp": 3500},
    {"rank": 6, "name": "Legend", "min_xp": 7000},
]

BADGES_BY_KEY = {b["key"]: b for b in BADGES}


def _level_info(xp: int) -> dict:
    current = LEVELS[0]
    next_level = None
    for i, lvl in enumerate(LEVELS):
        if xp >= lvl["min_xp"]:
            current = lvl
            next_level = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
        else:
            break
    return {
        "level": current["rank"],
        "level_name": current["name"],
        "next_level_xp": next_level["min_xp"] if next_level else None,
    }


@router.get("/profile")
async def get_gamification_profile(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        profile = (await session.execute(
            select(GamificationProfile).where(GamificationProfile.customer_id == customer_id)
        )).scalar_one_or_none()

        xp = profile.xp if profile else 0
        streak_days = profile.streak_days if profile else 0

        earned = (await session.execute(
            select(UserBadge).where(UserBadge.customer_id == customer_id).order_by(desc(UserBadge.earned_at))
        )).scalars().all()

        badges = []
        for ub in earned:
            catalog = BADGES_BY_KEY.get(ub.badge_key)
            if not catalog:
                continue
            badges.append({
                "key": ub.badge_key,
                "name": catalog["name"],
                "description": catalog["description"],
                "icon": catalog["icon"],
                "earned_at": ub.earned_at.isoformat(),
            })

        info = _level_info(xp)
        return {
            "xp": xp,
            "level": info["level"],
            "level_name": info["level_name"],
            "streak_days": streak_days,
            "badges": badges,
            "next_level_xp": info["next_level_xp"],
        }


@router.get("/xp-history")
async def get_xp_history(request: Request, limit: int = 20, offset: int = 0, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    async with request.app.state.session_factory() as session:
        events = (await session.execute(
            select(XpEvent).where(XpEvent.customer_id == customer_id)
            .order_by(desc(XpEvent.created_at)).limit(limit).offset(offset)
        )).scalars().all()
        return [
            {"amount": e.amount, "reason": e.reason, "created_at": e.created_at.isoformat()}
            for e in events
        ]


@router.get("/challenges")
async def get_challenges(request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    period_start = week_start(datetime.utcnow())
    async with request.app.state.session_factory() as session:
        existing = (await session.execute(
            select(ChallengeProgress).where(
                ChallengeProgress.customer_id == customer_id,
                ChallengeProgress.period_start == period_start,
            )
        )).scalars().all()
        progress_by_key = {row.challenge_key: row for row in existing}

        created_any = False
        for challenge in CHALLENGES:
            if challenge["key"] not in progress_by_key:
                row = ChallengeProgress(
                    customer_id=customer_id, challenge_key=challenge["key"], progress=0, period_start=period_start
                )
                session.add(row)
                progress_by_key[challenge["key"]] = row
                created_any = True
        if created_any:
            await session.commit()

        return [
            {
                "key": challenge["key"],
                "title": challenge["title"],
                "description": challenge["description"],
                "target": challenge["target"],
                "progress": progress_by_key[challenge["key"]].progress,
                "completed": progress_by_key[challenge["key"]].completed_at is not None,
            }
            for challenge in CHALLENGES
        ]


@router.get("/leaderboard")
async def get_leaderboard(request: Request, limit: int = 20, auth: dict | None = Depends(optional_customer)):
    limit = max(1, min(limit, 100))
    async with request.app.state.session_factory() as session:
        rows = (await session.execute(
            select(GamificationProfile)
            .order_by(desc(GamificationProfile.xp))
            .limit(limit)
        )).scalars().all()

        customer_ids = [gp.customer_id for gp in rows]
        profile_map = {}
        if customer_ids:
            profiles = (await session.execute(
                select(CommunityProfile).where(CommunityProfile.customer_id.in_(customer_ids))
            )).scalars().all()
            profile_map = {p.customer_id: p for p in profiles}

        result = []
        for gp in rows:
            info = _level_info(gp.xp)
            cp = profile_map.get(gp.customer_id)
            result.append({
                "customer_id": str(gp.customer_id),
                "name": (cp.name if cp and cp.name else "Traveler"),
                "avatar": (cp.avatar_url if cp else None),
                "xp": gp.xp,
                "level": info["level"],
            })
        return result
