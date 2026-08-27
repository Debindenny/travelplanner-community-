from __future__ import annotations
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Column, UniqueConstraint, Index, Float, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.database import Base


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    author_name: Mapped[str] = mapped_column(String(255))
    author_avatar: Mapped[str] = mapped_column(String(1024), nullable=True)
    
    location: Mapped[str] = mapped_column(String(255), nullable=True)
    destination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id"), nullable=True)
    destination = relationship("Destination")
    author = relationship("CommunityProfile", primaryjoin="foreign(CommunityPost.customer_id) == CommunityProfile.customer_id")
    images: Mapped[list[str]] = mapped_column(JSONB, default=list)
    caption: Mapped[str] = mapped_column(String(2000), nullable=True)
    
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    itinerary_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    is_reel: Mapped[bool] = mapped_column(Boolean, default=False)
    video_url: Mapped[str] = mapped_column(String(2048), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_community_posts_created_at", "created_at"),
        Index("ix_community_posts_likes_count", "likes_count"),
    )


class PostComment(Base):
    __tablename__ = "post_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    author_name: Mapped[str] = mapped_column(String(255))
    author_avatar: Mapped[str] = mapped_column(String(1024), nullable=True)

    content: Mapped[str] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_post_comments_created_at", "created_at"),
    )

class UserFollow(Base):
    __tablename__ = "user_follows"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    following_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (UniqueConstraint('follower_id', 'following_id'),)

class Story(Base):
    __tablename__ = "stories"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    author_name: Mapped[str] = mapped_column(String(255))
    author_avatar: Mapped[str] = mapped_column(String(1024), nullable=True)
    media_url: Mapped[str] = mapped_column(String(2048))
    caption: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    __table_args__ = (
        Index("ix_stories_expires_at", "expires_at"),
    )

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(50))  # e.g., "like", "comment", "follow", "message"
    message: Mapped[str] = mapped_column(String(500))
    link_url: Mapped[str] = mapped_column(String(1024), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_notifications_customer_id_is_read", "customer_id", "is_read"),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    likes: Mapped[bool] = mapped_column(Boolean, default=True)
    comments: Mapped[bool] = mapped_column(Boolean, default=True)
    follows: Mapped[bool] = mapped_column(Boolean, default=True)
    messages: Mapped[bool] = mapped_column(Boolean, default=True)
    weekly_digest: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant1_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    participant2_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Establish relationship to messages
    messages = relationship("DirectMessage", back_populates="conversation", cascade="all, delete-orphan")

class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id"), index=True)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    content: Mapped[str] = mapped_column(String(2000))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("ix_direct_messages_created_at", "created_at"),
    )

class CommunityProfile(Base):
    __tablename__ = "community_profiles"
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    bio: Mapped[str] = mapped_column(String(500), nullable=True, default="Explorer • Discovering the world one step at a time")
    profile_views: Mapped[int] = mapped_column(Integer, default=0)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    countries_visited: Mapped[int] = mapped_column(Integer, default=0)
    local_in: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CommunityShortcut(Base):
    __tablename__ = "community_shortcuts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=True) # if null, it's a global default shortcut
    title: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1024), nullable=True)
    icon_type: Mapped[str] = mapped_column(String(50), default="hashtag")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CommunityNews(Base):
    __tablename__ = "community_news"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    readers: Mapped[int] = mapped_column(Integer, default=0)
    timeframe: Mapped[str] = mapped_column(String(50), default="Top news")
    bullet_color: Mapped[str] = mapped_column(String(50), default="bg-blue-500")
    link: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CommunityAd(Base):
    __tablename__ = "community_ads"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_name: Mapped[str] = mapped_column(String(255))
    tagline: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(String(500))
    button_text: Mapped[str] = mapped_column(String(100))
    sponsor_avatar: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    click_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CommunityCollection(Base):
    __tablename__ = "community_collections"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(1000), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    # One collection per customer is flagged as their implicit "Saved" list — created
    # lazily on first save so we don't need a signup-time provisioning step.
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # Partial unique index — allows any number of non-default collections per
        # customer, but at most one flagged is_default=true (a plain UniqueConstraint
        # on (customer_id, is_default) would also block multiple non-default ones).
        Index(
            "uq_one_default_collection_per_customer", "customer_id",
            unique=True, postgresql_where=text("is_default = true"),
        ),
    )

