"""Community news link/image/content, ads sponsor_avatar/click_url.

Revision ID: 0010_community_news_ads
Revises: 0009_dest_req_coverage
Create Date: 2026-07-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_community_news_ads"
down_revision: Union[str, None] = "0009_dest_req_coverage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # community_news: add link, image_url, content, is_active
    op.add_column("community_news", sa.Column("link", sa.String(2048), nullable=True))
    op.add_column("community_news", sa.Column("image_url", sa.String(2048), nullable=True))
    op.add_column("community_news", sa.Column("content", sa.String(2000), nullable=True))
    op.add_column("community_news", sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False))

    # community_ads: add sponsor_avatar, click_url
    op.add_column("community_ads", sa.Column("sponsor_avatar", sa.String(1024), nullable=True))
    op.add_column("community_ads", sa.Column("click_url", sa.String(2048), nullable=True))

    # community_events: new analytics table
    from sqlalchemy.dialects import postgresql
    op.create_table(
        "community_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("event", sa.String(100), nullable=False, index=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("community_events")
    op.drop_column("community_news", "is_active")
    op.drop_column("community_news", "content")
    op.drop_column("community_news", "image_url")
    op.drop_column("community_news", "link")
    op.drop_column("community_ads", "click_url")
    op.drop_column("community_ads", "sponsor_avatar")
