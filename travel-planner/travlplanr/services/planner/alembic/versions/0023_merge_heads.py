"""Merge divergent heads (community/discover-saved vs trip-planning/circles)

Revision ID: 0023_merge_heads
Revises: 0022_community_discover_saved, 0022_trip_planning_circles
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '0023_merge_heads'
down_revision: Union[str, Sequence[str], None] = ('0022_community_discover_saved', '0022_trip_planning_circles')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
