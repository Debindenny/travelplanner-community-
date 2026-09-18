"""Add host_preferences to community_meetups

Revision ID: 0039_meetup_host_prefs
Revises: 0038_event_activity_kind
Create Date: 2026-09-15 00:00:00.000000

The Event Hosting Assistant collects several answers (event type, travel
style, participant limit, budget, raw activity picks, accommodation/
transportation preferences, join option, join range) that have no dedicated
column on community_meetups and were previously kept only in the frontend
form/card object — lost on refresh. `host_preferences` stores them as one
flexible JSON blob so a hosted event's original answers round-trip through
the backend like everything else about it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0039_meetup_host_prefs'
down_revision: Union[str, Sequence[str], None] = '0038_event_activity_kind'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'community_meetups',
        sa.Column('host_preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('community_meetups', 'host_preferences')
