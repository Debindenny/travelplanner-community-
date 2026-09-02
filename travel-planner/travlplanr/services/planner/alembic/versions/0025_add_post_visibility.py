"""Add post_visibility column to community_profiles

Revision ID: 0025_add_post_visibility
Revises: 0024_profile_enhancements
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0025_add_post_visibility'
down_revision: Union[str, Sequence[str], None] = '0024_profile_enhancements'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('community_profiles', sa.Column('post_visibility', sa.String(length=20), nullable=False, server_default='everyone'))


def downgrade() -> None:
    op.drop_column('community_profiles', 'post_visibility')