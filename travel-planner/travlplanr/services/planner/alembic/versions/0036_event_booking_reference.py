"""Add booking_reference to event_journey_participations

Revision ID: 0036_event_booking_reference
Revises: 0035_seed_event_itineraries
Create Date: 2026-09-09 00:00:00.000000

Backs the dedicated Payment Success page's booking reference display —
generated server-side (see event_itinerary.py pay_participation) the first
time a participation is marked paid.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0036_event_booking_reference'
down_revision: Union[str, Sequence[str], None] = '0035_seed_event_itineraries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'event_journey_participations',
        sa.Column('booking_reference', sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('event_journey_participations', 'booking_reference')
