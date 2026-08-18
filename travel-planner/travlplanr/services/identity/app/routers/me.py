"""
/me endpoints — authenticated user's own profile, preferences, plan usage.
"""

import uuid
from fastapi import APIRouter, Request, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select

from typing import Any

from shared.auth_dependencies import require_customer
from app.models.users import User
from app.models.customer_profiles import CustomerProfile
from app.models.notification_settings import NotificationSetting
from app.models.plans import Subscription

router = APIRouter()


class PlanUsageResponse(BaseModel):
    plan_code: str
    plans_used: int
    plans_limit: int
    percent: float


class UserProfileResponse(BaseModel):
    name: str
    email: str
    phone: str
    countryCode: str
    gender: str
    dateOfBirth: str
    nationality: str
    avatarUrl: str | None = None
    coverUrl: str | None = None


class UserProfileUpdate(BaseModel):
    name: str
    email: str
    phone: str
    countryCode: str
    gender: str
    dateOfBirth: str
    nationality: str


class PreferenceResponse(BaseModel):
    destinations: list[str]
    activities: list[str]
    travelStyle: str
    accommodation: str
    transport: str
    dietary: list[str]
    currency: str


class UpdateMessageResponse(BaseModel):
    message: str


class NotificationSettingItem(BaseModel):
    id: str
    label: str
    description: str
    enabled: bool


class NotificationsResponse(BaseModel):
    items: list[NotificationSettingItem]


class ExportDataResponse(BaseModel):
    user: dict[str, Any]
    profile: dict[str, Any]
    notifications: list[dict[str, Any]]
    subscription: dict[str, Any]


class TravelPreferencesUpdate(BaseModel):
    destinations: list[str]
    activities: list[str]
    travelStyle: str
    accommodation: str
    transport: str
    dietary: list[str]
    currency: str


class NotificationSettingUpdate(BaseModel):
    id: str
    enabled: bool


class NotificationSettingsUpdate(BaseModel):
    settings: list[NotificationSettingUpdate]


@router.get("/plan", response_model=PlanUsageResponse)
async def get_plan_usage(request: Request, auth: dict = Depends(require_customer)):
    """Get the authenticated user's plan usage from their subscription."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        sub = (
            await session.execute(select(Subscription).where(Subscription.user_id == user_id))
        ).scalar_one_or_none()

        if not sub:
            # No subscription yet → default Free tier, no usage.
            return PlanUsageResponse(plan_code="Free", plans_used=0, plans_limit=2, percent=0.0)

        limit = sub.plans_limit or 0
        used = sub.plans_used or 0
        percent = round((used / limit) * 100, 1) if limit else 0.0
        return PlanUsageResponse(
            plan_code=sub.plan_code,
            plans_used=used,
            plans_limit=limit,
            percent=percent,
        )


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(request: Request, auth: dict = Depends(require_customer)):
    """Get authenticated customer's profile."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(
            select(CustomerProfile, User.email).join(User, CustomerProfile.user_id == User.id).where(User.id == user_id)
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

        cp, email = row
        return UserProfileResponse(
            name=cp.name,
            email=email,
            phone=cp.phone or "",
            countryCode=cp.country_code or "+91",
            gender=cp.gender or "",
            dateOfBirth=cp.date_of_birth or "",
            nationality=cp.nationality or "",
            avatarUrl=cp.avatar_url,
            coverUrl=cp.cover_url,
        )


