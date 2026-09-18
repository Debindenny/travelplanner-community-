"""Scale up the four seeded Travel Circles' rosters and add a detail note

Revision ID: 0041_circle_roster_scale
Revises: 0040_merge_heads
Create Date: 2026-09-18 00:00:00.000000

The four model circles (0027, 0029, 0030) were seeded with just their 4 named
members each, so `member_count` (a real COUNT(*) over community_space_members,
not a display fake) came out far smaller than the product's own reference
design for this page (Japan Spring 2027: 18, Solo Women Travelers: 2.4K, Slow
Travel Europe: 860, Paris June Crew: 9). This tops each roster up with
anonymous padding members (real rows, no profile — they never surface beyond
the aggregate count) to match, adds a `detail_note` column for the two
invite-only circles' "4 planning together" / "overlapping dates" flavor text,
and fixes the named members' `joined_at` spread: the seed migrations gave the
circle's admin the *most recent* join time instead of the earliest, so
`GET /spaces/{id}/members` (ascending by joined_at) surfaced the wrong two
people in the card's name preview.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0041_circle_roster_scale'
down_revision: Union[str, Sequence[str], None] = '0040_merge_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JAPAN_CIRCLE_ID = '10000000-0000-0000-0000-000000000001'
SOLO_WOMEN_CIRCLE_ID = '10000000-0000-0000-0000-000000000002'
SLOW_EUROPE_CIRCLE_ID = '10000000-0000-0000-0000-000000000003'
PARIS_CREW_CIRCLE_ID = '10000000-0000-0000-0000-000000000004'

# (customer_id, days_ago) per circle, oldest first — matches each circle's
# original seed roster order (0027/0029/0030), just with the join spread
# reversed so the admin (first in that list) is genuinely the earliest member.
ROSTER_JOIN_ORDER = {
    JAPAN_CIRCLE_ID: [
        ('e52b43b7-9af4-4318-ae1b-d2b3cd0cc4fe', 40),  # Priya Nair (admin)
        ('a2dd0a45-be25-4804-9b2c-daa81d1d358b', 30),  # Marco Villa
        ('7efdbee8-bc0a-481d-a214-08683f6869c8', 15),  # Emma Ross
        ('6f784546-fb73-4ce8-a982-960b50bcf76d', 5),   # Aarav Menon
    ],
    SOLO_WOMEN_CIRCLE_ID: [
        ('80da4269-efef-482e-bf18-b5291ce03abf', 40),  # Maya Kondo (admin)
        ('286da2eb-d51b-4bff-b139-5724fd719cf4', 30),  # Rhea Sharma
        ('2a19f98e-d049-4ff4-9fb0-eb769e89bc10', 15),  # Lea Fontaine
        ('fd828756-f0f6-4573-956b-035b8947b4ca', 5),   # Sofia Marchetti
    ],
    SLOW_EUROPE_CIRCLE_ID: [
        ('0a96d054-53a3-4fdd-9944-ee38d61d17e2', 40),  # Daniel Rossi (admin)
        ('bd90e331-aae6-4a7b-8096-40c793876754', 30),  # Camille Roy
        ('2629d17e-2f85-48d6-9777-1f5592da1601', 15),  # Jonas Weber
        ('3a64158a-f27b-4ae0-a665-0c04da0af7eb', 5),   # Nora Fjeld
    ],
    PARIS_CREW_CIRCLE_ID: [
        ('5ee4f1d5-9a7b-438f-86e4-e50946e2f09d', 40),  # Iker Solano (admin)
        ('a9d0815c-8c37-45a7-bea4-9e89f97a267a', 30),  # Tom Becker
        ('08f2fb90-d39d-49d7-85cb-8289d11820fc', 15),  # Owen Park
        ('ab06d1bc-2fc8-4b4f-8d30-2a18029b26a3', 5),   # Liam Foster
    ],
}

# Target member_count (including the 4 named members above) per circle.
ROSTER_TARGET_SIZE = {
    JAPAN_CIRCLE_ID: 18,
    SOLO_WOMEN_CIRCLE_ID: 2400,
    SLOW_EUROPE_CIRCLE_ID: 860,
    PARIS_CREW_CIRCLE_ID: 9,
}

DETAIL_NOTES = {
    JAPAN_CIRCLE_ID: '4 planning together',
    PARIS_CREW_CIRCLE_ID: 'overlapping dates',
}


def upgrade() -> None:
    op.add_column('community_spaces', sa.Column('detail_note', sa.String(length=64), nullable=True))

    for space_id, roster in ROSTER_JOIN_ORDER.items():
        for customer_id, days_ago in roster:
            op.execute(f"""
                UPDATE community_space_members
                SET joined_at = now() - interval '{days_ago} days'
                WHERE space_id = '{space_id}' AND customer_id = '{customer_id}'
            """)

    for space_id, note in DETAIL_NOTES.items():
        op.execute(f"UPDATE community_spaces SET detail_note = '{note}' WHERE id = '{space_id}'")

    for space_id, target in ROSTER_TARGET_SIZE.items():
        padding = target - len(ROSTER_JOIN_ORDER[space_id])
        if padding <= 0:
            continue
        # Anonymous padding rows: real membership rows (a genuine COUNT(*)
        # backs member_count), but no community_profiles entry, so they never
        # appear in a name preview — the UI only ever previews the earliest
        # two joiners, who are always the named members seeded above.
        op.execute(f"""
            INSERT INTO community_space_members (id, space_id, customer_id, role, joined_at)
            SELECT gen_random_uuid(), '{space_id}', gen_random_uuid(), 'member', now()
            FROM generate_series(1, {padding})
        """)


def downgrade() -> None:
    for space_id, roster in ROSTER_JOIN_ORDER.items():
        named_ids = "', '".join(cid for cid, _d in roster)
        op.execute(f"""
            DELETE FROM community_space_members
            WHERE space_id = '{space_id}' AND customer_id NOT IN ('{named_ids}')
        """)
    op.drop_column('community_spaces', 'detail_note')
