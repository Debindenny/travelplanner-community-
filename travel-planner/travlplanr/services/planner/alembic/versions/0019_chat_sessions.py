"""Extend chat_sessions / chat_messages for T2.4 server-side chat memory.

Revision ID: 0019_chat_sessions
Revises: 0018_hnsw_indexes
Create Date: 2026-07-09

chat_sessions and chat_messages tables already exist (from an earlier migration
tied to the voice/community module).  This migration adds only the missing
columns needed for the AI chat session feature:
  - chat_sessions.title        — human-readable label (nullable)
  - chat_messages.interaction_id — FK to chat_interactions for flywheel linkage
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0019_chat_sessions"
down_revision: Union[str, None] = "0018_hnsw_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("title", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "chat_messages",
        sa.Column(
            "interaction_id",
            sa.Uuid(),
            sa.ForeignKey("chat_interactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "interaction_id")
    op.drop_column("chat_sessions", "title")
