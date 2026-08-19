"""Trip version snapshots for itinerary history.

Revision ID: 0011_trip_versions
Revises: 0010_community_news_ads
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011_trip_versions"
down_revision: Union[str, None] = "0010_community_news_ads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trip_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("days", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("city_days", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("segments", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("customizations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", "version_number", name="uq_trip_versions_trip_id_number"),
    )
    op.create_index("ix_trip_versions_trip_id", "trip_versions", ["trip_id"])


def downgrade() -> None:
    op.drop_index("ix_trip_versions_trip_id", table_name="trip_versions")
    op.drop_table("trip_versions")
