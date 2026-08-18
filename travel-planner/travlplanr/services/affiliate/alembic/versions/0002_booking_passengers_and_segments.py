"""Add booking pnr column, passengers, and flight segments

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = sa.inspect(bind).get_table_names()

    if 'pnr' not in [c['name'] for c in sa.inspect(bind).get_columns('bookings')]:
        op.add_column('bookings', sa.Column('pnr', sa.String(length=6), nullable=True))
        op.create_index(op.f('ix_bookings_pnr'), 'bookings', ['pnr'], unique=True)

    # Idempotent enum creation — asyncpg can raise DuplicateObjectError even with checkfirst=True
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE passenger_type_enum AS ENUM ('adult', 'child', 'infant');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END $$;
    """)
    passenger_type_enum = postgresql.ENUM(
        'adult', 'child', 'infant',
        name='passenger_type_enum',
        create_type=False,
    )

    if 'booking_passengers' not in existing_tables:
        op.create_table(
            'booking_passengers',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('booking_id', sa.Uuid(), nullable=False),
            sa.Column('first_name', sa.String(), nullable=False),
            sa.Column('last_name', sa.String(), nullable=False),
            sa.Column('date_of_birth', sa.Date(), nullable=True),
            sa.Column('passenger_type', passenger_type_enum, nullable=False, server_default='adult'),
            sa.Column('passport_number', sa.String(), nullable=True),
            sa.Column('nationality', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_booking_passengers_booking_id'), 'booking_passengers', ['booking_id'], unique=False)

    if 'booking_flight_segments' not in existing_tables:
        op.create_table(
            'booking_flight_segments',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('booking_id', sa.Uuid(), nullable=False),
            sa.Column('carrier', sa.String(), nullable=False),
            sa.Column('airline_code', sa.String(), nullable=True),
            sa.Column('flight_no', sa.String(), nullable=True),
            sa.Column('cabin_class', sa.String(), nullable=True),
            sa.Column('origin_code', sa.String(), nullable=False),
            sa.Column('destination_code', sa.String(), nullable=False),
            sa.Column('dep_date', sa.String(), nullable=True),
            sa.Column('dep_time', sa.String(), nullable=True),
            sa.Column('arr_date', sa.String(), nullable=True),
            sa.Column('arr_time', sa.String(), nullable=True),
            sa.Column('duration', sa.String(), nullable=True),
            sa.Column('stops', sa.String(), nullable=True),
            sa.Column('refundable', sa.String(), nullable=True),
            sa.Column('price', sa.Numeric(10, 2), nullable=True),
            sa.Column('currency', sa.String(), nullable=False, server_default='USD'),
            sa.Column('provider', sa.String(), nullable=True),
            sa.Column('provider_offer_id', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(
            op.f('ix_booking_flight_segments_booking_id'), 'booking_flight_segments', ['booking_id'], unique=False
        )


def downgrade() -> None:
    op.drop_index(op.f('ix_booking_flight_segments_booking_id'), table_name='booking_flight_segments')
    op.drop_table('booking_flight_segments')

    op.drop_index(op.f('ix_booking_passengers_booking_id'), table_name='booking_passengers')
    op.drop_table('booking_passengers')

    passenger_type_enum = postgresql.ENUM('adult', 'child', 'infant', name='passenger_type_enum')
    passenger_type_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f('ix_bookings_pnr'), table_name='bookings')
    op.drop_column('bookings', 'pnr')
