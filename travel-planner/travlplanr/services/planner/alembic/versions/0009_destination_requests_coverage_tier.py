"""Destination requests table and trip coverage tier.

Revision ID: 0009_dest_req_coverage
Revises: 0008_add_embedding_and_version
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_dest_req_coverage"
down_revision: Union[str, None] = "0008_add_embedding_and_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "trips",
        sa.Column("coverage_tier", sa.String(length=16), nullable=False, server_default="full"),
    )
    op.create_table(
        "destination_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("place_name", sa.String(length=120), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("source_message", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_destination_requests_place_name", "destination_requests", ["place_name"])
    op.create_index("ix_destination_requests_customer_id", "destination_requests", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_destination_requests_customer_id", table_name="destination_requests")
    op.drop_index("ix_destination_requests_place_name", table_name="destination_requests")
    op.drop_table("destination_requests")
    op.drop_column("trips", "coverage_tier")
