import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from shared.database import Base

class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    target_type: Mapped[str] = mapped_column(String) # 'destination' or 'package'
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    customer_name: Mapped[str] = mapped_column(String)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Pending") # Pending, Approved, Rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "target_type": self.target_type,
            "target_id": str(self.target_id),
            "customer_name": self.customer_name,
            "rating": self.rating,
            "comment": self.comment,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
