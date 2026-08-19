#!/usr/bin/env python3
"""
Sync destinations from seed_data.json, ensure every place has tour packages,
and assign unique image URLs across destinations, packages, trips, blog, and community.

  docker exec -e DOCKER=true travlplanr-planner-1 python /app/scripts/seed_places_and_packages.py
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from pathlib import Path

from sqlalchemy import select, func, or_, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys_path = Path(__file__).resolve().parent.parent
import sys

sys.path.insert(0, str(sys_path))

try:
    from services.planner.app.models.destinations import Destination
    from services.planner.app.models.packages import Package
except ModuleNotFoundError:
    from app.models.destinations import Destination
    from app.models.packages import Package

PLANNER_DB_URL = "postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_db"
SEED_JSON_CANDIDATES = [
    Path(__file__).resolve().parent.parent / "services" / "planner" / "seed_data.json",
    Path(__file__).resolve().parent.parent / "seed_data.json",
]


def resolve_seed_json() -> Path:
    for path in SEED_JSON_CANDIDATES:
        if path.exists():
            return path
    return SEED_JSON_CANDIDATES[0]
PKG_NAMESPACE = uuid.UUID("a2000000-0000-4000-8000-000000000000")
DEST_NAMESPACE = uuid.UUID("b1000000-0000-4000-8000-000000000000")

# Mirrors services/planner/app/routers/packages.py REGION_ALIASES
REGION_ALIASES: dict[str, list[str]] = {
    "dubai": ["dubai", "uae", "united arab emirates", "middle east"],
    "uae": ["dubai", "uae", "united arab emirates", "middle east", "abu dhabi"],
    "unitedarabemirates": ["dubai", "uae", "united arab emirates", "middle east", "abu dhabi"],
    "emirates": ["dubai", "uae", "middle east"],
    "abudhabi": ["abu dhabi", "uae", "middle east"],
    "abu dhabi": ["abu dhabi", "uae", "middle east"],
    "qatar": ["qatar", "doha", "middle east"],
    "doha": ["qatar", "doha", "middle east"],
    "bahrain": ["bahrain", "manama", "middle east"],
    "muscat": ["oman", "muscat", "middle east"],
    "kuwait": ["kuwait", "middle east"],
    "riyadh": ["saudi arabia", "riyadh", "middle east"],
    "alula": ["alula", "saudi arabia", "middle east"],
    "middleeast": ["middle east", "uae", "dubai", "abu dhabi", "qatar"],
    "bangkok": ["thailand", "bangkok", "asia"],
    "phuket": ["thailand", "asia"],
    "bali": ["bali", "indonesia", "asia"],
    "tokyo": ["japan", "tokyo", "asia"],
    "singapore": ["singapore", "asia"],
    "paris": ["france", "paris", "europe"],
    "rome": ["italy", "rome", "europe"],
    "barcelona": ["spain", "barcelona", "europe"],
    "madrid": ["spain", "madrid", "europe"],
    "london": ["united kingdom", "london", "europe"],
    "goa": ["goa", "india", "asia"],
    "usa": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "unitedstates": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "unitedstatesofamerica": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "eastcoast": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "westcoast": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "newyork": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "orlando": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "losangeles": ["usa", "united states", "united state america", "america", "east coast", "west coast"],
    "dallas": ["usa", "united states", "dallas", "america"],
}

# Curated unique asset paths (exist under apps/web/src/)
IMAGE_POOL: list[str] = [
    "assets/images/landing/figma/abu-dhabi.jpg",
    "assets/images/landing/figma/alula.jpg",
    "assets/images/landing/figma/australia-rated.jpg",
    "assets/images/landing/figma/austria.jpg",
    "assets/images/landing/figma/bahrain.jpg",
    "assets/images/landing/figma/bali-rated.jpg",
    "assets/images/landing/figma/bali.jpg",
    "assets/images/landing/figma/belgium.jpg",
    "assets/images/landing/figma/china-rated.jpg",
    "assets/images/landing/figma/china.jpg",
    "assets/images/landing/figma/dallas.jpg",
    "assets/images/landing/figma/doha.jpg",
    "assets/images/landing/figma/dubai-rated.jpg",
    "assets/images/landing/figma/dubai.jpg",
    "assets/images/landing/figma/egypt.jpg",
    "assets/images/landing/figma/fiji.jpg",
    "assets/images/landing/figma/finland.jpg",
    "assets/images/landing/figma/france-beyond.jpg",
    "assets/images/landing/figma/france.jpg",
    "assets/images/landing/figma/goa.jpg",
    "assets/images/landing/figma/greece.jpg",
    "assets/images/landing/figma/italy.jpg",
    "assets/images/landing/figma/japan-rated.jpg",
    "assets/images/landing/figma/japan.jpg",
    "assets/images/landing/figma/kenya.jpg",
    "assets/images/landing/figma/kuwait.jpg",
    "assets/images/landing/figma/london.jpg",
    "assets/images/landing/figma/malaysia.jpg",
    "assets/images/landing/figma/maldives.jpg",
    "assets/images/landing/figma/morocco.jpg",
    "assets/images/landing/figma/muscat.jpg",
    "assets/images/landing/figma/norway.jpg",
    "assets/images/landing/figma/perth.jpg",
    "assets/images/landing/figma/philippines.jpg",
    "assets/images/landing/figma/qatar.jpg",
    "assets/images/landing/figma/queensland.jpg",
    "assets/images/landing/figma/saudi.jpg",
    "assets/images/landing/figma/seychelles.jpg",
    "assets/images/landing/figma/singapore-rated.jpg",
    "assets/images/landing/figma/singapore.jpg",
    "assets/images/landing/figma/spain.jpg",
    "assets/images/landing/figma/sri-lanka.jpg",
    "assets/images/landing/figma/switzerland.jpg",
    "assets/images/landing/figma/thailand-rated.jpg",
    "assets/images/landing/figma/thailand.jpg",
    "assets/images/landing/figma/trip-paris.jpg",
    "assets/images/landing/figma/west-coast.jpg",
    "assets/images/landing/iconic-india.jpg",
    "assets/images/landing/iconic-usa.jpg",
    "assets/images/landing/iconic-uae.jpg",
    "assets/images/landing/iconic-australia.jpg",
    "assets/images/landing/iconic-switzerland.jpg",
    "assets/images/landing/category-family.jpg",
    "assets/images/landing/category-friends.jpg",
    "assets/images/landing/malaysia.jpg",
    "assets/images/landing/maldives.jpg",
    "assets/images/landing/singapore.jpg",
    "assets/images/landing/thailand.jpg",
    "assets/images/landing/switzerland.jpg",
    "assets/images/landing/package-bali.jpg",
    "assets/images/landing/package-japan.jpg",
    "assets/images/landing/package-maldives.jpg",
    "assets/images/landing/package-swiss.jpg",
    "assets/images/landing/journey-thailand.jpg",
    "assets/images/landing/journey-abudhabi.jpg",
    "assets/images/landing/journey-singapore.jpg",
    "assets/images/landing/journey-kenya.jpg",
    "assets/images/landing/journey-china.jpg",
    "assets/images/landing/journey-philippines.jpg",
    "assets/images/packages/paris_madrid.png",
    "assets/images/packages/amsterdam.png",
    "assets/images/packages/rome_capitals.png",
    "assets/images/packages/swiss_lakes.png",
    "assets/images/packages/hero-main.png",
    "assets/images/packages/hero-extra.png",
    "assets/images/packages/hero-ireland.png",
    "assets/images/packages/hero-bottom-left.png",
    "assets/images/packages/hero-top-right.png",
    "assets/images/packages/rec_swiss.png",
    "assets/images/packages/rec_poland.png",
    "assets/images/packages/rec_denmark.png",
    "assets/images/packages/rec_rome.png",
    "assets/images/packages/rec_greece.png",
    "assets/images/carousel/298f18de7368d8bf7bd2990eb24f6810eda925d8.png",
    "assets/images/carousel/7c9bb08cb5956dcca7fb6dd32858ddff2b68a14b.png",
    "assets/images/carousel/9461ef78d5b2c64f87652fac73805e9213a35670.png",
    "assets/images/carousel/5a77083416f27d9e7ef46e2a41a8bbc29d5368e4.png",
    "assets/images/carousel/7b26466ae7a0e0f5e668541515058f1e0909dfe7.png",
    "assets/images/carousel/00aff3663be8e91084943378716b812028deb8ed.png",
    "assets/images/carousel/ad09d416a20a2501cd067aea058facd4b9e1716d.png",
    "assets/images/carousel/01a9d86412ef1ba4771ccadd74b367673ee2ea18.png",
    "assets/images/carousel/8ed6e4b2a57b555ccca8d58c641b6bff36eb97d0.png",
    "assets/images/carousel/a186d4fd47caec14d6bdc3a1de1127b56f06ed0a.png",
    "assets/images/carousel/f97837c65962a3957abdf2c1a42ca0a42bb370c0.png",
    "assets/images/carousel/ce0efb2b68a93aa1d954fd53ac813964fcc69297.png",
    "assets/images/carousel/6581a971e32d02c3ce8775767dbdafb2862fd5a4.png",
    "assets/images/carousel/1ab16b9f31d07c88e9f41c19bfe47d682d45d599.png",
    "assets/images/carousel/8bfac018e0b5d088221e3bc4de415b914846d691.png",
    "assets/images/carousel/ee3238712beaa496887a72b4528189ec8140bc31.png",
    "assets/images/carousel/7b1bf6da5158aae2bf920bf4ce48dfd9a8ab0b5e.png",
    "assets/images/carousel/498d10936d8c56927051f0d5c9219b68ad210a37.png",
    "assets/images/carousel/50d4dd962bd2963c11f09ef089ed8e504ff9b216.png",
    "assets/images/carousel/19e50e8dfc16003559126ca67cb5b30c8dfd5ea3.png",
    "assets/images/carousel/4aa80d8ffa44d45c60672bcd54650b9f5ad28476.png",
    "assets/images/carousel/42fdcd78d6a8af90e7bed3119d177d79462469c2.png",
    "assets/images/carousel/5469d256df45580d2e848c27876b1a6892442689.png",
    "assets/images/carousel/e5420724dd413e43a879f4c97b6691dc0f0c57cb.png",
    "assets/images/carousel/302218f0c2bb8e37f31503463402ebe033a013da.png",
    "assets/images/carousel/f70b75d84c9ef9346afe240e7cb79a186d943ab0.png",
    "assets/images/carousel/58dd5e1da3776c3981d35f379aa5a2eec600bc37.png",
    "assets/images/carousel/d3f3c58284f6857e97ee497d0246337d42b5adc2.png",
    "assets/images/carousel/30226652af7c11b0e6d6acedbe3185c2fa77ab2b.png",
    "assets/images/carousel/29e3cc64d7affbd630c53133b64ceb250faea24d.png",
    "assets/images/carousel/6c0dda16d51a8cbb7fd43be9c3c8d03fe1368e3c.png",
    "assets/images/carousel/d48db513b2e84629578564e8f41818c4734cc9c9.png",
    "assets/images/landing/v2/de10a4f220002bdc61761b69689914f967c43a4f.png",
    "assets/images/landing/v2/c9bead6e497275756ccd16019bf9b2edce22ff0f.png",
    "assets/images/landing/v2/3ae684ee753ef1ac44e04dd58d51bf5372d3b6b7.png",
    "assets/images/landing/v2/83e73f7af21aee0f2a5faa14b665c075cfe72f6d.png",
    "assets/images/landing/v2/72337a7b09d3ba4fd03d1d86e07289c141527438.png",
    "assets/images/landing/v2/790b3868b58283948991f2bf123076f852ded754.png",
    "assets/images/landing/v2/7ee177b53c1a13292e42dfe728608408eca866b4.png",
    "assets/images/landing/v2/913203100b21ff1ce0f37f7eda5abbf4bc7fcf0a.png",
    "assets/images/landing/v2/14881f5f2df56f40df391589dbfde85257eb23fd.png",
    "assets/images/landing/v2/336eef80238a43deec99488c1c5dcdc67fbdfbcf.png",
    "assets/images/landing/v2/fcaa20e25829f34cb48e69ae02a621c40b9076a6.png",
    "assets/images/landing/v2/f97a527ffaf29af60556813dfc751977cf67b600.png",
    "assets/images/landing/v2/d9cc5bfde3064e909d705c7ac72979990b72d1d2.png",
    "assets/images/landing/v2/d0988a9fb31e25a496199a785912e98fa709f647.png",
    "assets/images/landing/v2/db543af0922854f3ef8366dea9933f0dec45fdde.png",
    "assets/images/landing/v2/ce82cf36c3f2b6058d1c9d2ed24cc222a0eeb540.png",
    "assets/images/landing/v2/ace73d9af2faf76a618eed261a13ca1b475178a1.png",
    "assets/images/landing/v2/569fbfd174b22c25ea88dc81749d6bb9fb480516.png",
    "assets/images/landing/v2/dce94a79f20f749e08e9545104460da7c171bd7a.png",
    "assets/images/landing/v2/35532e5d10d0520e07a6876c77918523ee714b56.png",
    "assets/images/landing/v2/c04ad4c2bf9ee2dc6938a5f493494d905ca9722a.png",
    "assets/images/landing/v2/a04a3a971961c6b20ecf502694db9795259f12ab.png",
]

COUNTRY_NAMES = {
    "malaysia", "maldives", "seychelles", "thailand", "switzerland", "singapore",
    "dubai", "uae", "france", "australia", "china", "india", "bali", "indonesia",
    "japan", "kenya", "fiji", "morocco", "egypt", "qatar", "bahrain", "kuwait",
    "belgium", "austria", "norway", "greece", "spain", "finland", "italy",
    "philippines", "goa", "saudi arabia", "saudi", "perth", "queensland",
}


class UniqueImages:
    def __init__(self, pool: list[str]) -> None:
        self._pool = list(dict.fromkeys(pool))
        self._used: set[str] = set()
        self._idx = 0

    def take(self, preferred: str | None = None) -> str:
        if preferred and preferred not in self._used:
            self._used.add(preferred)
            return preferred
        while self._idx < len(self._pool):
            candidate = self._pool[self._idx]
            self._idx += 1
            if candidate not in self._used:
                self._used.add(candidate)
                return candidate
        # Extend pool with suffix variants if we run out (should not happen)
        base = self._pool[len(self._used) % len(self._pool)]
        variant = f"{base}?v={len(self._used)}"
        self._used.add(variant)
        return variant


def dest_uuid(seed_id: str) -> uuid.UUID:
    return uuid.uuid5(DEST_NAMESPACE, seed_id)


def pkg_uuid(dest_seed_id: str, slot: int) -> uuid.UUID:
    return uuid.uuid5(PKG_NAMESPACE, f"{dest_seed_id}-pkg-{slot}")


def match_terms(region: str) -> list[str]:
    norm = region.lower().strip().replace("_", " ")
    compact = norm.replace(" ", "")
    alias_key = compact if compact in REGION_ALIASES else norm
    return list(dict.fromkeys([region, norm, *REGION_ALIASES.get(alias_key, [])]))


def sqlalchemy_region_filter(region: str):
    terms = match_terms(region)
    conditions = []
    for term in terms:
        if not term:
            continue
        clean = term.lower().replace(" ", "")
        conditions.append(func.replace(func.lower(Package.region), " ", "") == clean)
        conditions.append(func.replace(func.lower(Package.country), " ", "") == clean)
        conditions.append(Package.title.ilike(f"%{term}%"))
        conditions.append(Package.theme.ilike(f"%{term}%"))
    return or_(*conditions)


def package_country(name: str, region: str, tags: list[str]) -> str:
    lower = name.lower()
    if lower in COUNTRY_NAMES or name in {
        "Malaysia", "Maldives", "Seychelles", "Thailand", "Switzerland", "Singapore",
        "France", "Australia", "China", "Japan", "Kenya", "Fiji", "Morocco", "Egypt",
        "Qatar", "Bahrain", "Kuwait", "Belgium", "Austria", "Norway", "Greece", "Spain",
        "Finland", "Italy", "Philippines", "Goa", "Bali", "Indonesia", "India",
        "Saudi Arabia", "Saudi", "Perth", "Queensland", "Dubai", "UAE",
    }:
        return name
    if any("United States" in t for t in tags) or region == "North America":
        return "USA"
    if region == "Middle East":
        if lower in ("dubai", "abu dhabi"):
            return "UAE"
        if lower == "doha":
            return "Qatar"
        if lower == "muscat":
            return "Oman"
        if lower in ("riyadh", "alula", "saudi"):
            return "Saudi Arabia"
    if lower == "london":
        return "United Kingdom"
    if lower == "goa":
        return "India"
    if lower == "bali":
        return "Indonesia"
    if lower == "perth" or lower == "queensland":
        return "Australia"
    return name


def theme_for_region(region: str) -> str:
    mapping = {
        "Europe": "europe-theme",
        "Asia": "asia-theme",
        "Middle East": "me-theme",
        "North America": "usa-theme",
        "Oceania": "asia-theme",
        "Africa": "africa-theme",
    }
    return mapping.get(region, "global-theme")


def preferred_dest_image(name: str, region: str) -> str | None:
    """Best-effort themed image before falling back to the pool."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    candidates = [
        f"assets/images/landing/figma/{slug}.jpg",
        f"assets/images/landing/figma/{slug}-rated.jpg",
        f"assets/images/landing/{slug}.jpg",
    ]
    if name.lower() == "new york":
        return "assets/images/landing/iconic-usa.jpg"
    if name.lower() == "los angeles":
        return "assets/images/landing/v2/de10a4f220002bdc61761b69689914f967c43a4f.png"
    if name.lower() == "orlando":
        return "assets/images/landing/category-family.jpg"
    if name.lower() == "east coast":
        return "assets/images/landing/category-friends.jpg"
    for c in candidates:
        if c in IMAGE_POOL:
            return c
    return None


