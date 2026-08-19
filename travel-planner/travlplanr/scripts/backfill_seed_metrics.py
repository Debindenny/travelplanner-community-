import asyncio
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine_id = create_async_engine("postgresql+asyncpg://travlplanr:travlplanr@localhost:5434/identity_db")
    engine_plan = create_async_engine("postgresql+asyncpg://travlplanr:travlplanr@localhost:5434/planner_db")
    engine_rep = create_async_engine("postgresql+asyncpg://travlplanr:travlplanr@localhost:5434/reporting_db")
    
    # 1. Fetch Identity counts
    async with engine_id.connect() as conn:
        staff_res = await conn.execute(text("SELECT COUNT(*) FROM staff"))
        staff_count = staff_res.scalar()
        
        cust_res = await conn.execute(text("SELECT COUNT(*) FROM customer_profiles"))
        cust_count = cust_res.scalar()
        
        # In Identity, customer_type serves as the segment in the profiles.
        seg_res = await conn.execute(text("SELECT customer_type, COUNT(*) FROM customer_profiles WHERE customer_type IS NOT NULL GROUP BY customer_type"))
        segments = seg_res.fetchall()
        
    # 2. Fetch Planner counts
    async with engine_plan.connect() as conn:
        itin_res = await conn.execute(text("SELECT COUNT(*) FROM trips"))
        total_itin = itin_res.scalar()
        
        # Get Trip Status counts grouped by customer and destination
        trip_res = await conn.execute(text("""
            SELECT customer_id, destination, status, COUNT(*)
            FROM trips
            GROUP BY customer_id, destination, status
        """))
        trips = trip_res.fetchall()
        
    # 3. Upsert to Reporting DB
    today = datetime.now(timezone.utc).date()
    # Assume tenant ID from one of the customers or a default
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000000")
    
    async with engine_id.connect() as conn:
        cust = await conn.execute(text("SELECT tenant_id FROM customer_profiles LIMIT 1"))
        row = cust.first()
        if row:
            tenant_id = row[0]
            
    async with engine_rep.begin() as conn:
        # Clear existing
        await conn.execute(text("DELETE FROM dashboard_metric_daily"))
        await conn.execute(text("DELETE FROM customer_segment_counts"))
        await conn.execute(text("DELETE FROM trip_status_counts"))
        
        # Insert staff
        await conn.execute(text("""
            INSERT INTO dashboard_metric_daily (id, tenant_id, metric_date, metric_key, value)
            VALUES (gen_random_uuid(), :tenant, :date, 'staff_total', :val)
        """), {"tenant": tenant_id, "date": today, "val": staff_count})
        
        # Insert customers
        await conn.execute(text("""
            INSERT INTO dashboard_metric_daily (id, tenant_id, metric_date, metric_key, value)
            VALUES (gen_random_uuid(), :tenant, :date, 'customers_total', :val)
        """), {"tenant": tenant_id, "date": today, "val": cust_count})
        
        # Insert itineraries
        await conn.execute(text("""
            INSERT INTO dashboard_metric_daily (id, tenant_id, metric_date, metric_key, value)
            VALUES (gen_random_uuid(), :tenant, :date, 'total_itineraries', :val)
        """), {"tenant": tenant_id, "date": today, "val": total_itin})
        
        # Insert segments
        for seg, count in segments:
            await conn.execute(text("""
                INSERT INTO customer_segment_counts (id, tenant_id, segment, count)
                VALUES (gen_random_uuid(), :tenant, :seg, :count)
            """), {"tenant": tenant_id, "seg": seg, "count": count})
            
        # Group trip statuses
        grouped = {}
        for c_id, dest, status, count in trips:
            key = (c_id, dest)
            if key not in grouped:
                grouped[key] = {"created": 0, "pending": 0, "booked": 0, "cancelled": 0}
            if status in grouped[key]:
                grouped[key][status] = count
                
        for (c_id, dest), counts in grouped.items():
            await conn.execute(text("""
                INSERT INTO trip_status_counts (id, tenant_id, customer_id, destination, count_created, count_pending, count_booked, count_cancelled)
                VALUES (gen_random_uuid(), :tenant, :c_id, :dest, :created, :pending, :booked, :cancelled)
            """), {
                "tenant": tenant_id,
                "c_id": c_id,
                "dest": dest,
                "created": counts["created"],
                "pending": counts["pending"],
                "booked": counts["booked"],
                "cancelled": counts["cancelled"]
            })
            
    print("Backfill completed successfully.")
    
if __name__ == "__main__":
    asyncio.run(main())
