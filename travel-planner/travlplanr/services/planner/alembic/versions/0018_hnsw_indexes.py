"""Add HNSW indexes on Destination.embedding and Trip.embedding for fast ANN search.

Revision ID: 0018_hnsw_indexes
Revises: 0017_add_destination_embedding
Create Date: 2026-07-09

Switches semantic search from a full table scan (exact L2/cosine) to the
HNSW approximate-nearest-neighbour index provided by pgvector, which gives
sub-linear query time at the cost of a small recall loss — acceptable for
destination / trip RAG where top-5 is all we need.

Also adds a cosine_ops index variant on destinations (used by the search
endpoint) and an l2_ops index on trips (historically used for trip-similarity
RAG), so both orderings can use index-accelerated search.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0018_hnsw_indexes"
down_revision: Union[str, None] = "0017_add_destination_embedding"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction block; alembic
    # wraps migrations in a transaction by default, so this must opt out.
    with op.get_context().autocommit_block():
        # destinations — cosine distance used by search endpoint
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_destinations_embedding_hnsw
            ON destinations
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
            """
        )

        # trips — cosine distance used by activity-suggestion RAG (T2.3)
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_trips_embedding_hnsw
            ON trips
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
            """
        )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_destinations_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_trips_embedding_hnsw")
