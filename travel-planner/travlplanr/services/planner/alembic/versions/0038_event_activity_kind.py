"""Add kind/extra columns to event_itinerary_activities

Revision ID: 0038_event_activity_kind
Revises: 0037_saved_item_id_string
Create Date: 2026-09-25 00:00:00.000000

The Event Hosting Assistant now generates real flight/hotel/bus/train
segments (see EventHostAssistantService.buildItineraryDays() and
journeyActivityToTripSegment() on the frontend), not just generic
activities — a host's "Hotel Check-in", "Flight to X" or "Airport Express
Shuttle" needs to render as the matching itinerary-timeline card (and stay
locked/non-reorderable) after a reload, not fall back to a plain activity
card once it round-trips through the backend.

`kind` mirrors the frontend's JourneyActivity.kind discriminator
('flight' | 'hotel' | 'bus' | 'train' | null for a plain activity). `extra`
holds the handful of kind-specific display fields (carrier, flight number,
airport/station codes, hotel amenities, etc.) as a single flexible JSON blob
rather than a dozen mostly-null columns, since which fields are meaningful
depends entirely on `kind`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0038_event_activity_kind'
down_revision: Union[str, Sequence[str], None] = '0037_saved_item_id_string'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'event_itinerary_activities',
        sa.Column('kind', sa.String(length=16), nullable=True),
    )
    op.add_column(
        'event_itinerary_activities',
        sa.Column('extra', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('event_itinerary_activities', 'extra')
    op.drop_column('event_itinerary_activities', 'kind')