async def sync_destinations(session, raw_dests: list[dict], images: UniqueImages) -> dict[str, uuid.UUID]:
    """Upsert all seed_data destinations; return name -> id (first wins for duplicates)."""
    name_to_id: dict[str, uuid.UUID] = {}
    seed_ids: set[uuid.UUID] = set()

    for dest in raw_dests:
        did = dest_uuid(dest["id"])
        seed_ids.add(did)
        img = images.take(preferred_dest_image(dest["name"], dest.get("region", "")) or dest.get("image_url"))
        existing = (
            await session.execute(select(Destination).where(Destination.id == did))
        ).scalar_one_or_none()
        payload = {
            "name": dest["name"],
            "description": dest["description"],
            "image_url": img,
            "base_price": dest["base_price"],
            "region": dest["region"],
            "tags": dest["tags"],
            "latitude": dest.get("latitude", 0.0),
            "longitude": dest.get("longitude", 0.0),
        }
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
        else:
            session.add(Destination(id=did, **payload))
        name_to_id.setdefault(dest["name"], did)

    # Remove stale destinations from the old 12-city comprehensive seed
    all_dests = (await session.execute(select(Destination))).scalars().all()
    for d in all_dests:
        if d.id in seed_ids:
            continue
        replacement = name_to_id.get(d.name)
        if replacement:
            await session.execute(
                text(
                    "UPDATE community_posts SET destination_id = :new "
                    "WHERE destination_id = :old"
                ),
                {"new": replacement, "old": d.id},
            )
        else:
            await session.execute(
                text(
                    "UPDATE community_posts SET destination_id = NULL "
                    "WHERE destination_id = :old"
                ),
                {"old": d.id},
            )
        await session.delete(d)

    await session.commit()
    print(f"Synced {len(raw_dests)} destinations ({len(name_to_id)} unique names).")
    return name_to_id


