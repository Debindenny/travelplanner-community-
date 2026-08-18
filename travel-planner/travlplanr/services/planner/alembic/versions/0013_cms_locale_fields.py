"""Locale fields on CMS content (blog posts, FAQ sections/items) for
locale-aware content delivery. Existing rows default to 'en'.

Blog posts also get a composite (slug, locale) uniqueness constraint,
replacing the old slug-only uniqueness, so the same slug can carry a
translated variant per locale.

Revision ID: 0013_cms_locale_fields
Revises: 0012_trip_comments
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013_cms_locale_fields"
down_revision: Union[str, None] = "0012_trip_comments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slug_unique_constraint_name(bind) -> str | None:
    inspector = sa.inspect(bind)
    for uc in inspector.get_unique_constraints("blog_posts"):
        if uc["column_names"] == ["slug"]:
            return uc["name"]
    return None


def upgrade() -> None:
    op.add_column(
        "blog_posts", sa.Column("locale", sa.String(length=10), nullable=False, server_default="en")
    )
    existing_name = _slug_unique_constraint_name(op.get_bind())
    if existing_name:
        op.drop_constraint(existing_name, "blog_posts", type_="unique")
    op.create_unique_constraint("uq_blog_posts_slug_locale", "blog_posts", ["slug", "locale"])

    op.add_column(
        "faq_sections", sa.Column("locale", sa.String(length=10), nullable=False, server_default="en")
    )
    op.add_column(
        "faq_items", sa.Column("locale", sa.String(length=10), nullable=False, server_default="en")
    )


def downgrade() -> None:
    op.drop_column("faq_items", "locale")
    op.drop_column("faq_sections", "locale")

    op.drop_constraint("uq_blog_posts_slug_locale", "blog_posts", type_="unique")
    op.create_unique_constraint("blog_posts_slug_key", "blog_posts", ["slug"])
    op.drop_column("blog_posts", "locale")
