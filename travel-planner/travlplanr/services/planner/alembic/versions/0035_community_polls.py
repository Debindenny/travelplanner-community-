"""Add real poll storage and voting for community posts

Revision ID: 0035_community_polls
Revises: 0034_trip_templates
Create Date: 2026-09-08 00:00:00.000000

The community feed's Poll composer already lets a user type a question and
options, and `<app-community-poll>` already renders vote bars/percentages —
but neither side was ever backed by real storage: `community_posts` has no
`type` column (so the feed can't tell a poll apart from a normal post) and
there was no options/votes table, so every "poll" post was silently created
as plain caption text with no way to vote on it.

This adds:
  - `community_posts.type` (nullable) so a post can be tagged 'poll'.
  - `community_polls` (one row per poll, 1:1 with its post).
  - `community_poll_options` (the ordered choices for a poll).
  - `community_poll_votes` (one row per customer per poll — the unique
    constraint is what makes voting idempotent/switchable instead of
    stacking duplicate votes).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0035_community_polls'
down_revision: Union[str, Sequence[str], None] = '0034_trip_templates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('community_posts', sa.Column('type', sa.String(length=20), nullable=True))

    op.create_table(
        'community_polls',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id'),
    )
    op.create_index(op.f('ix_community_polls_post_id'), 'community_polls', ['post_id'], unique=True)

    op.create_table(
        'community_poll_options',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('poll_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('text', sa.String(length=200), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['poll_id'], ['community_polls.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_community_poll_options_poll_id'), 'community_poll_options', ['poll_id'], unique=False)

    op.create_table(
        'community_poll_votes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('poll_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('option_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['poll_id'], ['community_polls.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['option_id'], ['community_poll_options.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('poll_id', 'customer_id', name='uq_community_poll_votes_poll_customer'),
    )
    op.create_index(op.f('ix_community_poll_votes_poll_id'), 'community_poll_votes', ['poll_id'], unique=False)
    op.create_index(op.f('ix_community_poll_votes_option_id'), 'community_poll_votes', ['option_id'], unique=False)
    op.create_index(op.f('ix_community_poll_votes_customer_id'), 'community_poll_votes', ['customer_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_community_poll_votes_customer_id'), table_name='community_poll_votes')
    op.drop_index(op.f('ix_community_poll_votes_option_id'), table_name='community_poll_votes')
    op.drop_index(op.f('ix_community_poll_votes_poll_id'), table_name='community_poll_votes')
    op.drop_table('community_poll_votes')

    op.drop_index(op.f('ix_community_poll_options_poll_id'), table_name='community_poll_options')
    op.drop_table('community_poll_options')

    op.drop_index(op.f('ix_community_polls_post_id'), table_name='community_polls')
    op.drop_table('community_polls')

    op.drop_column('community_posts', 'type')
