import uuid
from typing import Any, Annotated
from fastapi import Depends, HTTPException, Request, status
from shared.auth_dependencies import require_customer
from app.models.trips import Trip
from app.models.collaboration import TripCollaborator
from sqlalchemy import select

ROLE_ORDER = {"owner": 3, "editor": 2, "viewer": 1}

async def get_trip_collaborator_and_role(
    db,
    trip_id: uuid.UUID,
    customer_id: uuid.UUID
) -> tuple[TripCollaborator | None, str | None]:
    """
    Helper to resolve the collaborator row and the user's role,
    correctly handling the trust-on-owner fallback and avoiding bypasses.
    """
    # 1. Look up collaborator row (regardless of status first, to prevent owner bypass if suspended/invited)
    stmt = select(TripCollaborator).where(
        TripCollaborator.trip_id == trip_id,
        TripCollaborator.user_id == customer_id
    )
    result = await db.execute(stmt)
    collaborator = result.scalar_one_or_none()

    if collaborator:
        if collaborator.status != "active":
            # Explicitly inactive, suspended, or invited - deny access
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Collaborator status is {collaborator.status}"
            )
        return collaborator, collaborator.role

    # 2. If no collaborator row exists, check if user is the trip owner
    trip_stmt = select(Trip).where(Trip.id == trip_id)
    trip_result = await db.execute(trip_stmt)
    trip = trip_result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found"
        )

    if trip.customer_id == customer_id:
        # Pre-migration fallback: implicitly treat owner as active collaborator
        return None, "owner"

    return None, None

def require_trip_role_model(min_role: str):
    """FastAPI dependency for collaboration.py returning a TripCollaborator model object."""
    async def dependency(
        trip_id: str,
        request: Request,
        auth: dict = Depends(require_customer)
    ) -> TripCollaborator:
        try:
            trip_uuid = uuid.UUID(trip_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid trip ID format"
            )
        customer_id = uuid.UUID(auth["customer_id"])
        
        async with request.app.state.session_factory() as db:
            collab, role = await get_trip_collaborator_and_role(db, trip_uuid, customer_id)
            
            if not role or ROLE_ORDER.get(role, 0) < ROLE_ORDER.get(min_role, 0):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{min_role}' or higher required; you have '{role or 'no role'}'"
                )
                
            if not collab:
                # If they are owner (pre-migration), construct transient collaborator object
                collab = TripCollaborator(
                    trip_id=trip_uuid,
                    user_id=customer_id,
                    email=auth.get("email", ""),
                    role="owner",
                    status="active",
                    invited_by=customer_id
                )
            return collab
            
    return dependency

def require_trip_role(allowed_roles: list[str]):
    """FastAPI dependency for trips.py returning the JWT auth payload dictionary with trip_role."""
    async def dependency(
        trip_id: uuid.UUID,
        request: Request,
        payload: Annotated[dict[str, Any], Depends(require_customer)]
    ) -> dict[str, Any]:
        customer_id = uuid.UUID(payload["customer_id"])
        
        async with request.app.state.session_factory() as db:
            _, role = await get_trip_collaborator_and_role(db, trip_id, customer_id)
            
            if not role or role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Require one of roles: {', '.join(allowed_roles)}"
                )
                
            payload["trip_role"] = role
            return payload
            
    return dependency
