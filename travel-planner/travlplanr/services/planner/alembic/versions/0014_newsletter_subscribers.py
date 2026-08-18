"""Newsletter subscribers table.

Revision ID: 0014_newsletter_subscribers
Revises: 0013_cms_locale_fields
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014_newsletter_subscribers"
down_revision: Union[str, None] = "0013_cms_locale_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "newsletter_subscribers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("consent", sa.Boolean(), nullable=False),
        sa.Column("subscribed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_newsletter_subscribers_email"),
    )


def downgrade() -> None:
    op.drop_table("newsletter_subscribers")
