"""add discover tip fields to community_posts

Revision ID: 47fb33ce2885
Revises: 0030_seed_paris_crew
Create Date: 2026-09-04 06:22:22.668913

Note: autogenerate also picked up a large amount of unrelated pre-existing
drift between the models and the live schema (dropped tables, unrelated
index/constraint changes on trips/chat/etc.). None of that is part of this
change, so it was stripped out — this migration touches community_posts only.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '47fb33ce2885'
down_revision: Union[str, None] = '0030_seed_paris_crew'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('community_posts', sa.Column('title', sa.String(length=500), nullable=True))
    op.add_column('community_posts', sa.Column('tag', sa.String(length=20), nullable=True))
    op.add_column('community_posts', sa.Column('category', sa.String(length=50), nullable=True))
    op.add_column('community_posts', sa.Column('author_line', sa.String(length=255), nullable=True))
    op.add_column('community_posts', sa.Column('body', sa.String(length=4000), nullable=True))
    op.add_column('community_posts', sa.Column('used_label', sa.String(length=50), nullable=True))
    op.add_column('community_posts', sa.Column('facts', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('community_posts', sa.Column('points', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('community_posts', sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('community_posts', sa.Column('save_count', sa.Integer(), nullable=False, server_default='0'))
    op.create_index(op.f('ix_community_posts_category'), 'community_posts', ['category'], unique=False)
    op.create_index(op.f('ix_community_posts_title'), 'community_posts', ['title'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_community_posts_title'), table_name='community_posts')
    op.drop_index(op.f('ix_community_posts_category'), table_name='community_posts')
    op.drop_column('community_posts', 'save_count')
    op.drop_column('community_posts', 'use_count')
    op.drop_column('community_posts', 'points')
    op.drop_column('community_posts', 'facts')
    op.drop_column('community_posts', 'used_label')
    op.drop_column('community_posts', 'body')
    op.drop_column('community_posts', 'author_line')
    op.drop_column('community_posts', 'category')
    op.drop_column('community_posts', 'tag')
    op.drop_column('community_posts', 'title')
