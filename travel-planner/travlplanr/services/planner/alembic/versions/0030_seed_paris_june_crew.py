"""Seed "Paris June Crew" and fix seeded-circle display order

Revision ID: 0030_seed_paris_crew
Revises: 0029_seed_slow_europe
Create Date: 2026-09-03 00:00:00.000000

Fourth model Travel Circle, seeded the same way as the other three. Also
pins `created_at` on all four seeded circles to a fixed relative order —
list_spaces() sorts newest-first, and applying these migrations at different
real times would otherwise leave them in an arbitrary/reversed order — so the
grid reliably renders Japan Spring 2027, Solo Women Travelers, Slow Travel
Europe, Paris June Crew, in that order.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0030_seed_paris_crew'
down_revision: Union[str, Sequence[str], None] = '0029_seed_slow_europe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JAPAN_CIRCLE_ID = '10000000-0000-0000-0000-000000000001'
SOLO_WOMEN_CIRCLE_ID = '10000000-0000-0000-0000-000000000002'
SLOW_EUROPE_CIRCLE_ID = '10000000-0000-0000-0000-000000000003'
PARIS_CREW_CIRCLE_ID = '10000000-0000-0000-0000-000000000004'

# (customer_id, name, local_in) — ids match apps/web's community-mock-users.ts registry.
MEMBERS = [
    ('5ee4f1d5-9a7b-438f-86e4-e50946e2f09d', 'Iker Solano', 'Spain'),
    ('a9d0815c-8c37-45a7-bea4-9e89f97a267a', 'Tom Becker', 'Germany'),
    ('08f2fb90-d39d-49d7-85cb-8289d11820fc', 'Owen Park', 'South Korea'),
    ('ab06d1bc-2fc8-4b4f-8d30-2a18029b26a3', 'Liam Foster', 'Ireland'),
]
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
    for customer_id, name, local_in in MEMBERS:
        _seed_profile(customer_id, name, local_in)

    op.execute(f"""
        INSERT INTO community_spaces (id, created_by, name, description, cover_image, visibility, audience, accent, accent2, last_activity_at, created_at)
        SELECT '{PARIS_CREW_CIRCLE_ID}', '{MEMBERS[0][0]}', 'Paris June Crew',
            'Everyone here is in Paris the first week of June. Sharing a food walk and a museum day.',
            'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80',
            'invite_only', NULL, '#c2569b', '#c2569b', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM community_spaces WHERE id = '{PARIS_CREW_CIRCLE_ID}')
    """)

    for (customer_id, _name, _local_in), days_ago in zip(MEMBERS, JOINED_DAYS_AGO):
        role = 'admin' if customer_id == MEMBERS[0][0] else 'member'
        _seed_member(PARIS_CREW_CIRCLE_ID, customer_id, role, days_ago)

    # Pin display order: list_spaces() sorts by created_at desc, so the
    # newest of these four sorts first.
    op.execute(f"UPDATE community_spaces SET created_at = now() - interval '1 hour' WHERE id = '{JAPAN_CIRCLE_ID}'")
    op.execute(f"UPDATE community_spaces SET created_at = now() - interval '2 hour' WHERE id = '{SOLO_WOMEN_CIRCLE_ID}'")
    op.execute(f"UPDATE community_spaces SET created_at = now() - interval '3 hour' WHERE id = '{SLOW_EUROPE_CIRCLE_ID}'")
    op.execute(f"UPDATE community_spaces SET created_at = now() - interval '4 hour' WHERE id = '{PARIS_CREW_CIRCLE_ID}'")


def downgrade() -> None:
    for customer_id, _name, _local_in in MEMBERS:
        op.execute(f"DELETE FROM community_space_members WHERE space_id = '{PARIS_CREW_CIRCLE_ID}' AND customer_id = '{customer_id}'")
    op.execute(f"DELETE FROM community_spaces WHERE id = '{PARIS_CREW_CIRCLE_ID}'")
    all_ids = "', '".join(cid for cid, _n, _l in MEMBERS)
    op.execute(f"DELETE FROM community_profiles WHERE customer_id IN ('{all_ids}')")