class CommunityCollectionItem(Base):
    __tablename__ = "community_collection_items"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("community_collections.id", ondelete="CASCADE"), index=True)
    item_type: Mapped[str] = mapped_column(String(50)) # 'post', 'destination', 'itinerary', 'tip'
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("collection_id", "item_type", "item_id", name="uq_collection_item_once"),
    )


class CommunityTip(Base):
    """Curated Discover content — travel tips/routes/reels/food/budget highlights.

    Distinct from CommunityPost: these are editorial cards (facts grid, "why
    travelers use it" points, author bio line) seeded/managed separately from
    organic user posts, which don't carry that shape.
    """
    __tablename__ = "community_tips"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tag: Mapped[str] = mapped_column(String(20))  # 'TIP' | 'ROUTE' | 'REEL' | 'FOOD' | 'BUDGET'
    category: Mapped[str] = mapped_column(String(50), index=True)  # 'Tips' | 'Routes' | 'Reels' | 'Food' | 'Budget'
    place: Mapped[str] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(500))
    used_label: Mapped[str] = mapped_column(String(50))  # display text, e.g. "1.2K used" / "840 saves"
    blurb: Mapped[str] = mapped_column(String(1000))
    author_name: Mapped[str] = mapped_column(String(255))
    author_line: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(String(4000))
    facts: Mapped[list[dict]] = mapped_column(JSONB, default=list)  # [{"label": str, "value": str}]
    points: Mapped[list[str]] = mapped_column(JSONB, default=list)
    image: Mapped[str] = mapped_column(String(1024))
    use_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    save_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PostReaction(Base):
    __tablename__ = "post_reactions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    reaction_type: Mapped[str] = mapped_column(String(50), default="like")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("post_id", "customer_id"),)

class Hashtag(Base):
    __tablename__ = "hashtags"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tag: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class PostHashtag(Base):
    __tablename__ = "post_hashtags"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), index=True)
    hashtag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hashtags.id", ondelete="CASCADE"), index=True)

class HashtagFollow(Base):
    __tablename__ = "hashtag_follows"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    hashtag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hashtags.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("customer_id", "hashtag_id"),)

class CommunityEvent(Base):
    __tablename__ = "community_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    event: Mapped[str] = mapped_column(String(100), index=True)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "community_reports"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    target_type: Mapped[str] = mapped_column(String(50))  # 'post', 'comment', 'story', 'user', 'message'
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    reason: Mapped[str] = mapped_column(String(100))
    details: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open, reviewed, dismissed, actioned
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Block(Base):
    __tablename__ = "community_blocks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    blocked_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id"),)


class GamificationProfile(Base):
    __tablename__ = "gamification_profiles"
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class XpEvent(Base):
    __tablename__ = "xp_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class UserBadge(Base):
    __tablename__ = "user_badges"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    badge_key: Mapped[str] = mapped_column(String(100))
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("customer_id", "badge_key"),)


class ChallengeProgress(Base):
    __tablename__ = "challenge_progress"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    challenge_key: Mapped[str] = mapped_column(String(100))
    progress: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    period_start: Mapped[datetime] = mapped_column(DateTime)

    __table_args__ = (UniqueConstraint("customer_id", "challenge_key", "period_start"),)


class CommunityMeetup(Base):
    __tablename__ = "community_meetups"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost: Mapped[str | None] = mapped_column(String(50), nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    schedule: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [{"time": str, "text": str}]
    what_to_bring: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 'meetup' | 'food' | 'online'
    meeting_link: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    


class MeetupRsvp(Base):
    __tablename__ = "meetup_rsvps"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meetup_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("community_meetups.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    status: Mapped[str] = mapped_column(String(20), default="going")  # going, interested, declined
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("meetup_id", "customer_id"),)


class Journal(Base):
    __tablename__ = "community_journals"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(String(20000), nullable=True)
    itinerary_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CommunitySpace(Base):
    __tablename__ = "community_spaces"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SpaceMember(Base):
    __tablename__ = "community_space_members"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("community_spaces.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")  # member, admin
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("space_id", "customer_id"),)
