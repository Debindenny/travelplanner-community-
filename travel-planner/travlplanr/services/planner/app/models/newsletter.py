import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from shared.database import Base


class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    consent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    subscribed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "email": self.email,
            "consent": self.consent,
            "subscribed_at": self.subscribed_at.isoformat() if self.subscribed_at else None,
        }
