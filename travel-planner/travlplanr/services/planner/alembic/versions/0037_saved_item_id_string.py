"""Widen community_collection_items.item_id from UUID to string

Revision ID: 0037_saved_item_id_string
Revises: 0036_event_booking_reference
Create Date: 2026-09-10 00:00:00.000000

Lets the existing generic Save/Bookmark mechanism (CommunityCollection /
CommunityCollectionItem, community_saved.py) cover hosted-journey events too —
those use opaque string ids (e.g. "evt-1", same as
event_journey_participations.event_id) rather than UUIDs. Existing UUID values
for the other item types ('post', 'destination', 'itinerary', 'tip') keep
their exact string form on the way through, so no data is lost.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0037_saved_item_id_string'
down_revision: Union[str, Sequence[str], None] = '0036_event_booking_reference'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'community_collection_items',
        'item_id',
        existing_type=sa.UUID(),
        type_=sa.String(length=64),
        postgresql_using='item_id::text',
    )


def downgrade() -> None:
    op.alter_column(
        'community_collection_items',
        'item_id',
        existing_type=sa.String(length=64),
        type_=sa.UUID(),
        postgresql_using='item_id::uuid',
    )
