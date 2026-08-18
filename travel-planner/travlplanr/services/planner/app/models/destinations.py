"""
Destination model — E11
"""

import uuid
from sqlalchemy import String, Integer, ARRAY, Uuid, Float
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

import sys
from pathlib import Path
from shared.database import Base

class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str | None] = mapped_column(String)
    image_url: Mapped[str] = mapped_column(String)
    base_price: Mapped[int] = mapped_column(Integer)
    region: Mapped[str] = mapped_column(String, index=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Semantic search — embeds "name, region, country, tags, description" so
    # free-text queries (e.g. "quiet beach town") can match beyond substring/ILIKE hits.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)

    def to_dict(self, been_there_count: int = 0):
        # Canonical stored amount is INR; routers convert via shared.fx before response.
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description or "",
            "image": self.image_url,
            "price": float(self.base_price),
            "currency": "INR",
            "region": self.region,
            "tags": self.tags,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "been_there_count": been_there_count
        }
