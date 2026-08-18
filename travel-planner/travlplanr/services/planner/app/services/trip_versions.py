"""
Trip version snapshots — see app.models.trips.TripVersion.

Call `snapshot_trip` right before mutating a trip's itinerary (AI regen,
manual edit, rebuild) so the prior state is recoverable. Snapshotting is
best-effort: a failure here must never block the caller's actual write.
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trips import Trip, TripVersion

logger = logging.getLogger(__name__)


async def snapshot_trip(session: AsyncSession, trip: Trip, reason: str) -> TripVersion | None:
    """Persist the trip's current itinerary as a new version. Does not commit."""
    try:
        next_number = await session.scalar(
            select(func.coalesce(func.max(TripVersion.version_number), 0) + 1).where(
                TripVersion.trip_id == trip.id
            )
        )
        version = TripVersion(
            trip_id=trip.id,
            version_number=next_number,
            reason=reason,
            title=trip.title,
            days=trip.days,
            city_days=trip.city_days,
            segments=trip.segments,
            customizations=trip.customizations,
        )
        session.add(version)
        await session.flush()
        return version
    except Exception:
        logger.exception("failed to snapshot trip version", extra={"trip_id": str(trip.id)})
        return None
