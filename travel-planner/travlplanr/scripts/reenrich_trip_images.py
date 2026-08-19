"""Re-run image enrichment for one trip (keeps segments, replaces demo photos).

Usage (inside planner container):
  python /app/scripts/reenrich_trip_images.py <trip_id>
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm.attributes import flag_modified

try:
    from app.models.trips import Trip
    from app.services.itinerary_image_service import enrich_itinerary_images
except ModuleNotFoundError:
    from services.planner.app.models.trips import Trip
    from services.planner.app.services.itinerary_image_service import enrich_itinerary_images


async def main(trip_id: str) -> None:
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://travlplanr:travlplanr@postgres:5432/planner_db",
    )
    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine)

    async with session_factory() as session:
        trip = (
            await session.execute(select(Trip).where(Trip.id == uuid.UUID(trip_id)))
        ).scalar_one_or_none()
        if not trip:
            raise SystemExit(f"Trip not found: {trip_id}")

        segments = list(trip.segments or [])
        before = [
            (s.get("title") or s.get("name"), s.get("image") or s.get("imageUrl"))
            for s in segments
            if str(s.get("type") or "").lower() == "activity"
        ]
        enriched = await enrich_itinerary_images(None, trip, segments)
        trip.segments = enriched
        flag_modified(trip, "segments")
        cover = trip.image
        after = [
            (s.get("title") or s.get("name"), s.get("image") or s.get("imageUrl"))
            for s in enriched
            if str(s.get("type") or "").lower() == "activity"
        ]
        await session.commit()

        print(f"Cover: {cover}")
        print(f"Activities before → after ({len(after)}):")
        for (_t0, i0), (t1, i1) in zip(before, after):
            print(f"  - {t1}: {i0} → {i1}")
        urls = [i for _, i in after if i]
        print(f"Unique activity images: {len(set(urls))}/{len(urls)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: reenrich_trip_images.py <trip_id>")
    asyncio.run(main(sys.argv[1]))
