"""No-op pass-through after 0022_community_discover_saved.

This was originally authored as a merge of two divergent heads
(community/discover-saved vs. a planned trip-planning/circles migration).
The trip-planning/circles migration was never actually created — the
"trip-travelcircles-uidone" commit that added this file only touched
frontend UI/mock-data files (see git history), so `0022_trip_planning_circles`
never existed anywhere in the repo and no model/table depends on it. There is
only one real head (0022_community_discover_saved), so this collapses to a
plain linear revision rather than a merge.

Revision ID: 0023_merge_heads
Revises: 0022_community_discover_saved
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '0023_merge_heads'
down_revision: Union[str, Sequence[str], None] = '0022_community_discover_saved'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
