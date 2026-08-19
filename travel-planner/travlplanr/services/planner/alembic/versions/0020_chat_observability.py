"""Add cost/latency observability columns to chat_interactions.

Revision ID: 0020_chat_observability
Revises: 0019_chat_sessions
Create Date: 2026-07-09

Adds latency_ms, prompt_tokens, completion_tokens to chat_interactions so
the admin dashboard can surface provider performance metrics (T3.3).
All columns are nullable so existing rows are unaffected.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0020_chat_observability"
down_revision: Union[str, None] = "0019_chat_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_interactions",
        sa.Column("latency_ms", sa.Integer(), nullable=True),
    )
    op.add_column(
        "chat_interactions",
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
    )
    op.add_column(
        "chat_interactions",
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
    )
    # Partial index to keep latency queries fast on the non-null subset.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_interactions_latency_ms "
        "ON chat_interactions (latency_ms) WHERE latency_ms IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chat_interactions_latency_ms")
    op.drop_column("chat_interactions", "completion_tokens")
    op.drop_column("chat_interactions", "prompt_tokens")
    op.drop_column("chat_interactions", "latency_ms")
