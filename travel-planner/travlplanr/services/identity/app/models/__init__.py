"""Identity service models — package init.

Re-export every model so that ``from app.models import *`` registers all tables
on ``Base.metadata`` (needed by Alembic autogenerate and create_all alike).
"""
from .users import User, UserKind, UserStatus
from .customer_profiles import CustomerProfile, CustomerType
from .staff import StaffProfile, StaffRole
from .plans import Plan, Subscription, PlanCode
from .customer_assignments import CustomerAssignment, AssignmentRole
from .notification_settings import NotificationSetting

__all__ = [
    "User",
    "UserKind",
    "UserStatus",
    "CustomerProfile",
    "CustomerType",
    "StaffProfile",
    "StaffRole",
    "Plan",
    "Subscription",
    "PlanCode",
    "CustomerAssignment",
    "AssignmentRole",
    "NotificationSetting",
]
