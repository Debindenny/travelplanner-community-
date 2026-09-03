#!/usr/bin/env python3
"""
Seed all databases with rich demo data. Runs inside the planner Docker container
(sqlalchemy + asyncpg only — no cross-service Python imports).

  docker exec -e DOCKER=true travlplanr-planner-1 python /app/scripts/seed_comprehensive.py
  docker exec -e DOCKER=true -e SEED_FORCE=true travlplanr-planner-1 python /app/scripts/seed_comprehensive.py --force
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import secrets
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
PW_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$AADAuLdWCuH8f49RSgmhtA$"
    "/RaB1BnRLqR/yn7pnH8hl9Tx8NKExBkgHldBaks5JcI"
)
NOW = datetime.now(timezone.utc)
NAIVE_NOW = datetime.utcnow()
DESTINATIONS = [
    "Paris", "Tokyo", "Bali", "New York", "Rome", "London", "Dubai",
    "Sydney", "Barcelona", "Maldives", "Amsterdam", "Bangkok",
]
CUSTOMER_TYPES = ["COUPLE", "SOLO", "FAMILY", "FRIENDS"]
TRIP_STATUSES = ["READY", "PENDING", "BOOKED", "CREATED", "DRAFT"]


def db_url(name: str) -> str:
    host = "postgres" if os.getenv("DOCKER", "").lower() in ("1", "true", "yes") else "localhost"
    return f"postgresql+asyncpg://travlplanr:travlplanr@{host}:5432/{name}"


def _run_script(name: str, *, optional: bool = False) -> None:
    scripts = Path(__file__).resolve().parent
    env = {**os.environ, "DOCKER": os.getenv("DOCKER", "true")}
    print(f"\n=== {name} ===")
    result = subprocess.run([sys.executable, str(scripts / name)], env=env)
    if result.returncode != 0:
        if optional:
            print(f"Warning: {name} failed (exit {result.returncode}) — continuing")
        else:
            result.check_returncode()


async def seed_identity(session, force: bool) -> dict:
    """Users, profiles, plans, subscriptions, assignments, notification settings."""
    count = (await session.execute(text("SELECT COUNT(*) FROM customer_profiles"))).scalar() or 0
    if count >= 5 and not force:
        print("Identity: already seeded (use --force)")
        rows = (await session.execute(text("SELECT id, user_id FROM customer_profiles LIMIT 100"))).all()
        staff = (await session.execute(text("SELECT id FROM staff LIMIT 1"))).scalar()
        return {"customers": [(r[0], r[1]) for r in rows], "staff_id": staff}

    if force:
        await session.execute(text(
            "TRUNCATE notification_settings, customer_assignments, subscriptions, "
            "customer_profiles CASCADE"
        ))
        await session.execute(text(
            "DELETE FROM users WHERE user_kind = 'CUSTOMER'"
        ))

    # Plans
    for code, name, limit in [
        ("free", "Free", 3),
        ("individual", "Individual", 50),
        ("travel_partner", "Travel Partner", 200),
    ]:
        await session.execute(
            text(
                "INSERT INTO plans (code, name, plans_limit) VALUES (:c, :n, :l) "
                "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, plans_limit = EXCLUDED.plans_limit"
            ),
            {"c": code, "n": name, "l": limit},
        )

    admin_staff = (await session.execute(text("SELECT id FROM staff LIMIT 1"))).scalar()
    customers: list[tuple[uuid.UUID, uuid.UUID]] = []
    random.seed(42)

    for i in range(1, 101):
        user_id = uuid.uuid5(TENANT_ID, f"customer-user-{i}")
        profile_id = uuid.uuid5(TENANT_ID, f"customer-profile-{i}")
        email = f"customer{i}@example.com"
        ctype = random.choice(CUSTOMER_TYPES)
        joined = NOW - timedelta(days=random.randint(1, 365))

        await session.execute(
            text(
                "INSERT INTO users (id, email, password_hash, user_kind, status, tenant_id, created_at, updated_at) "
                "VALUES (:id, :email, :pw, 'CUSTOMER', 'ACTIVE', :tenant, :joined, :joined) "
                "ON CONFLICT (email) DO NOTHING"
            ),
            {"id": user_id, "email": email, "pw": PW_HASH, "tenant": TENANT_ID, "joined": joined},
        )
        await session.execute(
            text(
                "INSERT INTO customer_profiles "
                "(id, user_id, display_code, name, phone, customer_type, tenant_id, date_joined, is_active) "
                "VALUES (:id, :uid, :code, :name, :phone, :ctype, :tenant, :joined, true) "
                "ON CONFLICT (user_id) DO NOTHING"
            ),
            {
                "id": profile_id,
                "uid": user_id,
                "code": f"CUS{i:06d}",
                "name": f"Customer {i}",
                "phone": f"+155500{i:04d}",
                "ctype": ctype,
                "tenant": TENANT_ID,
                "joined": joined,
            },
        )
        customers.append((profile_id, user_id))

        if admin_staff:
            await session.execute(
                text(
                    "INSERT INTO customer_assignments (id, customer_id, staff_id, role) "
                    "VALUES (:id, :cid, :sid, 'ONBOARDED_BY') ON CONFLICT DO NOTHING"
                ),
                {"id": uuid.uuid4(), "cid": profile_id, "sid": admin_staff},
            )

        period_start = NOW.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = period_start + timedelta(days=30)
        plan = random.choice(["free", "individual", "travel_partner"])
        limit = {"free": 3, "individual": 50, "travel_partner": 200}[plan]
        await session.execute(
            text(
                "INSERT INTO subscriptions "
                "(id, user_id, plan_code, plans_used, plans_limit, period_start, period_end) "
                "VALUES (:id, :uid, :plan, :used, :lim, :ps, :pe) ON CONFLICT DO NOTHING"
            ),
            {
                "id": uuid.uuid4(),
                "uid": user_id,
                "plan": plan,
                "used": random.randint(0, min(10, limit)),
                "lim": limit,
                "ps": period_start,
                "pe": period_end,
            },
        )
        for key in ("trip", "deals", "product"):
            await session.execute(
                text(
                    "INSERT INTO notification_settings (id, user_id, key, enabled) "
                    "VALUES (:id, :uid, :key, true) ON CONFLICT DO NOTHING"
                ),
                {"id": uuid.uuid4(), "uid": user_id, "key": key},
            )

    await session.commit()
    print(f"Identity: seeded {len(customers)} customers + plans/subscriptions/settings")
    return {"customers": customers, "staff_id": admin_staff}


async def load_destination_ids(session) -> list[uuid.UUID]:
    """Destination catalog is synced by seed_places_and_packages.py from seed_data.json."""
    rows = (await session.execute(text("SELECT id FROM destinations"))).all()
    ids = [r[0] for r in rows]
    print(f"Planner: {len(ids)} destinations (from seed_data.json)")
    return ids


async def seed_trips(session, customers: list[tuple[uuid.UUID, uuid.UUID]], force: bool) -> list[uuid.UUID]:
    count = (await session.execute(text("SELECT COUNT(*) FROM trips"))).scalar() or 0
    if count > 5 and not force:
        rows = (await session.execute(text("SELECT id FROM trips LIMIT 300"))).all()
        return [r[0] for r in rows]

    if force:
        await session.execute(text(
            "TRUNCATE expense_shares, trip_expenses, trip_activities, trip_invites, "
            "trip_collaborators, chat_messages, chat_sessions, trips CASCADE"
        ))

    trip_ids: list[uuid.UUID] = []
    random.seed(99)
    for profile_id, _user_id in customers:
        for j in range(random.randint(1, 2)):
            dest = random.choice(DESTINATIONS)
            tid = uuid.uuid5(TENANT_ID, f"trip-{profile_id}-{j}")
            start = (NOW + timedelta(days=random.randint(14, 90))).date().isoformat()
            days_n = random.randint(4, 9)
            end = (datetime.fromisoformat(start) + timedelta(days=days_n - 1)).date().isoformat()
            segments = json.dumps([{"type": "flight", "title": f"Fly to {dest}", "day": 1}])
            days = json.dumps([{"day": d + 1, "title": f"Day {d + 1} in {dest}"} for d in range(days_n)])
            city_days = json.dumps([{"city": dest, "nights": max(days_n - 1, 1)}])

            await session.execute(
                text(
                    "INSERT INTO trips (id, tenant_id, customer_id, customer_name, display_code, title, "
                    "destination, start_date, end_date, travelers, travel_style, travel_method, budget, "
                    "interests, food_preferences, status, image, days, city_days, segments, created_at, updated_at) "
                    "VALUES (:id, :tenant, :cid, :cname, :code, :title, :dest, :start, :end, :trav, "
                    ":style, :method, :budget, :interests, :food, :status, :img, :days, :city_days, "
                    ":segments, :now, :now) ON CONFLICT DO NOTHING"
                ),
                {
                    "id": tid,
                    "tenant": TENANT_ID,
                    "cid": profile_id,
                    "cname": f"Customer",
                    "code": f"ITIN-{random.randint(1000, 9999)}",
                    "title": f"{dest} Adventure",
                    "dest": dest,
                    "start": start,
                    "end": end,
                    "trav": random.randint(1, 4),
                    "style": random.choice(["Couple", "Solo", "Family", "Friends"]),
                    "method": random.choice(["flight", "train", "mixed"]),
                    "budget": random.choice(["Standard", "Premium", "Budget"]),
                    "interests": ["Sightseeing", "Culture", "Food"],
                    "food": ["Local cuisine"],
                    "status": random.choice(TRIP_STATUSES),
                    "img": "assets/images/landing/journey-thailand.jpg",
                    "days": days,
                    "city_days": city_days,
                    "segments": segments,
                    "now": NOW - timedelta(days=random.randint(1, 60)),
                },
            )
            trip_ids.append(tid)
    await session.commit()
    print(f"Planner: {len(trip_ids)} trips")
    return trip_ids


async def seed_cms_and_ops(session, dest_ids: list[uuid.UUID], package_ids: list[uuid.UUID]) -> None:
    """Blog, FAQ, promotions, reviews, support tickets, chat."""
    if (await session.execute(text("SELECT COUNT(*) FROM blog_posts"))).scalar():
        print("CMS/ops: already seeded")
        return

    blogs = [
        ("ultimate-europe-itinerary", "30 Days in Europe", "A month across iconic cities.", "# Europe Guide\n\nParis, Rome, Barcelona..."),
        ("bali-vegan-guide", "Bali Vegan Guide", "Plant-based paradise.", "# Bali eats\n\nUbud cafes and beach shacks."),
        ("japan-sakura-guide", "Japan Cherry Blossom", "Hanami season planner.", "# Sakura calendar\n\nTokyo late March."),
    ]
    for slug, title, excerpt, content in blogs:
        bid = uuid.uuid5(TENANT_ID, f"blog-{slug}")
        await session.execute(
            text(
                "INSERT INTO blog_posts (id, title, slug, excerpt, content, image_url, author, "
                "published_at, read_time, category, category_label, featured, status, tags) "
                "VALUES (:id, :title, :slug, :excerpt, :content, :img, :author, :pub, :rt, "
                ":cat, :clabel, :feat, 'published', '[]')"
            ),
            {
                "id": bid, "title": title, "slug": slug, "excerpt": excerpt, "content": content,
                "img": "assets/images/blog/default.jpg", "author": "Alice Admin",
                "pub": "Oct 15, 2024", "rt": "8 min read", "cat": "guides",
                "clabel": "Travel Guides", "feat": slug == blogs[0][0],
            },
        )
        await session.execute(
            text(
                "INSERT INTO blog_post_revisions (id, blog_post_id, title, content, excerpt, created_at) "
                "VALUES (:id, :bid, :title, :content, :excerpt, :now)"
            ),
            {"id": uuid.uuid4(), "bid": bid, "title": title, "content": content, "excerpt": excerpt, "now": NAIVE_NOW},
        )

    faq_sections = [
        ("general", "General", 1, [("docs-needed", "What documents?", "Passport + visa if required.")]),
        ("europe", "Europe", 2, [("eurail", "Eurail pass?", "Unlimited trains across 33 countries.")]),
    ]
    for sid, stitle, order, items in faq_sections:
        await session.execute(
            text("INSERT INTO faq_sections (id, title, \"order\") VALUES (:id, :title, :ord) ON CONFLICT DO NOTHING"),
            {"id": sid, "title": stitle, "ord": order},
        )
        for iid, q, a in items:
            await session.execute(
                text(
                    "INSERT INTO faq_items (id, section_id, question, answer, \"order\") "
                    "VALUES (:id, :sid, :q, :a, 0) ON CONFLICT DO NOTHING"
                ),
                {"id": iid, "sid": sid, "q": q, "a": a},
            )

    for code, dtype, val in [("SUMMER25", "percentage", 25), ("WELCOME200", "flat", 200)]:
        await session.execute(
            text(
                "INSERT INTO promotions (id, code, discount_type, discount_value, valid_until, is_active) "
                "VALUES (:id, :code, :dtype, :val, :until, true) ON CONFLICT (code) DO NOTHING"
            ),
            {"id": uuid.uuid4(), "code": code, "dtype": dtype, "val": val, "until": NOW + timedelta(days=180)},
        )

    if package_ids:
        for i, pid in enumerate(package_ids[:10]):
            await session.execute(
                text(
                    "INSERT INTO reviews (id, target_type, target_id, customer_name, rating, comment, status, created_at) "
                    "VALUES (:id, 'package', :tid, :name, :rating, :comment, 'Approved', :now)"
                ),
                {
                    "id": uuid.uuid4(), "tid": pid, "name": f"Customer {i + 1}",
                    "rating": random.randint(4, 5), "comment": "Wonderful package — highly recommend!",
                    "now": NAIVE_NOW,
                },
            )

    for i in range(8):
        await session.execute(
            text(
                "INSERT INTO support_tickets (id, customer_name, customer_email, subject, message, status, created_at) "
                "VALUES (:id, :name, :email, :subj, :msg, :status, :now)"
            ),
            {
                "id": uuid.uuid4(), "name": f"Customer {i + 1}", "email": f"customer{i + 1}@example.com",
                "subj": "Booking question", "msg": "Can I change my travel dates?",
                "status": "Open" if i < 3 else "Resolved", "now": NAIVE_NOW,
            },
        )

    print("CMS/ops: blog, FAQ, promotions, reviews, support tickets")


async def seed_community(
    session,
    customers: list[tuple[uuid.UUID, uuid.UUID]],
    dest_ids: list[uuid.UUID],
    trip_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    if (await session.execute(text("SELECT COUNT(*) FROM community_posts"))).scalar():
        print("Community: already seeded")
        return []

    post_ids: list[uuid.UUID] = []
    names = [f"Traveler {i}" for i in range(1, 21)]

    for i, (cid, _) in enumerate(customers[:20]):
        pid = uuid.uuid5(TENANT_ID, f"post-{i}")
        did = random.choice(dest_ids) if dest_ids else None
        await session.execute(
            text(
                "INSERT INTO community_posts (id, customer_id, author_name, location, destination_id, "
                "images, caption, likes_count, comments_count, views_count, created_at, updated_at) "
                "VALUES (:id, :cid, :name, :loc, :did, :imgs, :cap, :likes, :comments, :views, :now, :now)"
            ),
            {
                "id": pid, "cid": cid, "name": names[i % len(names)],
                "loc": random.choice(DESTINATIONS), "did": did,
                "imgs": json.dumps([f"assets/images/community/post{i}.jpg"]),
                "cap": f"Amazing trip to {random.choice(DESTINATIONS)}! #travel",
                "likes": random.randint(5, 200), "comments": random.randint(0, 30),
                "views": random.randint(50, 2000), "now": NAIVE_NOW,
            },
        )
        post_ids.append(pid)

        await session.execute(
            text(
                "INSERT INTO community_profiles (customer_id, bio, profile_views, is_verified, "
                "countries_visited, name, created_at) VALUES (:cid, :bio, :views, :ver, :countries, :name, :now) "
                "ON CONFLICT DO NOTHING"
            ),
            {
                "cid": cid, "bio": "Explorer • Wanderlust", "views": random.randint(10, 500),
                "ver": i < 5, "countries": random.randint(1, 25), "name": names[i % len(names)], "now": NAIVE_NOW,
            },
        )

    # Likes, comments, follows
    for i, pid in enumerate(post_ids[:10]):
        liker = customers[(i + 1) % len(customers)][0]
        await session.execute(
            text("INSERT INTO post_likes (id, post_id, customer_id, created_at) VALUES (:id, :pid, :cid, :now)"),
            {"id": uuid.uuid4(), "pid": pid, "cid": liker, "now": NAIVE_NOW},
        )
        await session.execute(
            text(
                "INSERT INTO post_comments (id, post_id, customer_id, author_name, content, created_at) "
                "VALUES (:id, :pid, :cid, :name, :content, :now)"
            ),
            {"id": uuid.uuid4(), "pid": pid, "cid": liker, "name": "Fan", "content": "Stunning photo!", "now": NAIVE_NOW},
        )

    for i in range(min(15, len(customers) - 1)):
        await session.execute(
            text(
                "INSERT INTO user_follows (id, follower_id, following_id, created_at) "
                "VALUES (:id, :f, :g, :now) ON CONFLICT DO NOTHING"
            ),
            {"id": uuid.uuid4(), "f": customers[i][0], "g": customers[i + 1][0], "now": NAIVE_NOW},
        )

    for i, (cid, _) in enumerate(customers[:8]):
        await session.execute(
            text(
                "INSERT INTO stories (id, customer_id, author_name, media_url, caption, created_at, expires_at) "
                "VALUES (:id, :cid, :name, :url, :cap, :now, :exp)"
            ),
            {
                "id": uuid.uuid4(), "cid": cid, "name": f"Traveler {i}",
                "url": f"assets/stories/{i}.mp4", "cap": "Live from the airport!",
                "now": NAIVE_NOW, "exp": NAIVE_NOW + timedelta(hours=24),
            },
        )
        await session.execute(
            text(
                "INSERT INTO notifications (id, customer_id, type, message, is_read, created_at) "
                "VALUES (:id, :cid, 'like', :msg, :read, :now)"
            ),
            {"id": uuid.uuid4(), "cid": cid, "msg": "Someone liked your post", "read": i > 4, "now": NAIVE_NOW},
        )

    # Hashtags
    tag_ids = []
    for tag in ["travel", "europe", "foodie", "adventure", "luxury"]:
        tid = uuid.uuid5(TENANT_ID, f"tag-{tag}")
        await session.execute(
            text("INSERT INTO hashtags (id, tag, created_at) VALUES (:id, :tag, :now) ON CONFLICT DO NOTHING"),
            {"id": tid, "tag": tag, "now": NAIVE_NOW},
        )
        tag_ids.append(tid)
    if post_ids and tag_ids:
        await session.execute(
            text("INSERT INTO post_hashtags (id, post_id, hashtag_id) VALUES (:id, :pid, :hid)"),
            {"id": uuid.uuid4(), "pid": post_ids[0], "hid": tag_ids[0]},
        )
        for i, pid in enumerate(post_ids[:10]):
            await session.execute(
                text(
                    "INSERT INTO post_reactions (id, post_id, customer_id, reaction_type, created_at) "
                    "VALUES (:id, :pid, :cid, 'love', :now) ON CONFLICT DO NOTHING"
                ),
                {"id": uuid.uuid4(), "pid": pid, "cid": customers[i][0], "now": NAIVE_NOW},
            )
        for i, hid in enumerate(tag_ids):
            cid = customers[i % len(customers)][0]
            await session.execute(
                text(
                    "INSERT INTO hashtag_follows (id, customer_id, hashtag_id, created_at) "
                    "VALUES (:id, :cid, :hid, :now) ON CONFLICT DO NOTHING"
                ),
                {"id": uuid.uuid4(), "cid": cid, "hid": hid, "now": NAIVE_NOW},
            )

    # DMs
    if len(customers) >= 2:
        conv_id = uuid.uuid5(TENANT_ID, "conv-1")
        await session.execute(
            text(
                "INSERT INTO conversations (id, participant1_id, participant2_id, last_message_at) "
                "VALUES (:id, :p1, :p2, :now) ON CONFLICT DO NOTHING"
            ),
            {"id": conv_id, "p1": customers[0][0], "p2": customers[1][0], "now": NAIVE_NOW},
        )
        await session.execute(
            text(
                "INSERT INTO direct_messages (id, conversation_id, sender_id, content, is_read, created_at) "
                "VALUES (:id, :cid, :sid, :content, false, :now)"
            ),
            {"id": uuid.uuid4(), "cid": conv_id, "sid": customers[0][0], "content": "Want to plan a trip together?", "now": NAIVE_NOW},
        )

    # News, ads, shortcuts, collections
    await session.execute(
        text(
            "INSERT INTO community_news (id, title, readers, timeframe, bullet_color, created_at) "
            "VALUES (:id, :title, :readers, 'Top news', 'bg-blue-500', :now)"
        ),
        {"id": uuid.uuid4(), "title": "Summer travel deals are live", "readers": 1240, "now": NAIVE_NOW},
    )
    await session.execute(
        text(
            "INSERT INTO community_ads (id, sponsor_name, tagline, body, button_text, is_active, created_at) "
            "VALUES (:id, :name, :tag, :body, 'Learn more', true, :now)"
        ),
        {"id": uuid.uuid4(), "name": "SkyWings Airlines", "tag": "Fly further", "body": "20% off European routes", "now": NAIVE_NOW},
    )
    await session.execute(
        text(
            "INSERT INTO community_shortcuts (id, title, url, icon_type, created_at) "
            "VALUES (:id, :title, :url, 'hashtag', :now)"
        ),
        {"id": uuid.uuid4(), "title": "#WeekendGetaway", "url": "/community?tag=weekend", "now": NAIVE_NOW},
    )
    if customers:
        coll_id = uuid.uuid5(TENANT_ID, "collection-1")
        await session.execute(
            text(
                "INSERT INTO community_collections (id, customer_id, name, description, is_public, created_at, updated_at) "
                "VALUES (:id, :cid, :name, :desc, true, :now, :now)"
            ),
            {"id": coll_id, "cid": customers[0][0], "name": "Dream Destinations", "desc": "My bucket list", "now": NAIVE_NOW},
        )
        if post_ids:
            await session.execute(
                text(
                    "INSERT INTO community_collection_items (id, collection_id, item_type, item_id, created_at) "
                    "VALUES (:id, :cid, 'post', :iid, :now)"
                ),
                {"id": uuid.uuid4(), "cid": coll_id, "iid": post_ids[0], "now": NAIVE_NOW},
            )

    await session.commit()
    print(f"Community: {len(post_ids)} posts + social graph")
    return post_ids


async def seed_collaboration(
    session,
    customers: list[tuple[uuid.UUID, uuid.UUID]],
    trip_ids: list[uuid.UUID],
) -> None:
    if not trip_ids or (await session.execute(text("SELECT COUNT(*) FROM trip_collaborators"))).scalar():
        print("Collaboration: skip or already seeded")
        return

    for trip_id in trip_ids[:15]:
        owner = customers[0][0]
        invitee = customers[1][1] if len(customers) > 1 else customers[0][1]
        await session.execute(
            text(
                "INSERT INTO trip_collaborators (id, trip_id, user_id, email, display_name, role, status, invited_by, invited_at) "
                "VALUES (:id, :tid, :uid, :email, :name, 'editor', 'active', :inviter, :now) ON CONFLICT DO NOTHING"
            ),
            {
                "id": uuid.uuid4(), "tid": trip_id, "uid": owner,
                "email": "customer1@example.com", "name": "Customer 1",
                "inviter": owner, "now": NOW,
            },
        )
        token = secrets.token_urlsafe(32)
        await session.execute(
            text(
                "INSERT INTO trip_invites (id, trip_id, invitee_email, role, token, status, expires_at, invited_by, created_at) "
                "VALUES (:id, :tid, :email, 'viewer', :token, 'pending', :exp, :inviter, :now)"
            ),
            {
                "id": uuid.uuid4(), "tid": trip_id, "email": "guest@example.com",
                "token": token, "exp": NOW + timedelta(days=7), "inviter": owner, "now": NOW,
            },
        )
        await session.execute(
            text(
                "INSERT INTO trip_activities (id, trip_id, actor_id, actor_name, action, summary, created_at) "
                "VALUES (:id, :tid, :actor, :name, 'edited_day', :summary, :now)"
            ),
            {"id": uuid.uuid4(), "tid": trip_id, "actor": owner, "name": "Customer 1", "summary": "Updated day 2 activities", "now": NOW},
        )
        exp_id = uuid.uuid4()
        await session.execute(
            text(
                "INSERT INTO trip_expenses (id, trip_id, description, category, amount_cents, currency, paid_by, "
                "split_method, settled, created_by, created_at, updated_at) "
                "VALUES (:id, :tid, :desc, 'food', 8500, 'USD', :payer, 'equal', false, :payer, :now, :now)"
            ),
            {"id": exp_id, "tid": trip_id, "desc": "Group dinner", "payer": owner, "now": NOW},
        )
        await session.execute(
            text(
                "INSERT INTO expense_shares (id, expense_id, user_id, share_cents) VALUES (:id, :eid, :uid, 4250)"
            ),
            {"id": uuid.uuid4(), "eid": exp_id, "uid": owner},
        )

    await session.execute(
        text(
            "INSERT INTO travel_buddy_profiles (customer_id, bio, travel_styles, preferred_destinations, languages, is_active) "
            "VALUES (:cid, :bio, :styles, :dests, :langs, true) ON CONFLICT DO NOTHING"
        ),
        {
            "cid": str(customers[0][0]),
            "bio": "Looking for adventure buddies",
            "styles": json.dumps(["adventure", "budget"]),
            "dests": json.dumps(["Tokyo", "Bali"]),
            "langs": json.dumps(["English", "French"]),
        },
    )
    if len(customers) > 1:
        await session.execute(
            text(
                "INSERT INTO travel_buddy_requests (id, sender_id, receiver_id, message, status, created_at, updated_at) "
                "VALUES (:id, :sender, :receiver, :msg, 'pending', :now, :now)"
            ),
            {
                "id": str(uuid.uuid4()), "sender": str(customers[0][0]), "receiver": str(customers[1][0]),
                "msg": "Want to explore Japan together?", "now": NAIVE_NOW,
            },
        )

    await session.commit()
    print("Collaboration: collaborators, invites, expenses, buddy profiles")


async def seed_chat(session, customers: list[tuple[uuid.UUID, uuid.UUID]], trip_ids: list[uuid.UUID]) -> None:
    if (await session.execute(text("SELECT COUNT(*) FROM chat_sessions"))).scalar():
        return
    if not customers:
        return
    cid, _ = customers[0]
    tid = trip_ids[0] if trip_ids else None
    sid = uuid.uuid4()
    await session.execute(
        text(
            "INSERT INTO chat_sessions (id, customer_id, trip_id, status, created_at, updated_at) "
            "VALUES (:id, :cid, :tid, 'active', :now, :now)"
        ),
        {"id": sid, "cid": cid, "tid": tid, "now": NAIVE_NOW},
    )
    for sender, msg in [("user", "Plan a 7-day trip to Paris"), ("assistant", "I'd love to help! What's your budget?")]:
        await session.execute(
            text(
                "INSERT INTO chat_messages (id, session_id, sender, content_type, text_content, created_at) "
                "VALUES (:id, :sid, :sender, 'text', :msg, :now)"
            ),
            {"id": uuid.uuid4(), "sid": sid, "sender": sender, "msg": msg, "now": NAIVE_NOW},
        )
    await session.commit()
    print("Chat: 1 session with messages")


async def seed_affiliate(session, customers: list[tuple[uuid.UUID, uuid.UUID]], trip_ids: list[uuid.UUID]) -> None:
    count = (await session.execute(text("SELECT COUNT(*) FROM bookings"))).scalar() or 0
    if count > 0:
        print("Affiliate: already seeded")
        return
    statuses = ["pending", "confirmed", "completed", "cancelled"]
    for i, (cid, _) in enumerate(customers[:20]):
        await session.execute(
            text(
                "INSERT INTO bookings (id, tenant_id, customer_id, trip_id, package_id, amount, currency, status, created_at, updated_at) "
                "VALUES (:id, :tenant, :cid, :tid, :pkg, :amt, 'USD', :status, :now, :now)"
            ),
            {
                "id": uuid.uuid4(), "tenant": TENANT_ID, "cid": cid,
                "tid": trip_ids[i % len(trip_ids)] if trip_ids else None,
                "pkg": f"PKG-{i:03d}", "amt": round(random.uniform(800, 4500), 2),
                "status": statuses[i % len(statuses)], "now": NOW,
            },
        )
    await session.commit()
    print("Affiliate: 20 bookings")


async def seed_reporting_notifications(session) -> None:
    count = (await session.execute(text("SELECT COUNT(*) FROM admin_notifications"))).scalar() or 0
    if count > 0:
        return
    for ntype, title, msg in [
        ("booking", "New booking", "Customer 5 booked a Paris package"),
        ("support", "Open tickets", "3 support tickets need attention"),
        ("system", "Seed complete", "Comprehensive demo data loaded"),
    ]:
        await session.execute(
            text(
                "INSERT INTO admin_notifications (id, tenant_id, type, title, message, is_read, created_at) "
                "VALUES (:id, :tenant, :type, :title, :msg, false, :now)"
            ),
            {"id": uuid.uuid4(), "tenant": TENANT_ID, "type": ntype, "title": title, "msg": msg, "now": NOW},
        )
    await session.commit()
    print("Reporting: admin notifications")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Comprehensive DB seed (all tables)")
    parser.add_argument("--force", action="store_true", help="Re-seed core tables")
    args = parser.parse_args()
    force = args.force or os.getenv("SEED_FORCE", "").lower() in ("1", "true", "yes")

    id_engine = create_async_engine(db_url("identity_db"))
    pl_engine = create_async_engine(db_url("planner_db"))
    af_engine = create_async_engine(db_url("affiliate_db"))
    rp_engine = create_async_engine(db_url("reporting_db"))

    id_sf = async_sessionmaker(id_engine)
    pl_sf = async_sessionmaker(pl_engine)
    af_sf = async_sessionmaker(af_engine)
    rp_sf = async_sessionmaker(rp_engine)

    async with id_sf() as id_sess:
        ctx = await seed_identity(id_sess, force)

    _run_script("seed_packages.py")
    _run_script("seed_places_and_packages.py")
    _run_script("seed_inventory.py")

    async with pl_sf() as pl_sess:
        dest_ids = await load_destination_ids(pl_sess)
        trip_ids = await seed_trips(pl_sess, ctx["customers"], force)
        pkg_rows = (await pl_sess.execute(text("SELECT id FROM packages LIMIT 20"))).all()
        package_ids = [r[0] for r in pkg_rows]
        await seed_cms_and_ops(pl_sess, dest_ids, package_ids)
        await seed_community(pl_sess, ctx["customers"], dest_ids, trip_ids)
        await seed_collaboration(pl_sess, ctx["customers"], trip_ids)
        await seed_chat(pl_sess, ctx["customers"], trip_ids)

    async with af_sf() as af_sess:
        async with pl_sf() as pl_sess:
            trip_ids = [r[0] for r in (await pl_sess.execute(text("SELECT id FROM trips LIMIT 50"))).all()]
        await seed_affiliate(af_sess, ctx["customers"], trip_ids)

    async with rp_sf() as rp_sess:
        await seed_reporting_notifications(rp_sess)

    _run_script("enrich_trips.py", optional=True)
    _run_script("backfill_reporting.py")

    print("\n✅ Comprehensive seed complete.")
    print("Admin: http://localhost:4202  |  Customers: customer1@example.com / password123")


if __name__ == "__main__":
    asyncio.run(main())