async def ensure_packages_per_place(session, raw_dests: list[dict], images: UniqueImages) -> int:
    created = 0
    for dest in raw_dests:
        name = dest["name"]
        count = (
            await session.execute(
                select(func.count()).select_from(Package).where(sqlalchemy_region_filter(name))
            )
        ).scalar() or 0
        if count >= 2:
            continue

        region = dest.get("region", "Global")
        country = package_country(name, region, dest.get("tags", []))
        theme = theme_for_region(region)
        base_price = int(dest.get("base_price", 50000))
        templates = [
            (f"{name} Discovery Tour", base_price, 5, "Standard", 4.3),
            (f"{name} Premium Getaway", int(base_price * 1.35), 7, "Premium", 4.6),
        ]
        need = 2 - count
        for slot, (title, price, days, tier, rating) in enumerate(templates[:need], start=1):
            img = images.take(preferred_dest_image(name, region))
            pid = pkg_uuid(dest["id"], slot)
            existing = (
                await session.execute(select(Package).where(Package.id == pid))
            ).scalar_one_or_none()
            data = {
                "title": title,
                "theme": theme,
                "price": price,
                "days": days,
                "group_type": "Couple",
                "image_url": img,
                "region": region,
                "country": country,
                "budget_tier": tier,
                "rating": rating,
            }
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                session.add(Package(id=pid, **data))
            created += 1

    await session.commit()
    print(f"Ensured packages for all places (+{created} new/updated gap-fill packages).")
    return created


