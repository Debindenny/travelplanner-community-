"""FAQ 'was this helpful?' feedback.

Revision ID: 0015_faq_feedback
Revises: 0014_newsletter_subscribers
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0015_faq_feedback"
down_revision: Union[str, None] = "0014_newsletter_subscribers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "faq_feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.String(length=100), nullable=False),
        sa.Column("helpful", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["faq_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_faq_feedback_item_id", "faq_feedback", ["item_id"])


def downgrade() -> None:
    op.drop_index("ix_faq_feedback_item_id", table_name="faq_feedback")
    op.drop_table("faq_feedback")
