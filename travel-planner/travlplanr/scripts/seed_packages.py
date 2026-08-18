"""Seed destinations and tour packages into planner_db."""

import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

try:
    from services.planner.app.models.destinations import Destination
    from services.planner.app.models.packages import Package
except ModuleNotFoundError:
    from app.models.destinations import Destination
    from app.models.packages import Package

PLANNER_DB_URL = "postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_db"
_SEED_CANDIDATES = [
    Path(__file__).resolve().parent.parent / "services" / "planner" / "seed_data.json",
    Path(__file__).resolve().parent.parent / "seed_data.json",
]
SEED_JSON = next((p for p in _SEED_CANDIDATES if p.exists()), _SEED_CANDIDATES[0])

# Stable demo package IDs (customer FE can deep-link to these)
DEMO_PACKAGES = [
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000017"),
        "title": "Brussels Premium Tour",
        "theme": "europe-theme",
        "price": 150000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/figma/belgium.jpg",
        "region": "Europe",
        "country": "Belgium",
        "budget_tier": "Standard",
        "rating": 4.4,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000018"),
        "title": "Paris, Barcelona and Madrid Theme Journey",
        "theme": "europe-theme",
        "price": 135000,
        "days": 7,
        "group_type": "Couple",
        "image_url": "assets/images/packages/paris_madrid.png",
        "region": "Europe",
        "country": "France",
        "budget_tier": "Standard",
        "rating": 4.6,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000019"),
        "title": "Amsterdam Berlin Prague Vienna Venice Europe Grand Tour",
        "theme": "europe-theme",
        "price": 165000,
        "days": 7,
        "group_type": "Family",
        "image_url": "assets/images/packages/amsterdam.png",
        "region": "Europe",
        "country": "Netherlands",
        "budget_tier": "Premium",
        "rating": 4.5,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000001a"),
        "title": "Rome Florence Venice Zurich Paris European Capitals",
        "theme": "europe-theme",
        "price": 171300,
        "days": 10,
        "group_type": "Family",
        "image_url": "assets/images/packages/rome_capitals.png",
        "region": "Europe",
        "country": "Italy",
        "budget_tier": "Premium",
        "rating": 4.7,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000001b"),
        "title": "Bali Tropical Escape",
        "theme": "asia-theme",
        "price": 95000,
        "days": 6,
        "group_type": "Couple",
        "image_url": "assets/images/landing/thailand.jpg",
        "region": "Asia",
        "country": "Indonesia",
        "budget_tier": "Standard",
        "rating": 4.8,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000001c"),
        "title": "Dubai Luxury Getaway",
        "theme": "me-theme",
        "price": 220000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/iconic-uae.jpg",
        "region": "Middle East",
        "country": "UAE",
        "budget_tier": "Premium",
        "rating": 4.9,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000001d"),
        "title": "Swiss Alpine Lakes Tour",
        "theme": "europe-theme",
        "price": 185000,
        "days": 8,
        "group_type": "Family",
        "image_url": "assets/images/packages/swiss_lakes.png",
        "region": "Europe",
        "country": "Switzerland",
        "budget_tier": "Premium",
        "rating": 4.6,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000001e"),
        "title": "Tokyo Cultural Discovery",
        "theme": "asia-theme",
        "price": 142000,
        "days": 7,
        "group_type": "Solo",
        "image_url": "assets/images/landing/japan.jpg",
        "region": "Asia",
        "country": "Japan",
        "budget_tier": "Standard",
        "rating": 4.7,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000101"),
        "title": "Barcelona Gaudi & Mediterranean Escape",
        "theme": "europe-theme",
        "price": 88000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/figma/italy.jpg",
        "region": "Europe",
        "country": "Spain",
        "budget_tier": "Standard",
        "rating": 4.6,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000102"),
        "title": "Barcelona & Costa Brava Explorer",
        "theme": "europe-theme",
        "price": 110000,
        "days": 7,
        "group_type": "Family",
        "image_url": "assets/images/landing/figma/italy.jpg",
        "region": "Europe",
        "country": "Spain",
        "budget_tier": "Standard",
        "rating": 4.5,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000103"),
        "title": "Kuala Lumpur & Langkawi Island Retreat",
        "theme": "asia-theme",
        "price": 60000,
        "days": 6,
        "group_type": "Family",
        "image_url": "assets/images/landing/figma/malaysia.jpg",
        "region": "Asia",
        "country": "Malaysia",
        "budget_tier": "Standard",
        "rating": 4.5,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000104"),
        "title": "Penang & Kuala Lumpur Culture Highlights",
        "theme": "asia-theme",
        "price": 48000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/figma/malaysia.jpg",
        "region": "Asia",
        "country": "Malaysia",
        "budget_tier": "Standard",
        "rating": 4.4,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000105"),
        "title": "Luxury Overwater Villa Romantic Escape",
        "theme": "asia-theme",
        "price": 43500,
        "days": 4,
        "group_type": "Couple",
        "image_url": "assets/images/landing/figma/maldives.jpg",
        "region": "Asia",
        "country": "Maldives",
        "budget_tier": "Standard",
        "rating": 4.8,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000106"),
        "title": "Maldives Premium Beach Front Villa",
        "theme": "asia-theme",
        "price": 85000,
        "days": 6,
        "group_type": "Family",
        "image_url": "assets/images/landing/figma/maldives.jpg",
        "region": "Asia",
        "country": "Maldives",
        "budget_tier": "Standard",
        "rating": 4.7,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000107"),
        "title": "Paris Romantic Lights & Seine Journey",
        "theme": "europe-theme",
        "price": 95000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/figma/france.jpg",
        "region": "Europe",
        "country": "France",
        "budget_tier": "Standard",
        "rating": 4.7,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000108"),
        "title": "Paris, Versailles & Loire Valley Grand Tour",
        "theme": "europe-theme",
        "price": 140000,
        "days": 8,
        "group_type": "Family",
        "image_url": "assets/images/landing/figma/france.jpg",
        "region": "Europe",
        "country": "France",
        "budget_tier": "Standard",
        "rating": 4.6,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000109"),
        "title": "Seychelles Pristine Island Paradise Tour",
        "theme": "africa-theme",
        "price": 75300,
        "days": 6,
        "group_type": "Family",
        "image_url": "assets/images/landing/figma/seychelles.jpg",
        "region": "Africa",
        "country": "Seychelles",
        "budget_tier": "Premium",
        "rating": 4.6,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000010a"),
        "title": "Seychelles Mahe & Praslin Explorer",
        "theme": "africa-theme",
        "price": 92000,
        "days": 7,
        "group_type": "Couple",
        "image_url": "assets/images/landing/figma/seychelles.jpg",
        "region": "Africa",
        "country": "Seychelles",
        "budget_tier": "Premium",
        "rating": 4.5,
    },
    # Missing static fallback packages
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000201"),
        "title": "Madrid Valencia Barcelona Spanish coastal Journey",
        "theme": "europe-theme",
        "price": 125000,
        "days": 7,
        "group_type": "Couple",
        "image_url": "assets/images/packages/paris_madrid.png",
        "region": "Europe",
        "country": "Spain",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000202"),
        "title": "9 days Swiss & Lyon Packages for Couple",
        "theme": "europe-theme",
        "price": 198000,
        "days": 7,
        "group_type": "Couple",
        "image_url": "assets/images/packages/swiss_lyon.png",
        "region": "Europe",
        "country": "France",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000203"),
        "title": "Zurich Interlaken Montreux Zermatt Alpine Swiss Adventure",
        "theme": "europe-theme",
        "price": 177000,
        "days": 7,
        "group_type": "Couple",
        "image_url": "assets/images/packages/zurich_alpine.png",
        "region": "Europe",
        "country": "Switzerland",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000204"),
        "title": "Rejuvenating Italy, Greece tour package for Couple",
        "theme": "europe-theme",
        "price": 102000,
        "days": 10,
        "group_type": "Couple",
        "image_url": "assets/images/packages/italy_greece.png",
        "region": "Europe",
        "country": "Italy",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000205"),
        "title": "Zurich Interlaken Geneva Swiss Lakes & Mountains",
        "theme": "europe-theme",
        "price": 202000,
        "days": 7,
        "group_type": "Family",
        "image_url": "assets/images/packages/swiss_lakes.png",
        "region": "Europe",
        "country": "Switzerland",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000206"),
        "title": "Swiss Alps & Valleys Romantic Getaway",
        "theme": "europe-theme",
        "price": 145000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/package-swiss.jpg",
        "region": "Europe",
        "country": "Switzerland",
        "budget_tier": "Premium",
        "rating": 5.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000207"),
        "title": "Penang Heritage & Culinary Explorer",
        "theme": "asia-theme",
        "price": 45000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/journey-thailand.jpg",
        "region": "Asia",
        "country": "Malaysia",
        "budget_tier": "Standard",
        "rating": 3.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000208"),
        "title": "New York & East Coast Highlights",
        "theme": "us-theme",
        "price": 280000,
        "days": 7,
        "group_type": "Family",
        "image_url": "assets/images/landing/iconic-usa.jpg",
        "region": "USA",
        "country": "USA",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000209"),
        "title": "West Coast Wonders: LA, Vegas & SF",
        "theme": "us-theme",
        "price": 340000,
        "days": 9,
        "group_type": "Couple",
        "image_url": "assets/images/landing/category-friends.jpg",
        "region": "USA",
        "country": "USA",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000020a"),
        "title": "Orlando Magic Theme Park Special",
        "theme": "us-theme",
        "price": 195000,
        "days": 6,
        "group_type": "Family",
        "image_url": "assets/images/landing/category-family.jpg",
        "region": "USA",
        "country": "USA",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000020b"),
        "title": "Dubai & Abu Dhabi Highlights Tour",
        "theme": "me-theme",
        "price": 85000,
        "days": 6,
        "group_type": "Couple",
        "image_url": "assets/images/landing/iconic-uae.jpg",
        "region": "Middle East",
        "country": "UAE",
        "budget_tier": "Premium",
        "rating": 5.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000020c"),
        "title": "Qatar Luxury & Heritage Escape",
        "theme": "me-theme",
        "price": 75000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/journey-abudhabi.jpg",
        "region": "Middle East",
        "country": "Qatar",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000020d"),
        "title": "Morocco Desert & Medina Explorer",
        "theme": "me-theme",
        "price": 68000,
        "days": 5,
        "group_type": "Couple",
        "image_url": "assets/images/landing/journey-kenya.jpg",
        "region": "Middle East",
        "country": "Morocco",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000020e"),
        "title": "Singapore & Malaysia Twin City Explorer",
        "theme": "asia-theme",
        "price": 78000,
        "days": 6,
        "group_type": "Couple",
        "image_url": "assets/images/landing/singapore.jpg",
        "region": "Asia",
        "country": "Singapore",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-00000000020f"),
        "title": "Thailand Tropical Escape: Bangkok & Phuket",
        "theme": "asia-theme",
        "price": 56000,
        "days": 6,
        "group_type": "Couple",
        "image_url": "assets/images/landing/thailand.jpg",
        "region": "Asia",
        "country": "Thailand",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000210"),
        "title": "Bali Wellness & Adventure Holiday",
        "theme": "asia-theme",
        "price": 65000,
        "days": 7,
        "group_type": "Couple",
        "image_url": "assets/images/landing/package-bali.jpg",
        "region": "Asia",
        "country": "Indonesia",
        "budget_tier": "Standard",
        "rating": 4.0,
    },
    {
        "id": uuid.UUID("a2000000-0000-4000-8000-000000000211"),
        "title": "Japan Cherry Blossom & Culture Tour",
        "theme": "asia-theme",
        "price": 110000,
        "days": 8,
        "group_type": "Couple",
        "image_url": "assets/images/landing/package-japan.jpg",
        "region": "Asia",
        "country": "Japan",
        "budget_tier": "Standard",
        "rating": 4.0,
    }
]


