#!/usr/bin/env python3
"""
Backfill reporting_db read models from identity_db and planner_db.

Uses raw SQL only so it runs inside the planner Docker container without
importing cross-service Python modules.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _db_urls() -> tuple[str, str, str]:
    host = "postgres" if os.getenv("DOCKER", "").lower() in ("1", "true", "yes") else "localhost"
    base = f"postgresql+asyncpg://travlplanr:travlplanr@{host}:5432"
    return (
        f"{base}/identity_db",
        f"{base}/planner_db",
        f"{base}/reporting_db",
    )


async def main() -> None:
    print("Backfilling reporting database from identity and planner databases...")
    identity_url, planner_url, reporting_url = _db_urls()
    today = datetime.now(timezone.utc).date()

    identity_engine = create_async_engine(identity_url)
    planner_engine = create_async_engine(planner_url)
    reporting_engine = create_async_engine(reporting_url)

    id_factory = async_sessionmaker(identity_engine)
    pl_factory = async_sessionmaker(planner_engine)
    rep_factory = async_sessionmaker(reporting_engine)

    async with rep_factory() as rep, id_factory() as id_sess, pl_factory() as pl_sess:
        print("Clearing existing reporting data...")
        await rep.execute(
            text(
                "TRUNCATE dashboard_metric_daily, customer_segment_counts, "
                "trip_status_counts, staff_customer_counts"
            )
        )

        print("Aggregating identity data...")
        total_customers = (
            await id_sess.execute(text("SELECT COUNT(*) FROM customer_profiles"))
        ).scalar() or 0
        total_staff = (
            await id_sess.execute(text("SELECT COUNT(*) FROM staff"))
        ).scalar() or 0

        if total_customers:
            await rep.execute(
                text(
                    "INSERT INTO dashboard_metric_daily (id, tenant_id, metric_date, metric_key, value) "
                    "VALUES (:id, :tenant, :date, :key, :value)"
                ),
                {
                    "id": uuid.uuid4(),
                    "tenant": TENANT_ID,
                    "date": today,
                    "key": "customers_total",
                    "value": total_customers,
                },
            )

        if total_staff:
            await rep.execute(
                text(
                    "INSERT INTO dashboard_metric_daily (id, tenant_id, metric_date, metric_key, value) "
                    "VALUES (:id, :tenant, :date, :key, :value)"
                ),
                {
                    "id": uuid.uuid4(),
                    "tenant": TENANT_ID,
                    "date": today,
                    "key": "staff_total",
                    "value": total_staff,
                },
            )

        segments = (
            await id_sess.execute(
                text(
                    "SELECT customer_type::text, COUNT(*) "
                    "FROM customer_profiles "
                    "WHERE customer_type IS NOT NULL "
                    "GROUP BY customer_type"
                )
            )
        ).all()
        for seg, cnt in segments:
            await rep.execute(
                text(
                    "INSERT INTO customer_segment_counts (id, tenant_id, segment, count) "
                    "VALUES (:id, :tenant, :segment, :count)"
                ),
                {"id": uuid.uuid4(), "tenant": TENANT_ID, "segment": seg, "count": cnt},
            )

        print("Aggregating staff customer counts...")
        staff_rows = (
            await id_sess.execute(text("SELECT id FROM staff"))
        ).all()
        assignment_rows = (
            await id_sess.execute(
                text(
                    "SELECT staff_id, COUNT(customer_id) "
                    "FROM customer_assignments "
                    "GROUP BY staff_id"
                )
            )
        ).all()
        staff_map = {row[0]: 0 for row in staff_rows}
        for staff_id, cnt in assignment_rows:
            staff_map[staff_id] = cnt

        for staff_id, customer_count in staff_map.items():
            cust_ids = [
                row[0]
                for row in (
                    await id_sess.execute(
                        text(
                            "SELECT customer_id FROM customer_assignments WHERE staff_id = :sid"
                        ),
                        {"sid": staff_id},
                    )
                ).all()
            ]
            itin_total = pending = booked = created = 0
            if cust_ids:
                trip_rows = (
                    await pl_sess.execute(
                        text(
                            "SELECT status::text, COUNT(*) FROM trips "
                            "WHERE customer_id = ANY(:cust_ids) GROUP BY status"
                        ),
                        {"cust_ids": cust_ids},
                    )
                ).all()
                for status, count in trip_rows:
                    itin_total += count
                    if status == "PENDING":
                        pending += count
                    elif status == "BOOKED":
                        booked += count
                    elif status in ("CREATED", "DRAFT", "GENERATING"):
                        created += count

            await rep.execute(
                text(
                    "INSERT INTO staff_customer_counts "
                    "(id, tenant_id, staff_id, count_customers, count_itineraries, "
                    "count_pending, count_booked, count_created) "
                    "VALUES (:id, :tenant, :staff_id, :customers, :itineraries, "
                    ":pending, :booked, :created)"
                ),
                {
                    "id": uuid.uuid4(),
                    "tenant": TENANT_ID,
                    "staff_id": staff_id,
                    "customers": customer_count,
                    "itineraries": itin_total,
                    "pending": pending,
                    "booked": booked,
                    "created": created,
                },
            )

        print("Aggregating planner data...")
        total_trips = (await pl_sess.execute(text("SELECT COUNT(*) FROM trips"))).scalar() or 0
        if total_trips:
            for key in ("total_itineraries", "itin_created"):
                await rep.execute(
                    text(
                        "INSERT INTO dashboard_metric_daily (id, tenant_id, metric_date, metric_key, value) "
                        "VALUES (:id, :tenant, :date, :key, :value)"
                    ),
                    {
                        "id": uuid.uuid4(),
                        "tenant": TENANT_ID,
                        "date": today,
                        "key": key,
                        "value": total_trips,
                    },
                )

        trip_stats = (
            await pl_sess.execute(
                text(
                    "SELECT customer_id, destination, status::text, COUNT(*) "
                    "FROM trips GROUP BY customer_id, destination, status"
                )
            )
        ).all()

        tsc_map: dict[tuple, dict[str, int]] = {}
        for cust_id, dest, status, cnt in trip_stats:
            key = (cust_id, dest or "Unknown")
            if key not in tsc_map:
                tsc_map[key] = {"created": 0, "pending": 0, "booked": 0, "cancelled": 0}
            if status in ("CREATED", "DRAFT", "GENERATING"):
                tsc_map[key]["created"] += cnt
            elif status == "PENDING":
                tsc_map[key]["pending"] += cnt
            elif status == "BOOKED":
                tsc_map[key]["booked"] += cnt
            elif status == "CANCELLED":
                tsc_map[key]["cancelled"] += cnt

        for (cust_id, dest), counts in tsc_map.items():
            await rep.execute(
                text(
                    "INSERT INTO trip_status_counts "
                    "(id, tenant_id, customer_id, destination, count_created, count_pending, "
                    "count_booked, count_cancelled) "
                    "VALUES (:id, :tenant, :customer_id, :destination, :created, :pending, "
                    ":booked, :cancelled)"
                ),
                {
                    "id": uuid.uuid4(),
                    "tenant": TENANT_ID,
                    "customer_id": cust_id,
                    "destination": dest,
                    "created": counts["created"],
                    "pending": counts["pending"],
                    "booked": counts["booked"],
                    "cancelled": counts["cancelled"],
                },
            )

        await rep.commit()
        print("Backfill complete!")


if __name__ == "__main__":
    asyncio.run(main())
