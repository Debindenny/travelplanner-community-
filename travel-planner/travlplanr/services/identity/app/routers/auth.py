"""
Auth endpoints — admin password login + customer OTP + JWT issuance.
Replaces the admin app's mock onLogin()/onSignup() which just router.navigate(['/dashboard']).
"""

from __future__ import annotations

import asyncio
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt, JWTError
from passlib.hash import argon2
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import User, UserKind, UserStatus
from app.models.staff import StaffProfile, StaffRole
from app.models.customer_profiles import CustomerProfile
from shared.auth_dependencies import get_current_user_token, REVOKED_JWT_PREFIX
from shared.config import DEV_ENVIRONMENTS
from shared.rate_limit import rate_limiter

router = APIRouter()


# --- Schemas ---

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminSignupRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    staff: dict[str, Any]


class OtpRequestBody(BaseModel):
    email: str


class OtpVerifyBody(BaseModel):
    email: str
    code: str


class OtpResponse(BaseModel):
    message: str
    email: str
    dev_otp: str | None = None


class OtpVerifyResponse(BaseModel):
    message: str
    access_token: str
    refresh_token: str | None = None
    email: str

class OAuthVerifyBody(BaseModel):
    id_token: str
    email: str | None = None
    name: str | None = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutResponse(BaseModel):
    message: str


class SeedAdminResponse(BaseModel):
    message: str


# --- Helpers ---

async def _get_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with request.app.state.session_factory() as session:
        yield session


def _create_token(user: User, profile: Any, settings: Any) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "user_kind": user.user_kind.value,
        "tenant_id": str(user.tenant_id),
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
    }
    if profile:
        from app.models.staff import StaffProfile
        if isinstance(profile, StaffProfile):
            payload["role"] = profile.role.value
            payload["staff_id"] = str(profile.id)
            payload["staff_name"] = profile.name
        else:
            payload["customer_id"] = str(profile.id)
            payload["customer_name"] = profile.name
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def _create_refresh_token(user: User, settings: Any) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_refresh_token_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


# --- Admin auth endpoints ---

