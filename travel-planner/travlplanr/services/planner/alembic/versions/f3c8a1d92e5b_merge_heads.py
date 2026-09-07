"""merge heads (0031_message_requests, drop community_tips)

Revision ID: f3c8a1d92e5b
Revises: 0031_message_requests, 9a6d1f3b2c4e
Create Date: 2026-09-07 00:00:00.000000

Reconciles two migrations that both branched off 0030_seed_paris_crew
independently (message requests feature vs. dropping community_tips) —
no schema changes of its own.
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'f3c8a1d92e5b'
down_revision: Union[str, Sequence[str], None] = ('0031_message_requests', '9a6d1f3b2c4e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
