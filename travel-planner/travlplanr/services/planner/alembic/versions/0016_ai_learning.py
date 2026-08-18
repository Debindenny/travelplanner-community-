"""AI learning flywheel tables.

Revision ID: 0016_ai_learning
Revises: 0015_faq_feedback
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0016_ai_learning"
down_revision: Union[str, None] = "0015_faq_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_interactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("trip_id", sa.Uuid(), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("user_message", sa.Text(), nullable=False),
        sa.Column("assistant_reply", sa.Text(), nullable=False),
        sa.Column("page_path", sa.String(length=512), nullable=True),
        sa.Column("region", sa.String(length=120), nullable=True),
        sa.Column("active_day", sa.Integer(), nullable=True),
        sa.Column("regex_intent", sa.String(length=64), nullable=True),
        sa.Column("final_intent", sa.String(length=64), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("parsed_edits", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("actions_emitted", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("llm_hints", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("llm_edit_used", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("shadow_llm_edits", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("explicit_feedback", sa.String(length=8), nullable=True),
        sa.Column("feedback_note", sa.Text(), nullable=True),
        sa.Column("outcome_status", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_interactions_customer_id", "chat_interactions", ["customer_id"])
    op.create_index("ix_chat_interactions_trip_id", "chat_interactions", ["trip_id"])
    op.create_index("ix_chat_interactions_created_at", "chat_interactions", ["created_at"])

    op.create_table(
        "activity_outcomes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("trip_id", sa.Uuid(), nullable=True),
        sa.Column("interaction_id", sa.Uuid(), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("activity_title", sa.String(length=255), nullable=False),
        sa.Column("budget_tier", sa.String(length=32), server_default="standard", nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), server_default="chat", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["interaction_id"], ["chat_interactions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_activity_outcomes_city", "activity_outcomes", ["city"])
    op.create_index("ix_activity_outcomes_created_at", "activity_outcomes", ["created_at"])

    op.create_table(
        "activity_acceptance_stats",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("city_normalized", sa.String(length=120), nullable=False),
        sa.Column("title_normalized", sa.String(length=255), nullable=False),
        sa.Column("budget_tier", sa.String(length=32), server_default="standard", nullable=False),
        sa.Column("times_suggested", sa.Integer(), server_default="0", nullable=False),
        sa.Column("times_kept", sa.Integer(), server_default="0", nullable=False),
        sa.Column("times_removed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("times_swapped", sa.Integer(), server_default="0", nullable=False),
        sa.Column("times_booked", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("city_normalized", "title_normalized", "budget_tier", name="uq_activity_acceptance"),
    )
    op.create_index("ix_activity_acceptance_stats_city", "activity_acceptance_stats", ["city_normalized"])

    op.create_table(
        "customer_travel_profiles",
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("preferred_pace", sa.String(length=32), nullable=True),
        sa.Column("typical_budget_tier", sa.String(length=32), nullable=True),
        sa.Column("interests", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("avoided_types", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("kept_activities_by_city", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("customer_id"),
    )

    op.create_table(
        "prompt_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("system_prompt_hash", sa.String(length=64), nullable=False),
        sa.Column("active", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("thumbs_up", sa.Integer(), server_default="0", nullable=False),
        sa.Column("thumbs_down", sa.Integer(), server_default="0", nullable=False),
        sa.Column("interaction_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("prompt_versions")
    op.drop_table("customer_travel_profiles")
    op.drop_index("ix_activity_acceptance_stats_city", table_name="activity_acceptance_stats")
    op.drop_table("activity_acceptance_stats")
    op.drop_index("ix_activity_outcomes_created_at", table_name="activity_outcomes")
    op.drop_index("ix_activity_outcomes_city", table_name="activity_outcomes")
    op.drop_table("activity_outcomes")
    op.drop_index("ix_chat_interactions_created_at", table_name="chat_interactions")
    op.drop_index("ix_chat_interactions_trip_id", table_name="chat_interactions")
    op.drop_index("ix_chat_interactions_customer_id", table_name="chat_interactions")
    op.drop_table("chat_interactions")
