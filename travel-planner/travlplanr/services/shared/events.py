"""
Shared domain event envelope and catalog for Travlplanr services.

Every service emits domain events to Redis Streams with this envelope.
The reporting consumer is the ONLY writer of audit_events, dashboard_metric_daily,
trip_status_counts, staff_customer_counts, and notifications.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class EventType(StrEnum):
    """Canonical event type catalog."""

    # Identity
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_STATUS_CHANGED = "customer.status_changed"
    CUSTOMER_DELETED = "customer.deleted"
    STAFF_CREATED = "staff.created"
    STAFF_UPDATED = "staff.updated"
    STAFF_STATUS_CHANGED = "staff.status_changed"
    STAFF_DELETED = "staff.deleted"

    # Planner
    TRIP_CREATED = "trip.created"
    TRIP_UPDATED = "trip.updated"
    TRIP_EDITED = "trip.edited"
    TRIP_STATUS_CHANGED = "trip.status_changed"
    TRIP_DELETED = "trip.deleted"
    COLLABORATOR_INVITED = "collaborator.invited"
    EXPENSE_ADDED = "expense.added"

    # Affiliate
    TRIP_BOOKED = "trip.booked"
    TRIP_CANCELLED = "trip.cancelled"
    BOOKING_REFUNDED = "booking.refunded"

    # AI Worker
    GENERATION_REQUESTED = "generation.requested"
    GENERATION_STARTED = "generation.started"
    GENERATION_PROGRESS = "generation.progress"
    GENERATION_COMPLETED = "generation.completed"
    GENERATION_FAILED = "generation.failed"

    # Plan
    PLAN_USED = "plan.used"


class DomainEvent(BaseModel):
    """
    Domain event envelope — the wire format on Redis Streams.

    Every service emits events with this shape. Handling is at-least-once
    and idempotent (dedupe on event_id).
    """

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Idempotency key — consumers dedupe on this.",
    )
    event_type: EventType
    occurred_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of when the event occurred.",
    )
    actor_user_id: str | None = Field(
        default=None,
        description="The user who triggered this event (from JWT).",
    )
    subject_id: str = Field(
        description="Primary entity ID this event is about.",
    )
    tenant_id: str = Field(
        description="Travel-partner tenant isolation.",
    )
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Event-type-specific data.",
    )


# Redis Stream keys per service
STREAM_IDENTITY = "events:identity"
STREAM_PLANNER = "events:planner"
STREAM_AFFILIATE = "events:affiliate"
STREAM_AI_WORKER = "events:ai-worker"

# Consumer group for reporting
CONSUMER_GROUP_REPORTING = "reporting-consumer"

# Consumer group for planner
CONSUMER_GROUP_PLANNER = "planner-consumer"

# Default tenant for single-tenant dev
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"
