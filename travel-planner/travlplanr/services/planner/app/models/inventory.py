import uuid
from sqlalchemy import String, Integer, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

import sys
from pathlib import Path
from shared.database import Base

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    item_type: Mapped[str] = mapped_column(String, index=True) # e.g. 'flight', 'hotel', 'car', 'train', 'bus', 'activity', 'place'
    provider: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    subtitle: Mapped[str | None] = mapped_column(String)
    price_amount: Mapped[int] = mapped_column(Integer)
    price_currency: Mapped[str] = mapped_column(String, default="USD")
    image_url: Mapped[str | None] = mapped_column(String)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB) # extra fields

    def to_dict(self):
        """Legacy nested shape (customer app compatibility)."""
        return {
            "id": str(self.id),
            "type": self.item_type,
            "provider": self.provider,
            "title": self.title,
            "subtitle": self.subtitle,
            "price": {
                "amount": self.price_amount,
                "currency": self.price_currency,
            },
            "image": self.image_url,
            "metadata": self.metadata_json or {},
        }

    def to_api_dict(self):
        """Flat shape expected by admin inventory and affiliate clients."""
        meta = self.metadata_json or {}
        provider_links = {
            "travelnext": "https://travelnext.works",
            "tripadvisor": "https://www.tripadvisor.com",
            "google_places": "https://www.google.com/maps",
            "google_routes": "https://www.google.com/maps",
            "google": "https://www.google.com/maps",
        }
        base = provider_links.get(self.provider, "https://travlplanr.com")
        return {
            "id": str(self.id),
            "type": self.item_type,
            "provider": self.provider,
            "title": self.title,
            "price": float(self.price_amount),
            "currency": self.price_currency,
            "deep_link": meta.get("deep_link") or f"{base}/search?q={self.title.replace(' ', '+')}",
            "start_time": meta.get("start_time"),
            "end_time": meta.get("end_time"),
            "duration": meta.get("duration") or self.subtitle,
            "image_url": self.image_url,
            "details": meta,
        }
