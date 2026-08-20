"""Add community_tips table and default-collection support for Saved

Revision ID: 0022_community_discover_saved
Revises: 0021_community_enhancements
Create Date: 2026-08-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0022_community_discover_saved'
down_revision: Union[str, None] = '0021_community_enhancements'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('community_collections', sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index(
        'uq_one_default_collection_per_customer', 'community_collections', ['customer_id'],
        unique=True, postgresql_where=sa.text('is_default = true'),
    )

    op.create_unique_constraint(
        'uq_collection_item_once', 'community_collection_items', ['collection_id', 'item_type', 'item_id'],
    )

    op.create_table(
        'community_tips',
        sa.Column('id', sa.UUID(), nullable=False),
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


def downgrade() -> None:
    op.drop_index(op.f('ix_community_tips_created_at'), table_name='community_tips')
    op.drop_index(op.f('ix_community_tips_save_count'), table_name='community_tips')
    op.drop_index(op.f('ix_community_tips_use_count'), table_name='community_tips')
    op.drop_index(op.f('ix_community_tips_place'), table_name='community_tips')
    op.drop_index(op.f('ix_community_tips_category'), table_name='community_tips')
    op.drop_table('community_tips')

    op.drop_constraint('uq_collection_item_once', 'community_collection_items', type_='unique')

    op.drop_index('uq_one_default_collection_per_customer', table_name='community_collections')
    op.drop_column('community_collections', 'is_default')
