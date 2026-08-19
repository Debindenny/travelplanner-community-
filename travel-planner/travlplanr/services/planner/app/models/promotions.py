import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from shared.database import Base

class Promotion(Base):
    __tablename__ = "promotions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    discount_type: Mapped[str] = mapped_column(String) # 'percentage' or 'flat'
    discount_value: Mapped[int] = mapped_column(Integer)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "code": self.code,
            "discount_type": self.discount_type,
            "discount_value": self.discount_value,
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "is_active": self.is_active
        }
