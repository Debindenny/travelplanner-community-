"""Community Enhancements: reactions, hashtags, coords, badges

Revision ID: 0005_community_enhancements
Revises: 0af0d6233ca9
Create Date: 2026-06-24 13:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0005_community_enhancements'
down_revision: Union[str, None] = '0af0d6233ca9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add coordinates to destinations table
    op.add_column('destinations', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('destinations', sa.Column('longitude', sa.Float(), nullable=True))

    # 2. Add badge, name, avatar fields to community_profiles table
    op.add_column('community_profiles', sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('community_profiles', sa.Column('countries_visited', sa.Integer(), server_default='0', nullable=False))
    op.add_column('community_profiles', sa.Column('local_in', sa.String(length=255), nullable=True))
    op.add_column('community_profiles', sa.Column('name', sa.String(length=255), nullable=True))
    op.add_column('community_profiles', sa.Column('avatar_url', sa.String(length=1024), nullable=True))

    # 3. Add itinerary_id to community_posts
    op.add_column('community_posts', sa.Column('itinerary_id', sa.UUID(), nullable=True))

    # 4. Create post_reactions table
    op.create_table('post_reactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('post_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('reaction_type', sa.String(length=50), server_default='like', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id', 'customer_id')
    )
    op.create_index(op.f('ix_post_reactions_post_id'), 'post_reactions', ['post_id'], unique=False)
    op.create_index(op.f('ix_post_reactions_customer_id'), 'post_reactions', ['customer_id'], unique=False)

    # 5. Create hashtags table
    op.create_table('hashtags',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tag', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tag')
    )
    op.create_index(op.f('ix_hashtags_tag'), 'hashtags', ['tag'], unique=True)

    # 6. Create post_hashtags table
    op.create_table('post_hashtags',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('post_id', sa.UUID(), nullable=False),
        sa.Column('hashtag_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['hashtag_id'], ['hashtags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_post_hashtags_post_id'), 'post_hashtags', ['post_id'], unique=False)
    op.create_index(op.f('ix_post_hashtags_hashtag_id'), 'post_hashtags', ['hashtag_id'], unique=False)

    # 7. Create hashtag_follows table
    op.create_table('hashtag_follows',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('hashtag_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['hashtag_id'], ['hashtags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('customer_id', 'hashtag_id')
    )
    op.create_index(op.f('ix_hashtag_follows_customer_id'), 'hashtag_follows', ['customer_id'], unique=False)
    op.create_index(op.f('ix_hashtag_follows_hashtag_id'), 'hashtag_follows', ['hashtag_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_hashtag_follows_hashtag_id'), table_name='hashtag_follows')
    op.drop_index(op.f('ix_hashtag_follows_customer_id'), table_name='hashtag_follows')
    op.drop_table('hashtag_follows')

    op.drop_index(op.f('ix_post_hashtags_hashtag_id'), table_name='post_hashtags')
    op.drop_index(op.f('ix_post_hashtags_post_id'), table_name='post_hashtags')
    op.drop_table('post_hashtags')

    op.drop_index(op.f('ix_hashtags_tag'), table_name='hashtags')
    op.drop_table('hashtags')

    op.drop_index(op.f('ix_post_reactions_customer_id'), table_name='post_reactions')
    op.drop_index(op.f('ix_post_reactions_post_id'), table_name='post_reactions')
    op.drop_table('post_reactions')

    op.drop_column('community_posts', 'itinerary_id')

    op.drop_column('community_profiles', 'avatar_url')
    op.drop_column('community_profiles', 'name')
    op.drop_column('community_profiles', 'local_in')
    op.drop_column('community_profiles', 'countries_visited')
    op.drop_column('community_profiles', 'is_verified')

    op.drop_column('destinations', 'longitude')
    op.drop_column('destinations', 'latitude')
