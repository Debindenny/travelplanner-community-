"""Gamification domain logic: XP rules, badge/challenge catalogs, and the
award_xp() side-effect used by other routers when a user performs an
XP-worthy action (creating a post, commenting, reacting, etc).

This module is plain Python — no APIRouter here. It is imported and called
from the action routers (community_posts.py, community_profile.py, ...),
which are wired up separately.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, func

from app.models.community import GamificationProfile, XpEvent, UserBadge, ChallengeProgress


# ── XP rules ─────────────────────────────────────────────────────────────

XP_RULES: dict[str, int] = {
    "post_created": 15,
    "comment_created": 5,
    "reaction_given": 2,
    "story_created": 10,
    "follow_given": 3,
}


# ── Badge catalog ────────────────────────────────────────────────────────
# Each badge is either earned once the profile's total XP crosses
# `xp_threshold`, or once the count of XpEvent rows with reason == `action`
# reaches `count_threshold`.

BADGES: list[dict] = [
    {"key": "first_post", "name": "First Steps", "description": "Published your first community post",
     "icon": "🎒", "count_threshold": 1, "action": "post_created"},
    {"key": "storyteller", "name": "Storyteller", "description": "Published 10 community posts",
     "icon": "📖", "count_threshold": 10, "action": "post_created"},
    {"key": "first_comment", "name": "Conversationalist", "description": "Left your first comment",
     "icon": "💬", "count_threshold": 1, "action": "comment_created"},
    {"key": "helpful_guide", "name": "Helpful Guide", "description": "Gave 25 reactions to other travelers",
     "icon": "⭐", "count_threshold": 25, "action": "reaction_given"},
    {"key": "story_weaver", "name": "Story Weaver", "description": "Shared 10 stories",
     "icon": "🎞️", "count_threshold": 10, "action": "story_created"},
    {"key": "networker", "name": "Networker", "description": "Followed 10 fellow travelers",
     "icon": "🤝", "count_threshold": 10, "action": "follow_given"},
    {"key": "rising_star", "name": "Rising Star", "description": "Reached 200 XP",
     "icon": "🧭", "xp_threshold": 200},
    {"key": "seasoned_traveler", "name": "Seasoned Traveler", "description": "Reached 600 XP",
     "icon": "⛰️", "xp_threshold": 600},
    {"key": "globetrotter", "name": "Globetrotter", "description": "Reached 1500 XP",
     "icon": "✈️", "xp_threshold": 1500},
    {"key": "legend", "name": "Legend", "description": "Reached 3500 XP",
     "icon": "👑", "xp_threshold": 3500},
]


# ── Weekly challenge catalog ─────────────────────────────────────────────
# `action` is the XpEvent reason that increments this challenge's progress.

CHALLENGES: list[dict] = [
    {"key": "weekly_poster", "title": "Share 3 Times", "description": "Create 3 posts this week",
     "target": 3, "action": "post_created"},
    {"key": "weekly_commenter", "title": "Conversation Starter", "description": "Leave 5 comments this week",
     "target": 5, "action": "comment_created"},
    {"key": "weekly_supporter", "title": "Spread the Love", "description": "Give 10 reactions this week",
     "target": 10, "action": "reaction_given"},
    {"key": "weekly_storyteller", "title": "Story Time", "description": "Share 2 stories this week",
     "target": 2, "action": "story_created"},
    {"key": "weekly_connector", "title": "Make Connections", "description": "Follow 3 new travelers this week",
     "target": 3, "action": "follow_given"},
]


def week_start(now: datetime) -> datetime:
    """Most recent Monday at 00:00 UTC relative to `now`."""
    monday = now - timedelta(days=now.weekday())
    return datetime(monday.year, monday.month, monday.day)


async def award_xp(session, customer_id: uuid.UUID, action: str) -> dict:
    """Best-effort gamification side effect for a user action.

    Looks up XP_RULES[action], creates/updates the customer's
    GamificationProfile and streak, records an XpEvent, awards any newly
    earned badges, and bumps this week's ChallengeProgress for challenges
    tied to `action`. Does NOT commit — the caller is responsible for
    committing (or rolling back) the session.

    If `action` isn't a recognized XP-worthy action, this is a no-op.
    """
    if action not in XP_RULES:
        return {"xp_awarded": 0, "total_xp": None, "streak_days": None, "badges_earned": []}

    amount = XP_RULES[action]
    now = datetime.utcnow()

    profile = (await session.execute(
        select(GamificationProfile).where(GamificationProfile.customer_id == customer_id)
    )).scalar_one_or_none()
    if profile is None:
        profile = GamificationProfile(customer_id=customer_id, xp=0, streak_days=0, last_activity_date=None)
        session.add(profile)
        await session.flush()

    # Streak accounting: same calendar day -> unchanged, exactly one day
    # gap -> +1, otherwise (first activity ever, or a gap > 1 day) -> reset to 1.
    if profile.last_activity_date is None:
        profile.streak_days = 1
    else:
        gap_days = (now.date() - profile.last_activity_date.date()).days
        if gap_days == 1:
            profile.streak_days = (profile.streak_days or 0) + 1
        elif gap_days > 1:
            profile.streak_days = 1
        # gap_days == 0 (same day) or negative (clock skew): leave streak_days as-is

    profile.last_activity_date = now
    profile.xp = (profile.xp or 0) + amount

    session.add(XpEvent(customer_id=customer_id, amount=amount, reason=action, created_at=now))

    # Badges: check XP-threshold badges against the new total, and
    # count-threshold badges tied to this specific action.
    already_earned = set((await session.execute(
        select(UserBadge.badge_key).where(UserBadge.customer_id == customer_id)
    )).scalars().all())

    badges_earned: list[str] = []
    action_event_count: int | None = None
    for badge in BADGES:
        key = badge["key"]
        if key in already_earned:
            continue
        earned = False
        if "xp_threshold" in badge:
            earned = profile.xp >= badge["xp_threshold"]
        elif badge.get("action") == action:
            if action_event_count is None:
                action_event_count = (await session.execute(
                    select(func.count()).select_from(XpEvent).where(
                        XpEvent.customer_id == customer_id, XpEvent.reason == action
                    )
                )).scalar() or 0
            earned = action_event_count >= badge["count_threshold"]
        if earned:
            session.add(UserBadge(customer_id=customer_id, badge_key=key, earned_at=now))
            already_earned.add(key)
            badges_earned.append(key)

    # Weekly challenge progress for challenges tied to this action.
    period_start = week_start(now)
    for challenge in CHALLENGES:
        if challenge["action"] != action:
            continue
        progress_row = (await session.execute(
            select(ChallengeProgress).where(
                ChallengeProgress.customer_id == customer_id,
                ChallengeProgress.challenge_key == challenge["key"],
                ChallengeProgress.period_start == period_start,
            )
        )).scalar_one_or_none()
        if progress_row is None:
            progress_row = ChallengeProgress(
                customer_id=customer_id, challenge_key=challenge["key"], progress=0, period_start=period_start
            )
            session.add(progress_row)
            await session.flush()
        if progress_row.completed_at is None:
            progress_row.progress = (progress_row.progress or 0) + 1
            if progress_row.progress >= challenge["target"]:
                progress_row.completed_at = now

    return {
        "xp_awarded": amount,
        "total_xp": profile.xp,
        "streak_days": profile.streak_days,
        "badges_earned": badges_earned,
    }