async def uniquify_package_images(session, images: UniqueImages) -> None:
    packages = (await session.execute(select(Package).order_by(Package.title))).scalars().all()
  # reset used for packages only — keep destination images
    pkg_images = UniqueImages(IMAGE_POOL)
    for pkg in packages:
        pref = preferred_dest_image(pkg.country or pkg.title, pkg.region or "")
        pkg.image_url = pkg_images.take(pref or pkg.image_url)
    await session.commit()
    print(f"Assigned unique images to {len(packages)} packages.")


async def uniquify_trip_images(session, name_to_id: dict[str, uuid.UUID]) -> None:
    dest_rows = (await session.execute(text("SELECT id, name, image_url FROM destinations"))).all()
    by_name = {r[1]: r[2] for r in dest_rows}
    trips = (await session.execute(text("SELECT id, destination, image FROM trips"))).all()
    trip_images = UniqueImages(IMAGE_POOL)
    for tid, destination, _img in trips:
        dest_name = destination or ""
        pref = by_name.get(dest_name) or preferred_dest_image(dest_name, "")
        new_img = trip_images.take(pref)
        await session.execute(
            text("UPDATE trips SET image = :img WHERE id = :id"),
            {"img": new_img, "id": tid},
        )
    await session.commit()
    print(f"Updated images on {len(trips)} trips.")


