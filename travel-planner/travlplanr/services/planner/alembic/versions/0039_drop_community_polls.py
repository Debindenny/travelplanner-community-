"""Drop the community post Poll feature (and the composer's Question type stays a
plain post — it never had backend storage of its own to remove)

Revision ID: 0039_drop_community_polls
Revises: 0038_story_engagement
Create Date: 2026-09-09 00:00:00.000000

Poll and Question were removed from the community feed composer entirely — Poll
had real storage (added in 0035_community_polls) but no reachable path in the app
ever created one (the composer button was already hidden, and the older modal's
poll option routed into a generic form that never actually sent poll data), so
this is a clean removal with no user data at stake. This drops the 3 poll tables
this feature added. It intentionally leaves `community_posts.type` in place —
that column is still used by the separate, pre-existing Q&A thread feature
(`type = 'qa'`), which was not part of this removal.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0039_drop_community_polls'
down_revision: Union[str, Sequence[str], None] = '0038_story_engagement'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f('ix_community_poll_votes_customer_id'), table_name='community_poll_votes')
    op.drop_index(op.f('ix_community_poll_votes_option_id'), table_name='community_poll_votes')
    op.drop_index(op.f('ix_community_poll_votes_poll_id'), table_name='community_poll_votes')
    op.drop_table('community_poll_votes')

    op.drop_index(op.f('ix_community_poll_options_poll_id'), table_name='community_poll_options')
    op.drop_table('community_poll_options')

    op.drop_index(op.f('ix_community_polls_post_id'), table_name='community_polls')
    op.drop_table('community_polls')


def downgrade() -> None:
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
