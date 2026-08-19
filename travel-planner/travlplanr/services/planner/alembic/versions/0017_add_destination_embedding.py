"""Add embedding vector column to destinations

Revision ID: 0017_add_destination_embedding
Revises: 0016_ai_learning
Create Date: 2026-07-08 00:00:00.000000

Adds a pgvector column so destination search can rank by semantic
similarity in addition to keyword ILIKE matching (see routers/destinations.py).
Mirrors the trips.embedding column added in 0008_add_embedding_and_version.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0017_add_destination_embedding'
down_revision: Union[str, None] = '0016_ai_learning'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute(
        "ALTER TABLE destinations ADD COLUMN IF NOT EXISTS embedding vector(384)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE destinations DROP COLUMN IF EXISTS embedding")
