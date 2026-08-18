"""add FAILED value to trip_status_enum

Lets a trip leave GENERATING into a terminal FAILED state when AI generation
fails (see ai-worker GENERATION_FAILED handling). Enum labels are the TripStatus
member *names*, so we add 'FAILED'.

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a transaction.
    op.execute("ALTER TYPE trip_status_enum ADD VALUE IF NOT EXISTS 'FAILED'")


def downgrade() -> None:
    # PostgreSQL cannot drop an enum value directly; downgrade is intentionally a no-op.
    pass
