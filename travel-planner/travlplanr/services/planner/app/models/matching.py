from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from shared.database import Base

class TravelBuddyProfile(Base):
    """Profile settings specifically for the travel buddy matching system."""
    __tablename__ = "travel_buddy_profiles"
    
    customer_id = Column(String, primary_key=True)
    bio = Column(Text, nullable=True)
    travel_styles = Column(JSON, default=list) # e.g. ["budget", "luxury", "adventure"]
    preferred_destinations = Column(JSON, default=list)
    languages = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to user/customer if needed
    
class TravelBuddyRequest(Base):
    """A request to connect as a travel buddy."""
    __tablename__ = "travel_buddy_requests"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String, index=True)
    receiver_id = Column(String, index=True)
    trip_id = Column(String, nullable=True) # Optional specific trip
    message = Column(Text, nullable=True)
    status = Column(String, default="pending") # pending, accepted, rejected
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
