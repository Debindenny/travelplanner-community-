"""Add sample day-by-day segments to existing trips that have none."""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

try:
    from services.planner.app.models.trips import Trip
    from scripts.sample_trip_segments import build_sample_segments, build_day_rows
except ModuleNotFoundError:
    from app.models.trips import Trip
    from sample_trip_segments import build_sample_segments, build_day_rows

PLANNER_DB_URL = "postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_db"


async def main():
    db_url = os.getenv("DATABASE_URL", PLANNER_DB_URL)
    if "postgres:5432" in db_url or os.getenv("DOCKER", "").lower() == "true":
        db_url = db_url.replace("localhost", "postgres")

    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine)

    updated = 0
    async with session_factory() as session:
        trips = (await session.execute(select(Trip))).scalars().all()
        for trip in trips:
            if trip.segments:
                continue
            from datetime import datetime

            num_days = max(4, (datetime.fromisoformat(trip.end_date) - datetime.fromisoformat(trip.start_date)).days + 1)
            segments = build_sample_segments(
                trip.destination,
                num_days=num_days,
                start=datetime.fromisoformat(trip.start_date),
                image=trip.image or "assets/images/landing/journey-thailand.jpg",
            )
            trip.segments = segments
            trip.days = build_day_rows(trip.destination, num_days, segments)
            trip.city_days = [{"city": trip.destination.split(",")[0], "nights": max(num_days - 1, 1)}]
            if not trip.image:
                trip.image = "assets/images/landing/journey-thailand.jpg"
            updated += 1
        await session.commit()
    print(f"Enriched {updated} trips with sample segments.")


if __name__ == "__main__":
    asyncio.run(main())