async def main():
    import os

    db_url = os.getenv("DATABASE_URL", PLANNER_DB_URL)
    if "postgres:5432" in db_url or os.getenv("DOCKER", "").lower() == "true":
        db_url = db_url.replace("localhost", "postgres")

    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine)

    async with session_factory() as session:
        dest_count = (await session.execute(select(func.count()).select_from(Destination))).scalar() or 0
        if SEED_JSON.exists():
            with open(SEED_JSON) as f:
                data = json.load(f)
            for dest in data.get("destinations", []):
                existing_by_name = (
                    await session.execute(
                        select(Destination).where(Destination.name == dest["name"]).limit(1)
                    )
                ).scalar_one_or_none()
                if existing_by_name:
                    continue
                session.add(
                    Destination(
                        name=dest["name"],
                        description=dest["description"],
                        image_url=dest["image_url"],
                        base_price=dest["base_price"],
                        region=dest["region"],
                        tags=dest["tags"],
                    )
                )
            await session.commit()
            if dest_count == 0:
                print(f"Seeded destinations from {SEED_JSON.name}.")

        for pkg_data in DEMO_PACKAGES:
            existing = (
                await session.execute(select(Package).where(Package.id == pkg_data["id"]))
            ).scalar_one_or_none()
            if existing:
                for key, val in pkg_data.items():
                    if key != "id":
                        setattr(existing, key, val)
            else:
                session.add(Package(**pkg_data))
        await session.commit()
        print(f"Upserted {len(DEMO_PACKAGES)} demo packages.")


if __name__ == "__main__":
    asyncio.run(main())
