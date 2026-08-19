from typing import Optional

from pydantic import BaseModel


class InventoryItem(BaseModel):
    id: str
    type: str  # "flight", "hotel", "activity", "train", "bus", "car"
    provider: str
    title: str
    price: float
    currency: str
    deep_link: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: Optional[str] = None
    image_url: Optional[str] = None
    details: Optional[dict] = None