async def uniquify_blog_and_community(session, name_to_id: dict[str, uuid.UUID]) -> None:
    blog_images = UniqueImages(IMAGE_POOL)
    posts = (await session.execute(text("SELECT id FROM blog_posts ORDER BY id"))).all()
    for (pid,) in posts:
        await session.execute(
            text("UPDATE blog_posts SET image_url = :img WHERE id = :id"),
            {"img": blog_images.take(), "id": pid},
        )

    comm_images = UniqueImages(IMAGE_POOL)
    comm = (await session.execute(
        text("SELECT id, location FROM community_posts ORDER BY id")
    )).all()
    for cid, location in comm:
        loc = (location or "").strip()
        pref = preferred_dest_image(loc, "") if loc else None
        img = comm_images.take(pref)
        dest_id = name_to_id.get(loc)
        await session.execute(
            text(
                "UPDATE community_posts SET images = :imgs, destination_id = :did WHERE id = :id"
            ),
            {"imgs": json.dumps([img]), "did": dest_id, "id": cid},
        )

    await session.commit()
    print(f"Updated {len(posts)} blog posts and {len(comm)} community posts.")


async def verify_coverage(session, raw_dests: list[dict]) -> list[str]:
    missing: list[str] = []
    seen_names: set[str] = set()
    for dest in raw_dests:
        name = dest["name"]
        if name in seen_names:
            continue
        seen_names.add(name)
        count = (
            await session.execute(
                select(func.count()).select_from(Package).where(sqlalchemy_region_filter(name))
            )
        ).scalar() or 0
        if count == 0:
            missing.append(name)
    return missing


