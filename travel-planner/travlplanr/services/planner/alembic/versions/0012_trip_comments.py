"""Per-segment trip comments.

Revision ID: 0012_trip_comments
Revises: 0011_trip_versions
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012_trip_comments"
down_revision: Union[str, None] = "0011_trip_versions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trip_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("segment_id", sa.String(length=120), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("author_name", sa.String(length=255), nullable=False, server_default="Unknown"),
        sa.Column("body", sa.String(length=2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trip_comments_trip_id", "trip_comments", ["trip_id"])
    op.create_index("ix_trip_comments_segment_id", "trip_comments", ["segment_id"])


def downgrade() -> None:
    op.drop_index("ix_trip_comments_segment_id", table_name="trip_comments")
    op.drop_index("ix_trip_comments_trip_id", table_name="trip_comments")
    op.drop_table("trip_comments")
