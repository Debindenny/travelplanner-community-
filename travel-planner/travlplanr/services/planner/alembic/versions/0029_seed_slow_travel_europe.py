"""Seed the "Slow Travel Europe" circle with a real member roster

Revision ID: 0029_seed_slow_europe
Revises: 0028_name_dev_account
Create Date: 2026-09-03 00:00:00.000000

Third model Travel Circle, created the same way 0027 seeded Japan Spring
2027 / Solo Women Travelers — a real community_spaces row plus real members
from the frontend's demo-user registry (community-mock-users.ts), rather than
reusing Japan Spring 2027's exact four people (the original frontend mock
just lazily reused the same fixture list across every card; this gives it
its own distinct, thematically fitting roster instead).
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0029_seed_slow_europe'
down_revision: Union[str, Sequence[str], None] = '0028_name_dev_account'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SLOW_EUROPE_CIRCLE_ID = '10000000-0000-0000-0000-000000000003'

# (customer_id, name, local_in) — ids match apps/web's community-mock-users.ts registry.
MEMBERS = [
    ('0a96d054-53a3-4fdd-9944-ee38d61d17e2', 'Daniel Rossi', 'Italy'),
    ('bd90e331-aae6-4a7b-8096-40c793876754', 'Camille Roy', 'France'),
    ('2629d17e-2f85-48d6-9777-1f5592da1601', 'Jonas Weber', 'Germany'),
    ('3a64158a-f27b-4ae0-a665-0c04da0af7eb', 'Nora Fjeld', 'Norway'),
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
        SELECT '{SLOW_EUROPE_CIRCLE_ID}', '{MEMBERS[0][0]}', 'Slow Travel Europe',
            'Two weeks minimum, trains over flights, one city at a time.',
            'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=600&q=80',
            'public', NULL, '#8b5cf6', '#8b5cf6', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM community_spaces WHERE id = '{SLOW_EUROPE_CIRCLE_ID}')
    """)

    for (customer_id, _name, _local_in), days_ago in zip(MEMBERS, JOINED_DAYS_AGO):
        role = 'admin' if customer_id == MEMBERS[0][0] else 'member'
        _seed_member(SLOW_EUROPE_CIRCLE_ID, customer_id, role, days_ago)


def downgrade() -> None:
    for customer_id, _name, _local_in in MEMBERS:
        op.execute(f"DELETE FROM community_space_members WHERE space_id = '{SLOW_EUROPE_CIRCLE_ID}' AND customer_id = '{customer_id}'")
    op.execute(f"DELETE FROM community_spaces WHERE id = '{SLOW_EUROPE_CIRCLE_ID}'")
    all_ids = "', '".join(cid for cid, _n, _l in MEMBERS)
    op.execute(f"DELETE FROM community_profiles WHERE customer_id IN ('{all_ids}')")
