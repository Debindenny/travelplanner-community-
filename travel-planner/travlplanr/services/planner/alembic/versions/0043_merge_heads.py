"""Merge heads: 0039_meetup_host_prefs, 0042_circle_destination_capacity.

0039_meetup_host_prefs was authored on top of 0038_event_activity_kind, a
branch that 0040_merge_heads's three-way merge (0037_saved_item_id_string,
0038_template_metrics, 0039_drop_community_polls) never included — leaving
it, and everything built on top of it through 0042, as a second, divergent
head alongside the main merged line. Both are real, already-applied
migrations, so this is a genuine merge point rather than a no-op collapse.

Revision ID: 0043_merge_heads
Revises: 0039_meetup_host_prefs, 0042_circle_destination_capacity
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '0043_merge_heads'
down_revision: Union[str, Sequence[str], None] = (
    '0039_meetup_host_prefs',
    '0042_circle_destination_capacity',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