@router.post(
    "/admin/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limiter("admin-login", 10, 60))],
)
async def admin_login(body: AdminLoginRequest, request: Request):
    """Admin password login — replaces the no-op onLogin() nav."""
    session: AsyncSession
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(User).where(
                User.email == body.email,
                User.user_kind == UserKind.STAFF,
                User.deleted_at.is_(None),
            )
        )
        user = result.scalar_one_or_none()

        if not user or not user.password_hash:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

        if not await asyncio.to_thread(argon2.verify, body.password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

        if user.status != UserStatus.ACTIVE:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive or suspended")

        # Get staff profile
        staff_result = await session.execute(
            select(StaffProfile).where(StaffProfile.user_id == user.id)
        )
        staff = staff_result.scalar_one_or_none()
        if not staff:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Staff profile missing")

        # Update last_login_at
        user.last_login_at = datetime.now(timezone.utc)
        await session.commit()

        token = _create_token(user, staff, request.app.state.settings)
        refresh = _create_refresh_token(user, request.app.state.settings)
        return TokenResponse(
            access_token=token,
            refresh_token=refresh,
            staff={
                "id": str(staff.id),
                "display_code": staff.display_code,
                "name": staff.name,
                "role": staff.role.value,
                "email": user.email,
            },
        )


from shared.auth_dependencies import require_manager

@router.post("/signup", response_model=TokenResponse)
async def admin_signup(body: AdminSignupRequest, request: Request, auth: dict = Depends(require_manager)):
    """Admin signup — creates a staff account with no role-granting claim."""
    import uuid

    from shared.events import DomainEvent, EventType, STREAM_IDENTITY, DEFAULT_TENANT_ID
    from shared.redis_client import emit_event

    async with request.app.state.session_factory() as session:
        from sqlalchemy.exc import IntegrityError
        import secrets

        # Retry loop for display code uniqueness
        for attempt in range(3):
            try:
                # Check email uniqueness (handled by constraint, but we check to avoid burning attempts)
                existing = await session.execute(
                    select(User).where(User.email == body.email)
                )
                if existing.scalar_one_or_none():
                    raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

                tenant_id = uuid.UUID(DEFAULT_TENANT_ID)

                # Create user
                user = User(
                    email=body.email,
                    password_hash=await asyncio.to_thread(argon2.hash, body.password),
                    user_kind=UserKind.STAFF,
                    status=UserStatus.ACTIVE,
                    tenant_id=tenant_id,
                    last_login_at=datetime.now(timezone.utc),
                )
                session.add(user)
                await session.flush()

                # Generate random display code to avoid sequential lock contention/collisions
                random_suffix = "".join(secrets.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(6))
                display_code = f"TPE{random_suffix}"

                staff = StaffProfile(
                    user_id=user.id,
                    display_code=display_code,
                    name=body.name,
                    phone=body.phone,
                    role=StaffRole.STAFF,
                    tenant_id=tenant_id,
                )
                session.add(staff)

                # Emit domain event
                event = DomainEvent(
                    event_type=EventType.STAFF_CREATED,
                    actor_user_id=str(user.id),
                    subject_id=str(staff.id),
                    tenant_id=str(tenant_id),
                    payload={"name": staff.name, "role": staff.role.value, "display_code": display_code},
                )
                await emit_event(request.app.state.redis, STREAM_IDENTITY, event)
                await session.commit()
                break
            except IntegrityError as e:
                await session.rollback()
                if "user_email_key" in str(e) or "ix_users_email" in str(e):
                    raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
                if attempt == 2:
                    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not generate unique display code")
                continue

        token = _create_token(user, staff, request.app.state.settings)
        refresh = _create_refresh_token(user, request.app.state.settings)
        return TokenResponse(
            access_token=token,
            refresh_token=refresh,
            staff={
                "id": str(staff.id),
                "display_code": staff.display_code,
                "name": staff.name,
                "role": staff.role.value,
                "email": user.email,
            },
        )


# --- Customer OTP endpoints (stubs — real OTP provider in P5) ---

@router.post("/otp/request", response_model=OtpResponse, dependencies=[Depends(rate_limiter("otp-request", 5, 300))])
async def otp_request(body: OtpRequestBody, request: Request):
    """Request OTP code — generates a code and stores it in Redis."""
    import secrets
    code = "".join(secrets.choice("0123456789") for _ in range(6))
    
    # Store in Redis with 5-minute TTL
    redis_key = f"otp:{body.email}"
    await request.app.state.redis.set(redis_key, code, ex=300)
    
    # Reset verify attempts for this email on a new request
    attempts_key = f"otp_attempts:{body.email}"
    await request.app.state.redis.delete(attempts_key)
    
    # Use provider for delivery
    from app.notification_service import get_notification_provider, MockProvider
    provider = get_notification_provider()
    await provider.send_otp(body.email, code)

    # Return the code in dev/test environments when no real email provider is configured
    settings = request.app.state.settings
    is_dev = settings.environment.lower() in DEV_ENVIRONMENTS
    dev_otp = code if (is_dev and isinstance(provider, MockProvider)) else None

    return OtpResponse(message="OTP sent", email=body.email, dev_otp=dev_otp)


@router.post("/otp/verify", response_model=OtpVerifyResponse, dependencies=[Depends(rate_limiter("otp-verify", 10, 300))])

async def otp_verify(body: OtpVerifyBody, request: Request):
    """Verify OTP code — issues a real customer JWT."""
    import uuid
    import secrets
    from shared.events import DomainEvent, EventType, STREAM_IDENTITY, DEFAULT_TENANT_ID
    from shared.redis_client import emit_event

    if len(body.code) != 6 or not body.code.isdigit():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid code format")

    attempts_key = f"otp_attempts:{body.email}"
    attempts = await request.app.state.redis.get(attempts_key)
    attempts_count = int(attempts) if attempts else 0
    
    if attempts_count >= 5:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many failed verification attempts. Please request a new code."
        )

    redis_key = f"otp:{body.email}"
    stored_code = await request.app.state.redis.get(redis_key)
    
    if not stored_code:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired verification code")
    
    if not secrets.compare_digest(stored_code, body.code):
        # Increment attempt counter
        await request.app.state.redis.incr(attempts_key)
        if attempts_count == 0:
            await request.app.state.redis.expire(attempts_key, 300)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired verification code")
        
    await request.app.state.redis.delete(redis_key)
    await request.app.state.redis.delete(attempts_key)

    tenant_id = uuid.UUID(DEFAULT_TENANT_ID)

    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(User).where(User.email == body.email, User.user_kind == UserKind.CUSTOMER)
        )
        user = result.scalar_one_or_none()

        if user and (user.status != UserStatus.ACTIVE or user.deleted_at is not None):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive or suspended")

        if not user:
            # Auto-register new customer via OTP
            from sqlalchemy.exc import IntegrityError
            for attempt in range(3):
                try:
                    user = User(
                        email=body.email,
                        user_kind=UserKind.CUSTOMER,
                        status=UserStatus.ACTIVE,
                        tenant_id=tenant_id,
                        last_login_at=datetime.now(timezone.utc),
                    )
                    session.add(user)
                    await session.flush()

                    random_suffix = "".join(secrets.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(6))
                    display_code = f"CUS{random_suffix}"

                    profile = CustomerProfile(
                        user_id=user.id,
                        display_code=display_code,
                        name=body.email.split("@")[0],
                        tenant_id=tenant_id,
                        date_joined=datetime.now(timezone.utc),
                    )
                    session.add(profile)

                    # Emit event
                    event = DomainEvent(
                        event_type=EventType.CUSTOMER_CREATED,
                        subject_id=str(profile.id),
                        tenant_id=str(tenant_id),
                        payload={"name": profile.name, "email": user.email},
                    )
                    await emit_event(request.app.state.redis, STREAM_IDENTITY, event)
                    await session.commit()
                    break
                except IntegrityError as e:
                    await session.rollback()
                    if attempt == 2:
                        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not register user due to conflicts")
                    continue
        else:
            user.last_login_at = datetime.now(timezone.utc)
            profile_result = await session.execute(
                select(CustomerProfile).where(CustomerProfile.user_id == user.id)
            )
            profile = profile_result.scalar_one_or_none()
            await session.commit()

        token = _create_token(user, profile, request.app.state.settings)
        refresh = _create_refresh_token(user, request.app.state.settings)
        return OtpVerifyResponse(message="Verified", access_token=token, refresh_token=refresh, email=user.email)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None