async def main() -> None:
    seed_path = resolve_seed_json()
    if not seed_path.exists():
        raise SystemExit(f"Missing seed_data.json (tried {SEED_JSON_CANDIDATES})")

    with open(seed_path) as f:
        data = json.load(f)
    raw_dests: list[dict] = data.get("destinations", [])

    db_url = os.getenv("DATABASE_URL", PLANNER_DB_URL)
    if "postgres:5432" in db_url or os.getenv("DOCKER", "").lower() == "true":
        db_url = db_url.replace("localhost", "postgres")

    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine)

    dest_images = UniqueImages(IMAGE_POOL)

    async with session_factory() as session:
        name_to_id = await sync_destinations(session, raw_dests, dest_images)
        await ensure_packages_per_place(session, raw_dests, UniqueImages(IMAGE_POOL))
        await uniquify_package_images(session, UniqueImages(IMAGE_POOL))
        await uniquify_trip_images(session, name_to_id)
        await uniquify_blog_and_community(session, name_to_id)
        missing = await verify_coverage(session, raw_dests)
        if missing:
            print("WARNING: still no packages for:", ", ".join(missing))
        else:
            dest_count = (await session.execute(select(func.count()).select_from(Destination))).scalar()
            pkg_count = (await session.execute(select(func.count()).select_from(Package))).scalar()
            print(f"OK: {dest_count} destinations, {pkg_count} packages — every place has packages.")


if __name__ == "__main__":
    asyncio.run(main())
