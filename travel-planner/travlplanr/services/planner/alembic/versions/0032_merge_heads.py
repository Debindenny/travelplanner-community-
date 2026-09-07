"""Merge heads: 0031_message_requests and 9a6d1f3b2c4e (drop_community_tips).

These two migrations were authored independently on top of
0030_seed_paris_crew, leaving alembic with two divergent heads. Both are
real, already-applied migrations, so this is a genuine merge point rather
than a no-op collapse.

Revision ID: 0032_merge_heads
Revises: 0031_message_requests, 9a6d1f3b2c4e
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '0032_merge_heads'
down_revision: Union[str, Sequence[str], None] = ('0031_message_requests', '9a6d1f3b2c4e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
