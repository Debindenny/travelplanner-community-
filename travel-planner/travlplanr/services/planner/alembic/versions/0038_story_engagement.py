"""Add story engagement (likes + per-viewer view tracking)

Revision ID: 0038_story_engagement
Revises: 0035_community_polls
Create Date: 2026-09-09 00:00:00.000000

Reconstructed: this file was lost from the working tree (never committed) after
already having been applied to the dev database — recreated here to match the
actual schema currently in place (`story_likes` / `story_views`, verified via
`\\d story_likes` / `\\d story_views` against the running Postgres instance) so
alembic's revision history is consistent again and a fresh database ends up
with the same schema. `upgrade()` will not re-run against the dev DB (already
at this revision); it only matters for a clean install or for `downgrade()`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0038_story_engagement'
down_revision: Union[str, Sequence[str], None] = '0035_community_polls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'story_likes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['story_id'], ['stories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('story_id', 'customer_id', name='uq_story_likes_story_customer'),
    )
    op.create_index(op.f('ix_story_likes_story_id'), 'story_likes', ['story_id'], unique=False)
    op.create_index(op.f('ix_story_likes_customer_id'), 'story_likes', ['customer_id'], unique=False)

    op.create_table(
        'story_views',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('viewer_name', sa.String(length=255), nullable=False),
        sa.Column('viewer_avatar', sa.String(length=1024), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['story_id'], ['stories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('story_id', 'customer_id', name='uq_story_views_story_customer'),
    )
    op.create_index(op.f('ix_story_views_story_id'), 'story_views', ['story_id'], unique=False)
    op.create_index(op.f('ix_story_views_customer_id'), 'story_views', ['customer_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_story_views_customer_id'), table_name='story_views')
    op.drop_index(op.f('ix_story_views_story_id'), table_name='story_views')
    op.drop_table('story_views')

    op.drop_index(op.f('ix_story_likes_customer_id'), table_name='story_likes')
    op.drop_index(op.f('ix_story_likes_story_id'), table_name='story_likes')
    op.drop_table('story_likes')
