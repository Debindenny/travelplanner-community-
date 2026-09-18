"""Merge heads: 0040_crew_matching, 0043_merge_heads.

0040_crew_matching was authored on top of 0039_drop_community_polls, a
branch that 0040_merge_heads's three-way merge (0037_saved_item_id_string,
0038_template_metrics, 0039_drop_community_polls) referenced by its
pre-crew-matching tip rather than its actual leaf — leaving
0040_crew_matching, never merged, as a second, divergent head alongside
0043_merge_heads (which itself only resolved the unrelated
0039_meetup_host_prefs / 0042_circle_destination_capacity split). Both are
real, already-applied migrations, so this is a genuine merge point rather
than a no-op collapse.

Revision ID: 0044_merge_heads
Revises: 0040_crew_matching, 0043_merge_heads
Create Date: 2026-09-18 00:00:00.000001

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '0044_merge_heads'
down_revision: Union[str, Sequence[str], None] = (
    '0040_crew_matching',
    '0043_merge_heads',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
