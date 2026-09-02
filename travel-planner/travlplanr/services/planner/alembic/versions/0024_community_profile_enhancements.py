"""Add cover/about/interests columns to community_profiles

Revision ID: 0024_profile_enhancements
Revises: 0023_merge_heads
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0024_profile_enhancements'
down_revision: Union[str, Sequence[str], None] = '0023_merge_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('community_profiles', sa.Column('cover_url', sa.String(length=1024), nullable=True))
    op.add_column('community_profiles', sa.Column('about', sa.String(length=2000), nullable=True))
    op.add_column('community_profiles', sa.Column('interests', postgresql.ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    op.drop_column('community_profiles', 'interests')
    op.drop_column('community_profiles', 'about')
    op.drop_column('community_profiles', 'cover_url')
