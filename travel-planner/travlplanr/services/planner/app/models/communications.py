import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as Uuid

from shared.database import Base


class ChatSession(Base):
    """
    Represents a continuous conversation context between a user and the AI assistant.
    """
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    trip_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String, default="active")
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """
    Represents an individual text or voice message within a session.
    """
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    sender: Mapped[str] = mapped_column(String, nullable=False) # 'user' or 'assistant'
    content_type: Mapped[str] = mapped_column(String, nullable=False, default="text") # 'text' or 'audio'
    
    text_content: Mapped[str] = mapped_column(Text, nullable=True) # Text or transcript
    audio_url: Mapped[str] = mapped_column(String, nullable=True) # S3 or public URL if audio
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")
