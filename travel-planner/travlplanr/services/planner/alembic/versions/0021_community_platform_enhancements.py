"""Community platform enhancements: moderation, gamification, meetups, journals, spaces.

Revision ID: 0021_community_enhancements
Revises: 0020_chat_observability
Create Date: 2026-07-09

Adds:
- notifications.actor_id + composite (customer_id, is_read) index
- notification_preferences table
- missing indexes on community_posts, post_comments, stories, direct_messages
- drops the dead post_likes table (superseded by post_reactions)
- new tables: community_reports, community_blocks, gamification_profiles,
  xp_events, user_badges, challenge_progress, community_meetups, meetup_rsvps,
  community_journals, community_spaces, community_space_members
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0021_community_enhancements"
down_revision: Union[str, None] = "0020_chat_observability"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- notifications ---
    op.add_column("notifications", sa.Column("actor_id", sa.UUID(), nullable=True))
    op.create_index("ix_notifications_actor_id", "notifications", ["actor_id"], unique=False)
    op.create_index("ix_notifications_customer_id_is_read", "notifications", ["customer_id", "is_read"], unique=False)

    op.create_table(
        "notification_preferences",
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("likes", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("comments", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("follows", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("messages", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("weekly_digest", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("customer_id"),
    )

    # --- missing indexes ---
    op.create_index("ix_community_posts_created_at", "community_posts", ["created_at"], unique=False)
    op.create_index("ix_community_posts_likes_count", "community_posts", ["likes_count"], unique=False)
    op.create_index("ix_post_comments_created_at", "post_comments", ["created_at"], unique=False)
    op.create_index("ix_stories_expires_at", "stories", ["expires_at"], unique=False)
    op.create_index("ix_direct_messages_created_at", "direct_messages", ["created_at"], unique=False)

    # --- drop dead post_likes table (superseded by post_reactions) ---
    op.drop_table("post_likes")

    # --- moderation ---
    op.create_table(
        "community_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("reporter_id", sa.UUID(), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=100), nullable=False),
        sa.Column("details", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_community_reports_reporter_id", "community_reports", ["reporter_id"], unique=False)
    op.create_index("ix_community_reports_target_id", "community_reports", ["target_id"], unique=False)

    op.create_table(
        "community_blocks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("blocker_id", sa.UUID(), nullable=False),
        sa.Column("blocked_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("blocker_id", "blocked_id"),
    )
    op.create_index("ix_community_blocks_blocker_id", "community_blocks", ["blocker_id"], unique=False)
    op.create_index("ix_community_blocks_blocked_id", "community_blocks", ["blocked_id"], unique=False)

    # --- gamification ---
    op.create_table(
        "gamification_profiles",
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("customer_id"),
    )

    op.create_table(
        "xp_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_xp_events_customer_id", "xp_events", ["customer_id"], unique=False)
    op.create_index("ix_xp_events_created_at", "xp_events", ["created_at"], unique=False)

    op.create_table(
        "user_badges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("badge_key", sa.String(length=100), nullable=False),
        sa.Column("earned_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id", "badge_key"),
    )
    op.create_index("ix_user_badges_customer_id", "user_badges", ["customer_id"], unique=False)

    op.create_table(
        "challenge_progress",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("challenge_key", sa.String(length=100), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id", "challenge_key", "period_start"),
    )
    op.create_index("ix_challenge_progress_customer_id", "challenge_progress", ["customer_id"], unique=False)

    # --- meetups / RSVPs ---
    op.create_table(
        "community_meetups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_community_meetups_customer_id", "community_meetups", ["customer_id"], unique=False)
    op.create_index("ix_community_meetups_starts_at", "community_meetups", ["starts_at"], unique=False)

    op.create_table(
        "meetup_rsvps",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("meetup_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="going"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["meetup_id"], ["community_meetups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meetup_id", "customer_id"),
    )
    op.create_index("ix_meetup_rsvps_meetup_id", "meetup_rsvps", ["meetup_id"], unique=False)
    op.create_index("ix_meetup_rsvps_customer_id", "meetup_rsvps", ["customer_id"], unique=False)

    # --- journals ---
    op.create_table(
        "community_journals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.String(length=20000), nullable=True),
        sa.Column("itinerary_id", sa.UUID(), nullable=True),
        sa.Column("cover_image", sa.String(length=2048), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_community_journals_customer_id", "community_journals", ["customer_id"], unique=False)

    # --- spaces ---
    op.create_table(
        "community_spaces",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("cover_image", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_community_spaces_created_by", "community_spaces", ["created_by"], unique=False)

    op.create_table(
        "community_space_members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("space_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["space_id"], ["community_spaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("space_id", "customer_id"),
    )
    op.create_index("ix_community_space_members_space_id", "community_space_members", ["space_id"], unique=False)
    op.create_index("ix_community_space_members_customer_id", "community_space_members", ["customer_id"], unique=False)


def downgrade() -> None:
    op.drop_table("community_space_members")
    op.drop_table("community_spaces")
    op.drop_table("community_journals")
    op.drop_table("meetup_rsvps")
    op.drop_table("community_meetups")
    op.drop_table("challenge_progress")
    op.drop_table("user_badges")
    op.drop_table("xp_events")
    op.drop_table("gamification_profiles")
    op.drop_table("community_blocks")
    op.drop_table("community_reports")

    op.create_table(
        "post_likes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("post_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["community_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_post_likes_post_id", "post_likes", ["post_id"], unique=False)
    op.create_index("ix_post_likes_customer_id", "post_likes", ["customer_id"], unique=False)

    op.drop_index("ix_direct_messages_created_at", table_name="direct_messages")
    op.drop_index("ix_stories_expires_at", table_name="stories")
    op.drop_index("ix_post_comments_created_at", table_name="post_comments")
    op.drop_index("ix_community_posts_likes_count", table_name="community_posts")
    op.drop_index("ix_community_posts_created_at", table_name="community_posts")

    op.drop_table("notification_preferences")
    op.drop_index("ix_notifications_customer_id_is_read", table_name="notifications")
    op.drop_index("ix_notifications_actor_id", table_name="notifications")
    op.drop_column("notifications", "actor_id")