@router.post("/logout", response_model=LogoutResponse)
async def logout(request: Request, body: LogoutRequest = LogoutRequest(), payload: dict = Depends(get_current_user_token)):
    """Revoke the caller's access token (and optionally refresh token) by adding their JTIs to the Redis blocklist."""
    redis_client = getattr(request.app.state, "redis_session", getattr(request.app.state, "redis", None))
    settings = request.app.state.settings
    now = int(datetime.now(timezone.utc).timestamp())

    async def _revoke(token_jti: str, token_exp: int | None) -> None:
        if not redis_client or not token_jti:
            return
        ttl = max(token_exp - now, 1) if token_exp else 60 * 60 * 24 * 7
        await redis_client.set(f"{REVOKED_JWT_PREFIX}{token_jti}", "1", ex=ttl)

    # Always revoke the access token
    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti:
        await _revoke(jti, exp)

    # Also revoke the refresh token if the client sent it (best-effort)
    if body.refresh_token:
        try:
            rt_payload = jwt.decode(body.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            if rt_payload.get("type") == "refresh":
                rt_jti = rt_payload.get("jti")
                rt_exp = rt_payload.get("exp")
                if rt_jti:
                    await _revoke(rt_jti, rt_exp)
        except Exception:
            pass  # Malformed or expired refresh token — ignore, access token is already revoked

    return LogoutResponse(message="Logged out")

class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str

@router.post("/refresh", response_model=RefreshResponse, dependencies=[Depends(rate_limiter("token-refresh", 20, 60))])
async def refresh_token_endpoint(body: RefreshTokenRequest, request: Request):
    """Issue a new access token using a refresh token."""
    settings = request.app.state.settings
    try:
        payload = jwt.decode(body.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")
            
        jti = payload.get("jti")
        redis_client = getattr(request.app.state, "redis_session", getattr(request.app.state, "redis", None))
        # Fail closed, matching shared.auth_dependencies._is_revoked: if we can't
        # consult the blocklist we must not mint a fresh access token, or a logged-out
        # refresh token would keep working for the rest of a Redis outage.
        if not redis_client:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Authentication verification temporarily unavailable",
            )
        if jti:
            try:
                is_revoked = await redis_client.get(f"{REVOKED_JWT_PREFIX}{jti}")
            except Exception as exc:
                raise HTTPException(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "Authentication verification temporarily unavailable",
                ) from exc
            if is_revoked:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token revoked")


        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid payload")
            
        async with request.app.state.session_factory() as session:
            result = await session.execute(select(User).where(User.id == uuid.UUID(user_id)))
            user = result.scalar_one_or_none()
            if not user or user.status != UserStatus.ACTIVE or user.deleted_at:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid user")
                
            profile = None
            if user.user_kind == UserKind.STAFF:
                profile_result = await session.execute(select(StaffProfile).where(StaffProfile.user_id == user.id))
                profile = profile_result.scalar_one_or_none()
            else:
                profile_result = await session.execute(select(CustomerProfile).where(CustomerProfile.user_id == user.id))
                profile = profile_result.scalar_one_or_none()
                
            access = _create_token(user, profile, settings)
            new_refresh = _create_refresh_token(user, settings)
            
            # Optional: Revoke old refresh token (refresh token rotation)
            if redis_client and jti:
                exp = payload.get("exp")
                if exp:
                    now = int(datetime.now(timezone.utc).timestamp())
                    ttl = max(int(exp) - now, 1)
                    await redis_client.set(f"{REVOKED_JWT_PREFIX}{jti}", "1", ex=ttl)
                    
            return RefreshResponse(access_token=access, refresh_token=new_refresh)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")


import os

@router.get("/seed", response_model=SeedAdminResponse, dependencies=[Depends(rate_limiter("auth-seed", 5, 300))])
async def seed_admin(request: Request):
    """Seed initial admin user (dev only)."""
    settings = request.app.state.settings
    if settings.environment.lower() not in DEV_ENVIRONMENTS:
        raise HTTPException(status_code=403, detail="Seeding is disabled outside development")

    if not secrets.compare_digest(request.query_params.get("secret", ""), settings.seed_secret):
        raise HTTPException(status_code=403, detail="Not authorized to seed data")

    seed_password = os.getenv("SEED_ADMIN_PASSWORD")
    if not seed_password:
        if settings.environment.lower() not in DEV_ENVIRONMENTS:
            raise HTTPException(status_code=403, detail="Seeding is disabled outside development")
        seed_password = "password"

    from shared.events import DEFAULT_TENANT_ID

    async with request.app.state.session_factory() as session:
        existing_result = await session.execute(
            select(User).where(User.email == "admin@travlplanr.com")
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            if request.query_params.get("reset") == "true":
                existing.password_hash = await asyncio.to_thread(argon2.hash, seed_password)
                existing.status = UserStatus.ACTIVE
                existing.user_kind = UserKind.STAFF
                await session.commit()
                return SeedAdminResponse(message=f"Admin password reset: admin@travlplanr.com / {seed_password}")
            return SeedAdminResponse(message="Admin already exists (add &reset=true to reset password in dev)")

        tenant_id = uuid.UUID(DEFAULT_TENANT_ID)
        user = User(
            email="admin@travlplanr.com",
            password_hash=await asyncio.to_thread(argon2.hash, seed_password),
            user_kind=UserKind.STAFF,
            status=UserStatus.ACTIVE,
            tenant_id=tenant_id,
            last_login_at=datetime.now(timezone.utc),
        )
        session.add(user)
        await session.flush()

        staff = StaffProfile(
            user_id=user.id,
            display_code="TPE000000",
            name="Super Admin",
            role=StaffRole.ADMIN,
            tenant_id=tenant_id,
        )
        session.add(staff)
        await session.commit()

    return SeedAdminResponse(message=f"Admin user created: admin@travlplanr.com / {seed_password}")


@router.post("/oauth/google", response_model=OtpVerifyResponse)
async def oauth_google_verify(body: OAuthVerifyBody, request: Request):
    """Verify Google OAuth token / credential — issues a customer JWT."""
    import uuid
    import secrets
    import httpx
    from shared.events import DomainEvent, EventType, STREAM_IDENTITY, DEFAULT_TENANT_ID
    from shared.redis_client import emit_event

    if not body.id_token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "id_token is required for OAuth verify")

    # ── Verify id_token with Google ──────────────────────────────────────
    # We use Google's tokeninfo endpoint which validates the token signature,
    # expiry, and audience and returns the verified claims.  The email MUST
    # come from the verified token, never from the request body.
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": body.id_token},
            )
        if resp.status_code != 200:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Google token verification failed",
            )
        google_claims = resp.json()
    except httpx.RequestError:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Could not reach Google token verification service",
        )

    # Derive identity exclusively from the verified token
    email = google_claims.get("email")
    email_verified = google_claims.get("email_verified", "false")
    if not email or str(email_verified).lower() != "true":
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Google token does not contain a verified email address",
        )

    name = body.name or google_claims.get("name") or email.split("@")[0]

    tenant_id = uuid.UUID(DEFAULT_TENANT_ID)

    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(User).where(User.email == email, User.user_kind == UserKind.CUSTOMER)
        )
        user = result.scalar_one_or_none()

        if user and (user.status != UserStatus.ACTIVE or user.deleted_at is not None):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive or suspended")

        if not user:
            # Auto-register new customer via OAuth
            from sqlalchemy.exc import IntegrityError
            for attempt in range(3):
                try:
                    user = User(
                        email=email,
                        user_kind=UserKind.CUSTOMER,
                        status=UserStatus.ACTIVE,
                        tenant_id=tenant_id,
                        last_login_at=datetime.now(timezone.utc),
                    )
                    session.add(user)
                    await session.flush()

                    random_suffix = "".join(secrets.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(6))
                    display_code = f"CUS{random_suffix}"

                    profile = CustomerProfile(
                        user_id=user.id,
                        display_code=display_code,
                        name=name,
                        tenant_id=tenant_id,
                        date_joined=datetime.now(timezone.utc),
                    )
                    session.add(profile)

                    # Emit event
                    event = DomainEvent(
                        event_type=EventType.CUSTOMER_CREATED,
                        subject_id=str(profile.id),
                        tenant_id=str(tenant_id),
                        payload={"name": profile.name, "email": user.email},
                    )
                    await emit_event(request.app.state.redis, STREAM_IDENTITY, event)
                    await session.commit()
                    break
                except IntegrityError as e:
                    await session.rollback()
                    if attempt == 2:
                        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not register user due to conflicts")
                    continue
        else:
            user.last_login_at = datetime.now(timezone.utc)
            profile_result = await session.execute(
                select(CustomerProfile).where(CustomerProfile.user_id == user.id)
            )
            profile = profile_result.scalar_one_or_none()
            await session.commit()

        token = _create_token(user, profile, request.app.state.settings)
        refresh = _create_refresh_token(user, request.app.state.settings)
        return OtpVerifyResponse(message="Verified", access_token=token, refresh_token=refresh, email=user.email)

