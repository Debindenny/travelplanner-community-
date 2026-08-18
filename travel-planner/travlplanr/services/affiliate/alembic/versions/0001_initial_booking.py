"""Add booking model

Revision ID: 0001
Revises: 
Create Date: 2026-06-19 17:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Idempotent enum creation — asyncpg can raise DuplicateObjectError even with checkfirst=True
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE booking_status_enum AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END $$;
    """)

    booking_status_enum = postgresql.ENUM(
        'pending', 'confirmed', 'cancelled', 'completed',
        name='booking_status_enum',
        create_type=False,
    )

    bind = op.get_bind()
    if 'bookings' in sa.inspect(bind).get_table_names():
        return

    op.create_table('bookings',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('customer_id', sa.Uuid(), nullable=False),
        sa.Column('trip_id', sa.Uuid(), nullable=True),
        sa.Column('package_id', sa.String(), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False, server_default='USD'),
        sa.Column('status', booking_status_enum, nullable=False, server_default='pending'),
        sa.Column('stripe_session_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bookings_tenant_id'), 'bookings', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_bookings_customer_id'), 'bookings', ['customer_id'], unique=False)
    op.create_index(op.f('ix_bookings_trip_id'), 'bookings', ['trip_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_bookings_trip_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_customer_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_tenant_id'), table_name='bookings')
    op.drop_table('bookings')
    
    booking_status_enum = postgresql.ENUM('pending', 'confirmed', 'cancelled', 'completed', name='booking_status_enum')
    booking_status_enum.drop(op.get_bind(), checkfirst=True)
