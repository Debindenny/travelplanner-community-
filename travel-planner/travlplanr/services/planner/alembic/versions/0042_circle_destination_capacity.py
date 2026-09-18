"""Add destination and capacity to circles, and set them for the two crews

Revision ID: 0042_circle_destination_capacity
Revises: 0041_circle_roster_scale
Create Date: 2026-09-18 00:00:00.000000

Backs the detail modal's "Destination" stat and "X of Y spots taken"
capacity bar. Only the two invite-only "trip crew" circles (Japan Spring
2027, Paris June Crew) get a destination + capacity — the two public,
ongoing-topic circles (Solo Women Travelers, Slow Travel Europe) have no
single destination and no roster cap, so both stay null and the UI hides
those elements for them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0042_circle_destination_capacity'
down_revision: Union[str, Sequence[str], None] = '0041_circle_roster_scale'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JAPAN_CIRCLE_ID = '10000000-0000-0000-0000-000000000001'
PARIS_CREW_CIRCLE_ID = '10000000-0000-0000-0000-000000000004'


def upgrade() -> None:
    op.add_column('community_spaces', sa.Column('destination', sa.String(length=120), nullable=True))
    op.add_column('community_spaces', sa.Column('capacity', sa.Integer(), nullable=True))

    op.execute(f"UPDATE community_spaces SET destination = 'Japan', capacity = 24 WHERE id = '{JAPAN_CIRCLE_ID}'")
    op.execute(f"UPDATE community_spaces SET destination = 'Paris', capacity = 12 WHERE id = '{PARIS_CREW_CIRCLE_ID}'")


def downgrade() -> None:
    op.drop_column('community_spaces', 'capacity')
    op.drop_column('community_spaces', 'destination')