@router.post("/avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...), auth: dict = Depends(require_customer)):
    """Upload customer avatar."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(select(CustomerProfile).where(CustomerProfile.user_id == user_id))
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

        content = await file.read()
        import os
        from app.utils.s3 import upload_file_to_s3
        
        os.makedirs("app/static/uploads", exist_ok=True)
        ext = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
        new_filename = f"avatar_{user_id}.{ext}"
        
        url = await upload_file_to_s3(content, new_filename, content_type=file.content_type or "image/jpeg")
        cp.avatar_url = url
        await session.commit()
        return {"url": url}


@router.post("/cover")
async def upload_cover(request: Request, file: UploadFile = File(...), auth: dict = Depends(require_customer)):
    """Upload customer cover photo."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(select(CustomerProfile).where(CustomerProfile.user_id == user_id))
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

        content = await file.read()
        import os
        from app.utils.s3 import upload_file_to_s3
        
        os.makedirs("app/static/uploads", exist_ok=True)
        ext = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
        new_filename = f"cover_{user_id}.{ext}"
        
        url = await upload_file_to_s3(content, new_filename, content_type=file.content_type or "image/jpeg")
        cp.cover_url = url
        await session.commit()
        return {"url": url}


@router.put("/profile")
async def update_profile(body: UserProfileUpdate, request: Request, auth: dict = Depends(require_customer)):
    """Update authenticated customer's profile."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(select(CustomerProfile).where(CustomerProfile.user_id == user_id))
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

        cp.name = body.name
        cp.phone = body.phone
        cp.country_code = body.countryCode
        cp.gender = body.gender
        cp.date_of_birth = body.dateOfBirth
        cp.nationality = body.nationality
        await session.commit()
        return UpdateMessageResponse(message="Profile updated successfully")


@router.get("/preferences", response_model=PreferenceResponse)
async def get_preferences(request: Request, auth: dict = Depends(require_customer)):
    """Get authenticated customer's travel preferences."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(select(CustomerProfile).where(CustomerProfile.user_id == user_id))
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

        return PreferenceResponse(
            destinations=cp.fav_destinations or [],
            activities=cp.pref_activities or [],
            travelStyle=cp.pref_travel_style or "",
            accommodation=cp.pref_accommodation or "",
            transport=cp.pref_transport or "",
            dietary=cp.pref_dietary or [],
            currency=cp.currency or "INR",
        )


@router.put("/preferences", response_model=UpdateMessageResponse)
async def update_preferences(body: TravelPreferencesUpdate, request: Request, auth: dict = Depends(require_customer)):
    """Update authenticated customer's travel preferences."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(select(CustomerProfile).where(CustomerProfile.user_id == user_id))
        cp = result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
            
        cp.fav_destinations = body.destinations
        cp.pref_activities = body.activities
        cp.pref_travel_style = body.travelStyle
        cp.pref_accommodation = body.accommodation
        cp.pref_transport = body.transport
        cp.pref_dietary = body.dietary
        cp.currency = body.currency
        await session.commit()

        # Emit CUSTOMER_UPDATED event with preferences payload
        from shared.events import DomainEvent, EventType, STREAM_IDENTITY, DEFAULT_TENANT_ID
        from shared.redis_client import emit_event
        event = DomainEvent(
            event_type=EventType.CUSTOMER_UPDATED,
            actor_user_id=auth.get("sub"),
            subject_id=str(cp.id),
            tenant_id=auth.get("tenant_id") or DEFAULT_TENANT_ID,
            payload={
                "preferences_updated": True,
                "destinations": cp.fav_destinations or [],
                "activities": cp.pref_activities or [],
                "travelStyle": cp.pref_travel_style or "",
                "accommodation": cp.pref_accommodation or "",
                "transport": cp.pref_transport or "",
                "dietary": cp.pref_dietary or [],
                "currency": cp.currency or "INR",
            },
        )
        try:
            import logging
            logger = logging.getLogger(__name__)
            await emit_event(request.app.state.redis, STREAM_IDENTITY, event)
        except Exception as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to emit CUSTOMER_UPDATED preferences event: {exc}")

        return UpdateMessageResponse(message="Preferences updated successfully")


@router.get("/notifications", response_model=NotificationsResponse)
async def get_notification_settings(request: Request, auth: dict = Depends(require_customer)):
    """Get authenticated customer's notification settings."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(
            select(NotificationSetting).where(NotificationSetting.user_id == user_id)
        )
        settings = result.scalars().all()

        # default settings if none exist
        if not settings:
            default_items = NotificationsResponse(
                items=[
                    NotificationSettingItem(id="trip", label="Trip reminders", description="Get notified before your upcoming trips.", enabled=True),
                    NotificationSettingItem(id="deals", label="Travel deals", description="Personalized offers based on your preferences.", enabled=True),
                    NotificationSettingItem(id="product", label="Product updates", description="News about new Travlplanr features.", enabled=False),
                ]
            )
            return NotificationsResponse(items=default_items.items)

        items = []
        for s in settings:
            items.append(NotificationSettingItem(
                id=s.key,
                label="Trip reminders" if s.key == "trip" else "Travel deals" if s.key == "deals" else "Product updates",
                description="Get notified before your upcoming trips." if s.key == "trip" else "Personalized offers based on your preferences." if s.key == "deals" else "News about new Travlplanr features.",
                enabled=s.enabled
            ))
        return NotificationsResponse(items=items)


