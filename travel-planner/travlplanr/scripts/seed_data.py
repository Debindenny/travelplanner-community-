import asyncio
import sys
import uuid
import os
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from passlib.hash import argon2

# Adjust imports to access models through apps
from services.identity.app.models.users import User, UserKind, UserStatus
from services.identity.app.models.customer_profiles import CustomerProfile, CustomerType
from services.identity.app.models.staff import StaffProfile, StaffRole
from services.planner.app.models.trips import Trip, TripStatus

from scripts.sample_trip_segments import build_sample_segments, build_day_rows

from services.shared.events import (
    DomainEvent, EventType, STREAM_IDENTITY, STREAM_PLANNER, DEFAULT_TENANT_ID
)
from services.shared.redis_client import create_redis_client, emit_event
from services.shared.database import Base

IDENTITY_DB_URL = "postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/identity_db"
PLANNER_DB_URL = "postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_db"
REDIS_URL = "redis://localhost:6379/0"

def random_date(start: datetime, end: datetime) -> datetime:
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

async def main():
    print("Seeding database...")
    force = os.getenv("SEED_FORCE", "").lower() in ("1", "true", "yes")
    
    identity_engine = create_async_engine(IDENTITY_DB_URL)
    identity_session_factory = async_sessionmaker(identity_engine)

    planner_engine = create_async_engine(PLANNER_DB_URL)
    planner_session_factory = async_sessionmaker(planner_engine)
    
    redis = await create_redis_client(REDIS_URL)

    tenant_id = uuid.UUID(DEFAULT_TENANT_ID)
    password_hash = argon2.hash("password123")
    
    now = datetime.now(timezone.utc)
    one_year_ago = now - timedelta(days=365)
    
    # 1. Identity Data
    async with identity_session_factory() as id_session:
        # Check if already seeded
        res = await id_session.execute(select(func.count()).select_from(User))
        if not force and res.scalar() > 5:
            print("Already seeded. Use SEED_FORCE=true or seed_all.py --force to re-seed.")
            return

        # Create staff
        admin_user = User(
            email="admin@travlplanr.com",
            password_hash=password_hash,
            user_kind=UserKind.STAFF,
            status=UserStatus.ACTIVE,
            tenant_id=tenant_id
        )
        id_session.add(admin_user)
        await id_session.flush()
        
        admin_staff = StaffProfile(
            user_id=admin_user.id,
            display_code="TPE000001",
            name="Alice Admin",
            role=StaffRole.ADMIN,
            tenant_id=tenant_id
        )
        id_session.add(admin_staff)
        
        # Create customers
        customer_types = [CustomerType.COUPLE, CustomerType.SOLO, CustomerType.FAMILY, CustomerType.FRIENDS]
        customers = []
        for i in range(1, 101):
            join_date = random_date(one_year_ago, now)
            c_user = User(
                email=f"customer{i}@example.com",
                password_hash=password_hash,
                user_kind=UserKind.CUSTOMER,
                status=UserStatus.ACTIVE,
                tenant_id=tenant_id,
                created_at=join_date
            )
            id_session.add(c_user)
            await id_session.flush()
            
            c_profile = CustomerProfile(
                user_id=c_user.id,
                display_code=f"CUS{i:06d}",
                name=f"Customer {i}",
                phone=f"+1555000{i:03d}",
                customer_type=random.choice(customer_types),
                tenant_id=tenant_id,
                date_joined=join_date
            )
            id_session.add(c_profile)
            customers.append((c_user, c_profile))
            
            await emit_event(redis, STREAM_IDENTITY, DomainEvent(
                event_type=EventType.CUSTOMER_CREATED,
                subject_id=str(c_profile.id),
                tenant_id=str(tenant_id),
                occurred_at=join_date,
                payload={"name": c_profile.name, "customer_type": c_profile.customer_type.value if c_profile.customer_type else None}
            ))

        await id_session.commit()
        print("Inserted 100 customers and 1 admin.")

    # 2. Planner Data
    destinations = ["Paris", "Tokyo", "Bali", "New York", "Rome", "London", "Dubai", "Sydney", "Barcelona", "Maldives", "Brussels", "Amsterdam"]
    destination_images = {
        "Paris": "assets/images/packages/paris_madrid.png",
        "Tokyo": "assets/images/landing/japan.jpg",
        "Bali": "assets/images/landing/thailand.jpg",
        "Brussels": "assets/images/landing/figma/belgium.jpg",
        "Barcelona": "assets/images/packages/paris_madrid.png",
        "London": "assets/images/landing/figma/london.jpg",
        "Rome": "assets/images/packages/rome_capitals.png",
        "Dubai": "assets/images/landing/iconic-uae.jpg",
    }
    async with planner_session_factory() as pl_session:
        for i, (c_user, c_profile) in enumerate(customers):
            # Each customer gets 1 to 3 trips
            num_trips = random.randint(1, 3)
            for j in range(num_trips):
                created_at = random_date(c_profile.date_joined, now)
                dest = random.choice(destinations)
                
                start_date = (created_at + timedelta(days=random.randint(10, 60))).date().isoformat()
                num_days = random.randint(4, 10)
                end_date = (datetime.fromisoformat(start_date) + timedelta(days=num_days - 1)).date().isoformat()
                
                status = random.choice([
                    TripStatus.READY, TripStatus.READY, TripStatus.BOOKED,
                    TripStatus.PENDING, TripStatus.CREATED, TripStatus.DRAFT,
                ])
                
                image = destination_images.get(dest, "assets/images/landing/journey-thailand.jpg")
                segments = build_sample_segments(dest, num_days=num_days, start=datetime.fromisoformat(start_date))
                days = build_day_rows(dest, num_days, segments)
                
                trip = Trip(
                    tenant_id=tenant_id,
                    customer_id=c_profile.id,
                    customer_name=c_profile.name,
                    display_code=f"ITIN-{random.randint(1000, 9999)}",
                    title=f"{dest} Adventure" if j > 0 else f"{dest} Premium Tour",
                    destination=dest,
                    start_date=start_date,
                    end_date=end_date,
                    travelers=random.randint(1, 4),
                    travel_style=random.choice(["Couple", "Solo", "Family", "Friends"]),
                    travel_method=random.choice(["flight", "train", "mixed"]),
                    budget=random.choice(["Standard", "Premium", "Budget"]),
                    interests=["Sightseeing", "Culture", "Food"],
                    food_preferences=["Local cuisine"],
                    status=status,
                    image=image,
                    days=days,
                    city_days=[{"city": dest, "nights": max(num_days - 1, 1)}],
                    segments=segments,
                    created_at=created_at,
                )
                pl_session.add(trip)
                await pl_session.flush()
                
                # Emit events
                await emit_event(redis, STREAM_PLANNER, DomainEvent(
                    event_type=EventType.TRIP_CREATED,
                    subject_id=str(trip.id),
                    tenant_id=str(tenant_id),
                    occurred_at=created_at,
                    payload={"destination": trip.destination, "status": trip.status.value, "customer_id": str(c_profile.id)}
                ))
                
        await pl_session.commit()
        print("Inserted trips.")

    print("Seeding complete.")

if __name__ == "__main__":
    asyncio.run(main())
