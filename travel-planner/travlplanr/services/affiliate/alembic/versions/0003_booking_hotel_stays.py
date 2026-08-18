"""Add booking hotel stays

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = sa.inspect(bind).get_table_names()

    if 'booking_hotel_stays' not in existing_tables:
        op.create_table(
            'booking_hotel_stays',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('booking_id', sa.Uuid(), nullable=False),
            sa.Column('hotel_name', sa.String(), nullable=False),
            sa.Column('rating', sa.Numeric(3, 1), nullable=True),
            sa.Column('location', sa.String(), nullable=True),
            sa.Column('city', sa.String(), nullable=True),
            sa.Column('distance', sa.String(), nullable=True),
            sa.Column('max_guests', sa.Integer(), nullable=True),
            sa.Column('room_type', sa.String(), nullable=True),
            sa.Column('bed_preference', sa.String(), nullable=True),
            sa.Column('cancellation', sa.String(), nullable=True),
            sa.Column('parking', sa.String(), nullable=True),
            sa.Column('meal_plan', sa.String(), nullable=True),
            sa.Column('amenities', sa.String(), nullable=True),
            sa.Column('price', sa.Numeric(10, 2), nullable=True),
            sa.Column('taxes', sa.Numeric(10, 2), nullable=True),
            sa.Column('currency', sa.String(), nullable=False, server_default='USD'),
            sa.Column('image_url', sa.String(), nullable=True),
            sa.Column('provider', sa.String(), nullable=True),
            sa.Column('provider_offer_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            op.f('ix_booking_hotel_stays_booking_id'), 'booking_hotel_stays', ['booking_id'], unique=False
        )


def downgrade() -> None:
    op.drop_index(op.f('ix_booking_hotel_stays_booking_id'), table_name='booking_hotel_stays')
    op.drop_table('booking_hotel_stays')
