#!/usr/bin/env python3
"""Seed the community_tips table with starter Discover content.

Run from services/planner (with DATABASE_URL set, e.g. via .env / docker-compose):
  python3 scripts/seed_community_tips.py

Idempotent — skips any tip whose title already exists, so it's safe to re-run.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from shared.config import ServiceSettings  # noqa: E402
from shared.database import create_engine_and_session  # noqa: E402
from app.models.community import CommunityTip  # noqa: E402

TIPS = [
    dict(
        tag="TIP", category="Tips", place="Paris",
        title="Book Eiffel summit slots, skip the lift queue",
        used_label="1.2K used",
        blurb="Summit tickets release 60 days out at 08:00 CET and the stairs option never sells out.",
        author_name="Camille Roy", author_line="Local guide · Paris",
        body=(
            "The lift queue is the whole problem. Summit tickets go live exactly 60 days ahead at "
            "08:00 Paris time — set an alarm and you will get any slot you want. Failing that, buy the "
            "stairs ticket: it is cheaper, never sells out, and you rejoin the lift for the final "
            "section anyway."
        ),
        facts=[{"label": "BEST TIME", "value": "18:30"}, {"label": "COST", "value": "€29"}, {"label": "TIME NEEDED", "value": "2h"}],
        points=["Saves 60–90 minutes in peak season", "Stairs ticket is €18 cheaper", "Sunset slots are the first to sell out"],
        image="https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=600&q=80",
        use_count=1200, save_count=940,
    ),
    dict(
        tag="ROUTE", category="Routes", place="Kyoto",
        title="Kyoto in three unhurried days",
        used_label="840 saves",
        blurb="One district a day, no bus transfers, and the temples timed to when they empty out.",
        author_name="Rhea Sharma", author_line="Travelled Japan 3 times",
        body=(
            "Most Kyoto plans fail because they cross the city twice a day. This one takes a district "
            "at a time: Higashiyama, then Arashiyama, then the centre. Fushimi Inari goes at 07:00 on "
            "day one — by nine it is unrecognisable."
        ),
        facts=[{"label": "LENGTH", "value": "3 days"}, {"label": "PACE", "value": "Slow"}, {"label": "BUDGET", "value": "Mid"}],
        points=["No day needs more than one train", "Two temples per day, not six", "Built around opening times, not distance"],
        image="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
        use_count=840, save_count=840,
    ),
    dict(
        tag="REEL", category="Reels", place="Tokyo",
        title="Sunset from Shibuya Sky",
        used_label="24K views",
        blurb="Ninety seconds of the 17:30 slot, from daylight through to the city lighting up.",
        author_name="Maya Kondo", author_line="Lives in Tokyo",
        body=(
            "Filmed on the open-air deck with no edit. The point of the 17:30 entry is that you get "
            "all three states of the city on one ticket — daylight, dusk, and full night — without "
            "queueing again."
        ),
        facts=[{"label": "SLOT", "value": "17:30"}, {"label": "COST", "value": "¥2,500"}, {"label": "TIME NEEDED", "value": "2h"}],
        points=["Book three weeks ahead for sunset", "West corner stays empty until 18:15", "Bags must go in a locker — no tripods"],
        image="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80",
        use_count=2400, save_count=610,
    ),
    dict(
        tag="FOOD", category="Food", place="Paris",
        title="Montmartre food walks before 11:00",
        used_label="18 routes",
        blurb="Bakeries first, cheese second, and the hill to yourself for the first hour.",
        author_name="Lea Fontaine", author_line="Food writer · 611 saves",
        body=(
            "Start at the bottom and eat your way up. The good bakeries sell out of the morning batch "
            "by ten, and the tour groups arrive around eleven — so the whole thing works in reverse of "
            "what the maps suggest."
        ),
        facts=[{"label": "BEST TIME", "value": "08:30"}, {"label": "COST", "value": "€25"}, {"label": "TIME NEEDED", "value": "3h"}],
        points=["Four stops, all within 900m", "Cash only at two of them", "Ends at the Sacré-Cœur terrace"],
        image="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
        use_count=430, save_count=180,
    ),
    dict(
        tag="BUDGET", category="Budget", place="Europe",
        title="Europe by night train under €400",
        used_label="611 saves",
        blurb="Six cities, fourteen days, every long leg slept through instead of flown.",
        author_name="Marco Villa", author_line="Slow travel · 1.2K saves",
        body=(
            "Night trains replace both the flight and the hotel, which is where the saving comes from. "
            "Booked 90 days out, couchettes are €35–60 a leg. The route is built so no daytime hop is "
            "longer than three hours."
        ),
        facts=[{"label": "LENGTH", "value": "14 days"}, {"label": "TOTAL", "value": "€400"}, {"label": "CITIES", "value": "6"}],
        points=["Saves roughly €700 against flying", "Six fewer hotel nights", "Book 90 days out for couchette prices"],
        image="https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=600&q=80",
        use_count=611, save_count=611,
    ),
    dict(
        tag="TIP", category="Tips", place="Lisbon",
        title="Lisbon without a single taxi",
        used_label="430 used",
        blurb="Trams, one regional train, and which hills to simply not walk up.",
        author_name="Iker Solano", author_line="Lisbon local",
        body=(
            "The 24E and 28E cover almost everything worth seeing, and the Sintra train leaves from "
            "Rossio every twenty minutes. The only real trick is going up by lift or funicular and "
            "walking down."
        ),
        facts=[{"label": "DAY PASS", "value": "€6.80"}, {"label": "COVERS", "value": "All trams"}, {"label": "SAVES", "value": "€90"}],
        points=["Day pass pays for itself in three rides", "24E is never as full as the 28E", "Sintra needs the Rossio train, not a tour"],
        image="https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=600&q=80",
        use_count=430, save_count=300,
    ),
]


async def main() -> None:
    settings = ServiceSettings(service_name="planner")
    _, session_factory = create_engine_and_session(settings.database_url)

    async with session_factory() as session:
        existing_titles = set(
            (await session.execute(select(CommunityTip.title))).scalars().all()
        )
        inserted = 0
        for data in TIPS:
            if data["title"] in existing_titles:
                continue
            session.add(CommunityTip(**data))
            inserted += 1
        await session.commit()
        print(f"Seeded {inserted} new tip(s); {len(TIPS) - inserted} already present.")


if __name__ == "__main__":
    asyncio.run(main())
