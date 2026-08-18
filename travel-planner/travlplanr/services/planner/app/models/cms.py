import uuid
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List

from shared.database import Base


class BlogPost(Base):
    __tablename__ = "blog_posts"
    __table_args__ = (UniqueConstraint("slug", "locale", name="uq_blog_posts_slug_locale"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    # ISO 639-1 code (e.g. "en", "es", "fr"); a slug may have one row per locale.
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    published_at: Mapped[str] = mapped_column(String(50), nullable=False) # E.g., 'Oct 15, 2024'
    read_time: Mapped[str] = mapped_column(String(50), nullable=False) # E.g., '5 min read'
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    category_label: Mapped[str] = mapped_column(String(100), nullable=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Advanced Blog Features
    status: Mapped[str] = mapped_column(String(50), default="published") # 'draft' or 'published'
    tags: Mapped[str] = mapped_column(Text, default="[]") # Stored as JSON string
    meta_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_keywords: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "slug": self.slug,
            "locale": self.locale,
            "excerpt": self.excerpt,
            "content": self.content,
            "image": self.image_url,
            "author": self.author,
            "publishedAt": self.published_at,
            "readTime": self.read_time,
            "category": self.category,
            "categoryLabel": self.category_label,
            "featured": self.featured,
            "status": self.status,
            "tags": self.tags,
            "metaTitle": self.meta_title,
            "metaDescription": self.meta_description,
            "targetKeywords": self.target_keywords,
        }

from datetime import datetime

class BlogPostRevision(Base):
    __tablename__ = "blog_post_revisions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    blog_post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "blog_post_id": str(self.blog_post_id),
            "title": self.title,
            "content": self.content,
            "excerpt": self.excerpt,
            "created_at": self.created_at.isoformat()
        }


class FaqSection(Base):
    __tablename__ = "faq_sections"

    id: Mapped[str] = mapped_column(String(100), primary_key=True) # E.g., 'general'
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    # ISO 639-1 code; see the module docstring-level note on BlogPost.locale —
    # `id` remains the primary key, so only one row per id exists today (all
    # seeded as "en"). Per-locale variants need a follow-up composite-key
    # migration; this column just makes the API's locale/fallback contract
    # queryable now.
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    items: Mapped[List["FaqItem"]] = relationship("FaqItem", back_populates="section", cascade="all, delete-orphan", order_by="FaqItem.order")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "locale": self.locale,
            "items": [item.to_dict() for item in self.items]
        }


class FaqItem(Base):
    __tablename__ = "faq_items"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    section_id: Mapped[str] = mapped_column(ForeignKey("faq_sections.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    section: Mapped["FaqSection"] = relationship("FaqSection", back_populates="items")

    def to_dict(self):
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer
        }
