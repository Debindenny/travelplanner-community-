"""Merge heads: 0035_template_seg_images and 47fb33ce2885 (discover tip fields).

These two migrations were authored independently on top of
0030_seed_paris_crew, leaving alembic with two divergent heads. Both are
real, already-applied migrations, so this is a genuine merge point rather
than a no-op collapse.

Revision ID: 0036_merge_heads
Revises: 0035_template_seg_images, 47fb33ce2885
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '0036_merge_heads'
down_revision: Union[str, Sequence[str], None] = ('0035_template_seg_images', '47fb33ce2885')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
