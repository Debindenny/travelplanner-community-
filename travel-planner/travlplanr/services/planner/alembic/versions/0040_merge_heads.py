"""Merge heads: 0037_saved_item_id_string, 0038_template_metrics, 0039_drop_community_polls.

These three migrations were authored independently on top of
0033_story_media_optional (via 0034_event_itinerary_bookings /
0034_trip_templates), leaving alembic with three divergent heads. All are
real, already-applied migrations, so this is a genuine merge point rather
than a no-op collapse.

Revision ID: 0040_merge_heads
Revises: 0037_saved_item_id_string, 0038_template_metrics, 0039_drop_community_polls
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '0040_merge_heads'
down_revision: Union[str, Sequence[str], None] = (
    '0037_saved_item_id_string',
    '0038_template_metrics',
    '0039_drop_community_polls',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
