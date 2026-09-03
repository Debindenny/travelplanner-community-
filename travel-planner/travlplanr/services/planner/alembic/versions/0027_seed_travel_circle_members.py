"""Re-seed the two model Travel Circles with their real member rosters

Revision ID: 0027_seed_circle_members
Revises: 0026_travel_circles
Create Date: 2026-09-03 00:00:00.000000

The two model circles (Japan Spring 2027, Solo Women Travelers) were deleted
during manual testing after 0026 first seeded them. This re-creates them and,
this time, attaches real members instead of a single generic "Travel Circles"
system account — using the same fixed customer_ids the frontend's demo-user
registry (apps/web .../circles-trips/core/data/community-mock-users.ts)
already reserves for these personas, so every screen that links to one of
these travelers (crew chat, join requests, etc.) resolves to the same profile.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0027_seed_circle_members'
down_revision: Union[str, Sequence[str], None] = '0026_travel_circles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JAPAN_CIRCLE_ID = '10000000-0000-0000-0000-000000000001'
SOLO_WOMEN_CIRCLE_ID = '10000000-0000-0000-0000-000000000002'

# (customer_id, name, local_in) — ids match apps/web's community-mock-users.ts registry.
JAPAN_MEMBERS = [
    ('e52b43b7-9af4-4318-ae1b-d2b3cd0cc4fe', 'Priya Nair', 'India'),
    ('a2dd0a45-be25-4804-9b2c-daa81d1d358b', 'Marco Villa', 'Italy'),
    ('7efdbee8-bc0a-481d-a214-08683f6869c8', 'Emma Ross', 'UK'),
    ('6f784546-fb73-4ce8-a982-960b50bcf76d', 'Aarav Menon', 'India'),
]
SOLO_WOMEN_MEMBERS = [
    ('80da4269-efef-482e-bf18-b5291ce03abf', 'Maya Kondo', 'Japan'),
    ('286da2eb-d51b-4bff-b139-5724fd719cf4', 'Rhea Sharma', 'India'),
    ('2a19f98e-d049-4ff4-9fb0-eb769e89bc10', 'Lea Fontaine', 'France'),
    ('fd828756-f0f6-4573-956b-035b8947b4ca', 'Sofia Marchetti', 'Italy'),
]
# Days-ago each member joined, for a natural "joined Xd/Xw ago" spread. The
# first entry in each roster is the circle admin/Host and has no join label.
JOINED_DAYS_AGO = [0, 3, 8, 9]


def _seed_profile(customer_id: str, name: str, local_in: str) -> None:
    op.execute(f"""
        INSERT INTO community_profiles (customer_id, name, local_in, profile_views, is_verified, countries_visited, post_visibility, created_at)
        SELECT '{customer_id}', '{name}', '{local_in}', 0, false, 0, 'everyone', now()
        WHERE NOT EXISTS (SELECT 1 FROM community_profiles WHERE customer_id = '{customer_id}')
    """)


def _seed_member(space_id: str, customer_id: str, role: str, days_ago: int) -> None:
    op.execute(f"""
        INSERT INTO community_space_members (id, space_id, customer_id, role, joined_at)
        SELECT gen_random_uuid(), '{space_id}', '{customer_id}', '{role}', now() - interval '{days_ago} days'
        WHERE NOT EXISTS (SELECT 1 FROM community_space_members WHERE space_id = '{space_id}' AND customer_id = '{customer_id}')
    """)


def upgrade() -> None:
    for customer_id, name, local_in in JAPAN_MEMBERS + SOLO_WOMEN_MEMBERS:
        _seed_profile(customer_id, name, local_in)

    # Re-create the two circles if a prior cleanup removed them; NOT EXISTS
    # guards make this a no-op when they're already present.
    op.execute(f"""
        INSERT INTO community_spaces (id, created_by, name, description, cover_image, visibility, audience, accent, accent2, last_activity_at, created_at)
        SELECT '{JAPAN_CIRCLE_ID}', '{JAPAN_MEMBERS[0][0]}', 'Japan Spring 2027',
            'Cherry-blossom trip planning — splitting JR passes and comparing machiya stays.',
            'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
            'invite_only', NULL, '#8b5cf6', '#c2569b', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM community_spaces WHERE id = '{JAPAN_CIRCLE_ID}')
    """)
    op.execute(f"""
        INSERT INTO community_spaces (id, created_by, name, description, cover_image, visibility, audience, accent, accent2, last_activity_at, created_at)
        SELECT '{SOLO_WOMEN_CIRCLE_ID}', '{SOLO_WOMEN_MEMBERS[0][0]}', 'Solo Women Travelers',
            'Safety notes, stays and meetups for women travelling alone.',
            'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80',
            'public', 'women_only', '#5b3fa0', '#8b5cf6', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM community_spaces WHERE id = '{SOLO_WOMEN_CIRCLE_ID}')
    """)

    for space_id, roster in ((JAPAN_CIRCLE_ID, JAPAN_MEMBERS), (SOLO_WOMEN_CIRCLE_ID, SOLO_WOMEN_MEMBERS)):
        for (customer_id, _name, _local_in), days_ago in zip(roster, JOINED_DAYS_AGO):
            role = 'admin' if customer_id == roster[0][0] else 'member'
            _seed_member(space_id, customer_id, role, days_ago)

    # The generic "Travel Circles" system account from 0026 is no longer a
    # member/creator of either circle now that real personas own them — drop
    # its now-unused membership rows (the profile row itself is left alone,
    # in case anything else still references it).
    op.execute("DELETE FROM community_space_members WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'")


def downgrade() -> None:
    for space_id, roster in ((JAPAN_CIRCLE_ID, JAPAN_MEMBERS), (SOLO_WOMEN_CIRCLE_ID, SOLO_WOMEN_MEMBERS)):
        for customer_id, _name, _local_in in roster:
            op.execute(f"DELETE FROM community_space_members WHERE space_id = '{space_id}' AND customer_id = '{customer_id}'")

    all_ids = "', '".join(cid for cid, _n, _l in JAPAN_MEMBERS + SOLO_WOMEN_MEMBERS)
    op.execute(f"DELETE FROM community_profiles WHERE customer_id IN ('{all_ids}')")
