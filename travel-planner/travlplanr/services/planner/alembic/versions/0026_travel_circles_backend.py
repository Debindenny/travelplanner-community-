"""Travel Circles backend: extend community_spaces with circle fields, add group chat message tables

Revision ID: 0026_travel_circles
Revises: 0025_add_post_visibility
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0026_travel_circles'
down_revision: Union[str, Sequence[str], None] = '0025_add_post_visibility'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS guards: this dev database has previously had migrations from
    # an unmerged branch applied to it (a separate, more extensive Travel Circles
    # implementation on `dev` — commit 54f5369, not an ancestor of this branch)
    # which already added a `visibility` column to community_spaces with the same
    # definition. Guarding each column keeps this migration safe to run regardless
    # of that drift.
    op.execute("ALTER TABLE community_spaces ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public'")
    op.execute("ALTER TABLE community_spaces ADD COLUMN IF NOT EXISTS audience VARCHAR(20)")
    op.execute("ALTER TABLE community_spaces ADD COLUMN IF NOT EXISTS accent VARCHAR(20)")
    op.execute("ALTER TABLE community_spaces ADD COLUMN IF NOT EXISTS accent2 VARCHAR(20)")
    op.execute("ALTER TABLE community_spaces ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP NOT NULL DEFAULT now()")

    op.create_table(
        'space_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('space_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('community_spaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('content', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_space_messages_space_id', 'space_messages', ['space_id'])
    op.create_index('ix_space_messages_sender_id', 'space_messages', ['sender_id'])
    op.create_index('ix_space_messages_created_at', 'space_messages', ['created_at'])

    op.create_table(
        'space_message_poll_votes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('space_messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('option', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'customer_id', name='uq_poll_vote_once'),
    )
    op.create_index('ix_space_message_poll_votes_message_id', 'space_message_poll_votes', ['message_id'])
    op.create_index('ix_space_message_poll_votes_customer_id', 'space_message_poll_votes', ['customer_id'])

    op.create_table(
        'space_message_meetup_rsvps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('space_messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'customer_id', name='uq_meetup_rsvp_once'),
    )
    op.create_index('ix_space_message_meetup_rsvps_message_id', 'space_message_meetup_rsvps', ['message_id'])
    op.create_index('ix_space_message_meetup_rsvps_customer_id', 'space_message_meetup_rsvps', ['customer_id'])

    op.create_table(
        'space_message_expense_settlements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('space_messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'customer_id', name='uq_expense_settlement_once'),
    )
    op.create_index('ix_space_message_expense_settlements_message_id', 'space_message_expense_settlements', ['message_id'])
    op.create_index('ix_space_message_expense_settlements_customer_id', 'space_message_expense_settlements', ['customer_id'])

    op.create_table(
        'space_message_place_adds',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('space_messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'customer_id', name='uq_place_add_once'),
    )
    op.create_index('ix_space_message_place_adds_message_id', 'space_message_place_adds', ['message_id'])
    op.create_index('ix_space_message_place_adds_customer_id', 'space_message_place_adds', ['customer_id'])

    # Seed two demonstration Travel Circles — the same two the frontend used to
    # hardcode in apps/web .../travel-circle-cards.data.ts — as real rows, so the
    # Travel Circles page has persisted data instead of only a frontend mock.
    # `WHERE NOT EXISTS` guards keep this safe to re-run (mirrors the ON CONFLICT
    # backfill pattern in 0006_collaborative_itineraries.py; community_spaces has
    # no unique constraint to conflict on, so an existence check is used instead).
    seed_owner_id = '00000000-0000-0000-0000-0000000000c1'
    japan_circle_id = '10000000-0000-0000-0000-000000000001'
    solo_women_circle_id = '10000000-0000-0000-0000-000000000002'

    op.execute(f"""
        INSERT INTO community_profiles (customer_id, name, profile_views, is_verified, countries_visited, post_visibility, created_at)
        SELECT '{seed_owner_id}', 'Travel Circles', 0, false, 0, 'everyone', now()
        WHERE NOT EXISTS (SELECT 1 FROM community_profiles WHERE customer_id = '{seed_owner_id}')
    """)

    op.execute(f"""
        INSERT INTO community_spaces (id, created_by, name, description, cover_image, visibility, audience, accent, accent2, last_activity_at, created_at)
        SELECT '{japan_circle_id}', '{seed_owner_id}', 'Japan Spring 2027',
            'Cherry-blossom trip planning — splitting JR passes and comparing machiya stays.',
            'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
            'invite_only', NULL, '#8b5cf6', '#c2569b', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM community_spaces WHERE id = '{japan_circle_id}')
    """)

    op.execute(f"""
        INSERT INTO community_spaces (id, created_by, name, description, cover_image, visibility, audience, accent, accent2, last_activity_at, created_at)
        SELECT '{solo_women_circle_id}', '{seed_owner_id}', 'Solo Women Travelers',
            'Safety notes, stays and meetups for women travelling alone.',
            'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80',
            'public', NULL, '#5b3fa0', '#8b5cf6', now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM community_spaces WHERE id = '{solo_women_circle_id}')
    """)

    op.execute(f"""
        INSERT INTO community_space_members (id, space_id, customer_id, role, joined_at)
        SELECT gen_random_uuid(), '{japan_circle_id}', '{seed_owner_id}', 'admin', now()
        WHERE NOT EXISTS (SELECT 1 FROM community_space_members WHERE space_id = '{japan_circle_id}' AND customer_id = '{seed_owner_id}')
    """)

    op.execute(f"""
        INSERT INTO community_space_members (id, space_id, customer_id, role, joined_at)
        SELECT gen_random_uuid(), '{solo_women_circle_id}', '{seed_owner_id}', 'admin', now()
        WHERE NOT EXISTS (SELECT 1 FROM community_space_members WHERE space_id = '{solo_women_circle_id}' AND customer_id = '{seed_owner_id}')
    """)


def downgrade() -> None:
    op.drop_table('space_message_place_adds')
    op.drop_table('space_message_expense_settlements')
    op.drop_table('space_message_meetup_rsvps')
    op.drop_table('space_message_poll_votes')
    op.drop_table('space_messages')

    seed_owner_id = '00000000-0000-0000-0000-0000000000c1'
    japan_circle_id = '10000000-0000-0000-0000-000000000001'
    solo_women_circle_id = '10000000-0000-0000-0000-000000000002'
    op.execute(f"DELETE FROM community_space_members WHERE space_id IN ('{japan_circle_id}', '{solo_women_circle_id}')")
    op.execute(f"DELETE FROM community_spaces WHERE id IN ('{japan_circle_id}', '{solo_women_circle_id}')")
    op.execute(f"DELETE FROM community_profiles WHERE customer_id = '{seed_owner_id}'")

    op.execute("ALTER TABLE community_spaces DROP COLUMN IF EXISTS last_activity_at")
    op.execute("ALTER TABLE community_spaces DROP COLUMN IF EXISTS accent2")
    op.execute("ALTER TABLE community_spaces DROP COLUMN IF EXISTS accent")
    op.execute("ALTER TABLE community_spaces DROP COLUMN IF EXISTS audience")
    op.execute("ALTER TABLE community_spaces DROP COLUMN IF EXISTS visibility")
