"""Collaborative itineraries — 5 tables + owner-row backfill

Revision ID: 0006_collaborative_itineraries
Revises: 0005_community_enhancements
Create Date: 2026-06-24 14:00:00.000000
"""
from typing import Sequence, Union
from datetime import datetime, timedelta, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0006_collaborative_itineraries'
down_revision: Union[str, None] = '0005_community_enhancements'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. trip_collaborators
    # ------------------------------------------------------------------
    op.create_table(
        'trip_collaborators',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('email', sa.String(320), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('nickname', sa.String(255), nullable=True),
        sa.Column('role', sa.String(20), nullable=False, server_default='viewer'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('invited_by', sa.UUID(), nullable=False),
        sa.Column('invited_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_id', 'email', name='uq_trip_collaborator_email'),
    )
    op.create_index('ix_trip_collaborators_trip_id', 'trip_collaborators', ['trip_id'])
    op.create_index('ix_trip_collaborators_user_id', 'trip_collaborators', ['user_id'])

    # ------------------------------------------------------------------
    # 2. trip_invites
    # ------------------------------------------------------------------
    op.create_table(
        'trip_invites',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('invitee_email', sa.String(320), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='viewer'),
        sa.Column('token', sa.String(128), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('invited_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token', name='uq_trip_invite_token'),
    )
    op.create_index('ix_trip_invites_token', 'trip_invites', ['token'])
    op.create_index('ix_trip_invites_trip_id', 'trip_invites', ['trip_id'])

    # ------------------------------------------------------------------
    # 3. trip_activities
    # ------------------------------------------------------------------
    op.create_table(
        'trip_activities',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=False),
        sa.Column('actor_name', sa.String(255), nullable=False, server_default='Unknown'),
        sa.Column('action', sa.String(80), nullable=False),
        sa.Column('summary', sa.String(500), nullable=False),
        sa.Column('meta', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_trip_activities_trip_id', 'trip_activities', ['trip_id'])

    # ------------------------------------------------------------------
    # 4. trip_expenses  (int cents — never float)
    # ------------------------------------------------------------------
    op.create_table(
        'trip_expenses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('paid_by', sa.UUID(), nullable=False),
        sa.Column('split_method', sa.String(20), nullable=False, server_default='equal'),
        sa.Column('settled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_trip_expenses_trip_id', 'trip_expenses', ['trip_id'])

    # ------------------------------------------------------------------
    # 5. expense_shares
    # ------------------------------------------------------------------
    op.create_table(
        'expense_shares',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('expense_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('share_cents', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['expense_id'], ['trip_expenses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_expense_shares_expense_id', 'expense_shares', ['expense_id'])

    # ------------------------------------------------------------------
    # 6. Add is_confirmed flag to trips (gating expense unlock)
    # ------------------------------------------------------------------
    op.add_column('trips', sa.Column('is_confirmed', sa.Boolean(), nullable=False, server_default='false'))

    # ------------------------------------------------------------------
    # 7. BACKFILL — create an owner TripCollaborator row for every existing
    #    trip so the new require_trip_role guard doesn't lock users out of
    #    their own trips.  Uses op.execute for bulk performance.
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO trip_collaborators (
            id, trip_id, user_id, email, display_name,
            role, status, invited_by, invited_at, accepted_at
        )
        SELECT
            gen_random_uuid(),
            t.id,
            t.customer_id,
            COALESCE(t.customer_name, 'unknown') || '@placeholder.local',
            t.customer_name,
            'owner',
            'active',
            t.customer_id,
            NOW(),
            NOW()
        FROM trips t
        ON CONFLICT (trip_id, email) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_column('trips', 'is_confirmed')
    op.drop_index('ix_expense_shares_expense_id', table_name='expense_shares')
    op.drop_table('expense_shares')
    op.drop_index('ix_trip_expenses_trip_id', table_name='trip_expenses')
    op.drop_table('trip_expenses')
    op.drop_index('ix_trip_activities_trip_id', table_name='trip_activities')
    op.drop_table('trip_activities')
    op.drop_index('ix_trip_invites_token', table_name='trip_invites')
    op.drop_index('ix_trip_invites_trip_id', table_name='trip_invites')
    op.drop_table('trip_invites')
    op.drop_index('ix_trip_collaborators_trip_id', table_name='trip_collaborators')
    op.drop_index('ix_trip_collaborators_user_id', table_name='trip_collaborators')
    op.drop_table('trip_collaborators')
