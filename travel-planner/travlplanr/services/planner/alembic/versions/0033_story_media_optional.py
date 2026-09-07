"""Make stories.media_url nullable to support text-only stories

Revision ID: 0033_story_media_optional
Revises: 0032_merge_heads
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0033_story_media_optional'
down_revision: Union[str, Sequence[str], None] = '0032_merge_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('stories', 'media_url', existing_type=sa.String(length=2048), nullable=True)


def downgrade() -> None:
    op.alter_column('stories', 'media_url', existing_type=sa.String(length=2048), nullable=False)
