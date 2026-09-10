"""Event itinerary, activity booking, transport and journey participation tables

Revision ID: 0034_event_itinerary_bookings
Revises: 0033_story_media_optional
Create Date: 2026-09-08 00:00:00.000000

Backs the Community "Hosted Journey" event detail page's itinerary
interactions (book/change activity, add transport, activity selection) and
the join/payment flow with real persistence. event_id is an opaque string
(matches the frontend's CommunityEventCard.id, e.g. "evt-1") rather than a
FK into community_meetups.id — today's hosted-journey demo events have no
row there (see community-events-mock.store.ts).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0034_event_itinerary_bookings'
down_revision: Union[str, Sequence[str], None] = '0033_story_media_optional'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'event_itinerary_days',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_id', sa.String(length=64), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('city', sa.String(length=255), nullable=False),
        sa.Column('date_label', sa.String(length=32), nullable=False),
        sa.Column('price', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('event_id', 'day_number', name='uq_event_itinerary_days_event_day'),
    )
    op.create_index('ix_event_itinerary_days_event_id', 'event_itinerary_days', ['event_id'])

    op.create_table(
        'event_itinerary_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('day_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('event_itinerary_days.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('time', sa.String(length=16), nullable=False),
        sa.Column('category', sa.String(length=255), nullable=False),
        sa.Column('duration', sa.String(length=32), nullable=False),
        sa.Column('rating', sa.Float(), nullable=False),
        sa.Column('image', sa.String(length=2048), nullable=False),
        sa.Column('price', sa.Integer(), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('booked_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('default_included', sa.Boolean(), nullable=False, server_default='true'),
    )
    op.create_index('ix_event_itinerary_activities_day_id', 'event_itinerary_activities', ['day_id'])

    op.create_table(
        'event_activity_selections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', sa.String(length=64), nullable=False),
        sa.Column('activity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('event_itinerary_activities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('included', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('customer_id', 'activity_id', name='uq_event_activity_selections_customer_activity'),
    )
    op.create_index('ix_event_activity_selections_customer_id', 'event_activity_selections', ['customer_id'])
    op.create_index('ix_event_activity_selections_event_id', 'event_activity_selections', ['event_id'])
    op.create_index('ix_event_activity_selections_activity_id', 'event_activity_selections', ['activity_id'])

    op.create_table(
        'event_activity_bookings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', sa.String(length=64), nullable=False),
        sa.Column('activity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('event_itinerary_activities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='booked'),
        sa.Column('participants', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('price_paid', sa.Integer(), nullable=True),
        sa.Column('booked_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('customer_id', 'activity_id', name='uq_event_activity_bookings_customer_activity'),
    )
    op.create_index('ix_event_activity_bookings_customer_id', 'event_activity_bookings', ['customer_id'])
    op.create_index('ix_event_activity_bookings_event_id', 'event_activity_bookings', ['event_id'])
    op.create_index('ix_event_activity_bookings_activity_id', 'event_activity_bookings', ['activity_id'])

    op.create_table(
        'event_transport_segments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', sa.String(length=64), nullable=False),
        sa.Column('after_day', sa.Integer(), nullable=False),
        sa.Column('mode', sa.String(length=32), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('time', sa.String(length=16), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('price', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_event_transport_segments_customer_id', 'event_transport_segments', ['customer_id'])
    op.create_index('ix_event_transport_segments_event_id', 'event_transport_segments', ['event_id'])

    op.create_table(
        'event_journey_participations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', sa.String(length=64), nullable=False),
        sa.Column('mode', sa.String(length=16), nullable=False),
        sa.Column('range_start', sa.Integer(), nullable=True),
        sa.Column('range_end', sa.Integer(), nullable=True),
        sa.Column('payment_status', sa.String(length=16), nullable=False, server_default='pending'),
        sa.Column('amount_paid', sa.Integer(), nullable=True),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trips.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('customer_id', 'event_id', name='uq_event_journey_participations_customer_event'),
    )
    op.create_index('ix_event_journey_participations_customer_id', 'event_journey_participations', ['customer_id'])
    op.create_index('ix_event_journey_participations_event_id', 'event_journey_participations', ['event_id'])


def downgrade() -> None:
    op.drop_table('event_journey_participations')
    op.drop_table('event_transport_segments')
    op.drop_table('event_activity_bookings')
    op.drop_table('event_activity_selections')
    op.drop_table('event_itinerary_activities')
    op.drop_table('event_itinerary_days')