@router.put("/notifications", response_model=UpdateMessageResponse)
async def update_notification_settings(body: NotificationSettingsUpdate, request: Request, auth: dict = Depends(require_customer)):
    """Update authenticated customer's notification settings."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])
        result = await session.execute(
            select(NotificationSetting).where(NotificationSetting.user_id == user_id)
        )
        settings = result.scalars().all()
        settings_by_key = {s.key: s for s in settings}

        for item in body.settings:
            if item.id in settings_by_key:
                settings_by_key[item.id].enabled = item.enabled
            else:
                ns = NotificationSetting(
                    user_id=user_id,
                    key=item.id,
                    enabled=item.enabled
                )
                session.add(ns)

        await session.commit()
        return UpdateMessageResponse(message="Notification settings updated")

@router.get("/export", response_model=ExportDataResponse)
async def export_data(request: Request, auth: dict = Depends(require_customer)):
    """GDPR: Export all user data."""
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])

        # Get User and Profile
        result = await session.execute(
            select(CustomerProfile, User.email)
            .join(User, CustomerProfile.user_id == User.id)
            .where(User.id == user_id)
        )
        row = result.one_or_none()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
        cp, email = row

        # Get Notifications
        n_result = await session.execute(
            select(NotificationSetting).where(NotificationSetting.user_id == user_id)
        )
        notifications = [{"key": n.key, "enabled": n.enabled} for n in n_result.scalars().all()]

        # Get Subscriptions
        s_result = await session.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = s_result.scalar_one_or_none()

        return ExportDataResponse(
            user={
                "email": email,
                "id": str(user_id)
            },
            profile={
                "name": cp.name or "",
                "phone": cp.phone or "",
                "countryCode": cp.country_code or "+91",
                "gender": cp.gender or "",
                "dateOfBirth": cp.date_of_birth or "",
                "nationality": cp.nationality or "",
                "fav_destinations": cp.fav_destinations or [],
                "pref_activities": cp.pref_activities or [],
                "pref_travel_style": cp.pref_travel_style or "",
                "pref_accommodation": cp.pref_accommodation or "",
                "pref_transport": cp.pref_transport or "",
                "pref_dietary": cp.pref_dietary or [],
                "currency": cp.currency or "INR"
            },
            notifications=notifications,
            subscription={
                "plan_code": sub.plan_code if sub else "Free",
                "plans_used": sub.plans_used if sub else 0,
                "plans_limit": sub.plans_limit if sub else 2
            }
        )

@router.delete("/delete", response_model=UpdateMessageResponse)
async def delete_account(request: Request, auth: dict = Depends(require_customer)):
    """GDPR: Delete user account and all associated data."""
    from sqlalchemy import delete
    async with request.app.state.session_factory() as session:
        user_id = uuid.UUID(auth["sub"])

        # Get customer profile ID
        cp_result = await session.execute(
            select(CustomerProfile.id).where(CustomerProfile.user_id == user_id)
        )
        cp_id = cp_result.scalar_one_or_none()
        if cp_id:
            # Delete related customer assignments first to prevent foreign key violation
            from app.models.customer_assignments import CustomerAssignment
            await session.execute(delete(CustomerAssignment).where(CustomerAssignment.customer_id == cp_id))

        # Delete related records
        await session.execute(delete(CustomerProfile).where(CustomerProfile.user_id == user_id))
        await session.execute(delete(NotificationSetting).where(NotificationSetting.user_id == user_id))
        await session.execute(delete(Subscription).where(Subscription.user_id == user_id))

        # Delete user
        await session.execute(delete(User).where(User.id == user_id))

        await session.commit()
        return UpdateMessageResponse(message="Account successfully deleted")


