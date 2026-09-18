"""Crew matching: destination/date tags on community_spaces + crew_invitations

Revision ID: 0040_crew_matching
Revises: 0039_drop_community_polls
Create Date: 2026-09-17 00:00:00.000000

Backs the "Find your crew" widget's real matching: a crew is a
CommunitySpace tagged with the destination/date window it was matched on
(NULL on every ordinary, non-matched circle). crew_invitations is the one
genuinely new table — CommunitySpace has no invite-by-user concept today.

Also backfills the seeded "Paris June Crew" space (id
10000000-0000-0000-0000-000000000004, see 0030_seed_paris_june_crew.py) with
matching tags so the feature is demoable against existing seed data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0040_crew_matching'
down_revision: Union[str, Sequence[str], None] = '0039_drop_community_polls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PARIS_CREW_CIRCLE_ID = '10000000-0000-0000-0000-000000000004'


def upgrade() -> None:
    op.add_column('community_spaces', sa.Column('crew_destination_key', sa.String(length=255), nullable=True))
    op.add_column('community_spaces', sa.Column('crew_start_date', sa.Date(), nullable=True))
    op.add_column('community_spaces', sa.Column('crew_end_date', sa.Date(), nullable=True))
    op.create_index(op.f('ix_community_spaces_crew_destination_key'), 'community_spaces', ['crew_destination_key'], unique=False)

    op.create_table(
        'crew_invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('space_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('receiver_customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['space_id'], ['community_spaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_crew_invitations_space_id'), 'crew_invitations', ['space_id'], unique=False)
    op.create_index(op.f('ix_crew_invitations_sender_customer_id'), 'crew_invitations', ['sender_customer_id'], unique=False)
    op.create_index(op.f('ix_crew_invitations_receiver_customer_id'), 'crew_invitations', ['receiver_customer_id'], unique=False)

    op.execute(f"""
        UPDATE community_spaces
        SET crew_destination_key = 'paris', crew_start_date = '2026-06-03', crew_end_date = '2026-06-09'
        WHERE id = '{PARIS_CREW_CIRCLE_ID}'
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_crew_invitations_receiver_customer_id'), table_name='crew_invitations')
    op.drop_index(op.f('ix_crew_invitations_sender_customer_id'), table_name='crew_invitations')
    op.drop_index(op.f('ix_crew_invitations_space_id'), table_name='crew_invitations')
    op.drop_table('crew_invitations')

    op.drop_index(op.f('ix_community_spaces_crew_destination_key'), table_name='community_spaces')
    op.drop_column('community_spaces', 'crew_end_date')
    op.drop_column('community_spaces', 'crew_start_date')
    op.drop_column('community_spaces', 'crew_destination_key')
