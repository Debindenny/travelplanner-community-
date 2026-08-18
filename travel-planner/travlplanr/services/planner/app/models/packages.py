"""
Package model — static tour packages linked to an itinerary
"""

import uuid
from sqlalchemy import String, Integer, Float, Uuid
from sqlalchemy.orm import Mapped, mapped_column

import sys
from pathlib import Path
from shared.database import Base

class Package(Base):
    __tablename__ = "packages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, index=True)
    theme: Mapped[str] = mapped_column(String)
    price: Mapped[int] = mapped_column(Integer)
    days: Mapped[int] = mapped_column(Integer)
    group_type: Mapped[str] = mapped_column(String)
    image_url: Mapped[str] = mapped_column(String)
    region: Mapped[str] = mapped_column(String, index=True)
    country: Mapped[str] = mapped_column(String, index=True)
    budget_tier: Mapped[str] = mapped_column(String)
    rating: Mapped[float] = mapped_column(Float)
    itinerary_id: Mapped[str | None] = mapped_column(String)

    def to_dict(self):
        # Canonical stored amount is INR; routers convert via shared.fx before response.
        return {
            "id": str(self.id),
            "title": self.title,
            "theme": self.theme,
            "price": float(self.price),
            "currency": "INR",
            "days": f"{self.days} Days",
            "group": self.group_type,
            "image": self.image_url,
            "region": self.region,
            "country": self.country,
            "budget": self.budget_tier,
            "rating": self.rating,
            "itineraryId": self.itinerary_id,
        }
