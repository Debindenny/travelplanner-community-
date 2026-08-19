"""Add blog CMS fields and revisions table.

Revision ID: 0007_blog_post_cms_fields
Revises: b49a70afebf0
Create Date: 2026-06-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_blog_post_cms_fields"
down_revision: Union[str, None] = "b49a70afebf0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "blog_posts",
        sa.Column("status", sa.String(length=50), nullable=False, server_default="published"),
    )
    op.add_column(
        "blog_posts",
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
    )
    op.add_column("blog_posts", sa.Column("meta_title", sa.String(length=255), nullable=True))
    op.add_column("blog_posts", sa.Column("meta_description", sa.Text(), nullable=True))
    op.add_column("blog_posts", sa.Column("target_keywords", sa.String(length=255), nullable=True))

    op.create_table(
        "blog_post_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("blog_post_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["blog_post_id"], ["blog_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("blog_post_revisions")
    op.drop_column("blog_posts", "target_keywords")
    op.drop_column("blog_posts", "meta_description")
    op.drop_column("blog_posts", "meta_title")
    op.drop_column("blog_posts", "tags")
    op.drop_column("blog_posts", "status")
