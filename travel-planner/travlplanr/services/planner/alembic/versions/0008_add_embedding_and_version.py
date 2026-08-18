"""Add embedding vector and version column to trips

Revision ID: 0008_add_embedding_and_version
Revises: b49a70afebf0
Create Date: 2026-07-01 00:00:00.000000

Adds two columns that are declared in the Trip ORM model but were never
included in any migration, causing the planner service's GET /api/v1/trips
endpoint to return HTTP 500:

  * embedding  — pgvector vector(384) for RAG-based trip similarity search.
                 Requires the pgvector extension to be enabled first.
  * version    — Integer for optimistic concurrency control (OCC).
                 The PUT /trips/{id} router increments this on every save
                 and rejects stale writes that supply a mismatched version.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0008_add_embedding_and_version'
down_revision: Union[str, None] = '0007_blog_post_cms_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension (idempotent — safe if already installed).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add the embedding column using raw DDL so we don't need to import
    # pgvector here; the ORM model's Vector(384) mapping handles queries.
    # Using execute so the type string "vector(384)" is passed verbatim.
    op.execute(
        "ALTER TABLE trips ADD COLUMN IF NOT EXISTS embedding vector(384)"
    )

    # Add the version counter for OCC.  Default 0 for all existing rows.
    op.add_column(
        'trips',
        sa.Column(
            'version',
            sa.Integer(),
            nullable=False,
            server_default='0',
        ),
    )


def downgrade() -> None:
    op.drop_column('trips', 'version')
    op.execute("ALTER TABLE trips DROP COLUMN IF EXISTS embedding")
    # We intentionally do NOT drop the vector extension on downgrade because
    # other tables/columns may depend on it.
