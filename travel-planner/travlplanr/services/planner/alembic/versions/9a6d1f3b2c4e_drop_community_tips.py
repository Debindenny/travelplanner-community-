"""drop community_tips table

Revision ID: 9a6d1f3b2c4e
Revises: 47fb33ce2885
Create Date: 2026-09-04 00:00:00.000000

Discover/Saved were migrated off this hand-seeded table onto community_posts
(see 47fb33ce2885). Nothing reads or writes community_tips anymore, so it is
dropped here along with the now-dead CommunityTip model.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9a6d1f3b2c4e'
down_revision: Union[str, None] = '47fb33ce2885'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('community_tips')


def downgrade() -> None:
    op.create_table(
        'community_tips',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag', sa.String(length=20), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('place', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('used_label', sa.String(length=50), nullable=False),
        sa.Column('blurb', sa.String(length=1000), nullable=False),
        sa.Column('author_name', sa.String(length=255), nullable=False),
        sa.Column('author_line', sa.String(length=255), nullable=False),
        sa.Column('body', sa.String(length=4000), nullable=False),
        sa.Column('facts', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('points', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('image', sa.String(length=1024), nullable=False),
        sa.Column('use_count', sa.Integer(), nullable=False),
        sa.Column('save_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_community_tips_category'), 'community_tips', ['category'], unique=False)
    op.create_index(op.f('ix_community_tips_place'), 'community_tips', ['place'], unique=False)
    op.create_index(op.f('ix_community_tips_use_count'), 'community_tips', ['use_count'], unique=False)
    op.create_index(op.f('ix_community_tips_save_count'), 'community_tips', ['save_count'], unique=False)
    op.create_index(op.f('ix_community_tips_created_at'), 'community_tips', ['created_at'], unique=False)
