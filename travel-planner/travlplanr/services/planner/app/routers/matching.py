from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
import uuid

from app.models.matching import TravelBuddyProfile, TravelBuddyRequest
from shared.auth_dependencies import require_customer

router = APIRouter()

class ProfileUpdate(BaseModel):
    bio: str
    travel_styles: List[str]
    preferred_destinations: List[str]
    languages: List[str]
    is_active: bool

class BuddyRequestCreate(BaseModel):
    receiver_id: str
    trip_id: Optional[str] = None
    message: Optional[str] = None

@router.get("/profile")
async def get_my_profile(request: Request, auth: dict = Depends(require_customer)):
    user_id = auth["customer_id"]
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(TravelBuddyProfile).where(TravelBuddyProfile.customer_id == user_id))
        profile = result.scalar_one_or_none()
        if not profile:
            # Create default
            profile = TravelBuddyProfile(customer_id=user_id)
            session.add(profile)
            await session.commit()
            await session.refresh(profile)
            
        return {
            "customerId": profile.customer_id,
            "bio": profile.bio,
            "travelStyles": profile.travel_styles,
            "preferredDestinations": profile.preferred_destinations,
            "languages": profile.languages,
            "isActive": profile.is_active
        }

@router.put("/profile")
async def update_my_profile(data: ProfileUpdate, request: Request, auth: dict = Depends(require_customer)):
    user_id = auth["customer_id"]
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(TravelBuddyProfile).where(TravelBuddyProfile.customer_id == user_id))
        profile = result.scalar_one_or_none()
        if not profile:
            profile = TravelBuddyProfile(customer_id=user_id)
            session.add(profile)
            
        profile.bio = data.bio
        profile.travel_styles = data.travel_styles
        profile.preferred_destinations = data.preferred_destinations
        profile.languages = data.languages
        profile.is_active = data.is_active
        
        await session.commit()
        return {"status": "success"}

@router.post("/requests")
async def send_buddy_request(data: BuddyRequestCreate, request: Request, auth: dict = Depends(require_customer)):
    sender_id = auth["customer_id"]
    if sender_id == data.receiver_id:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")
        
    async with request.app.state.session_factory() as session:
        # Check if already pending
        existing = await session.execute(
            select(TravelBuddyRequest).where(
                TravelBuddyRequest.sender_id == sender_id,
                TravelBuddyRequest.receiver_id == data.receiver_id,
                TravelBuddyRequest.status == "pending"
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Request already pending")
            
        req = TravelBuddyRequest(
            id=str(uuid.uuid4()),
            sender_id=sender_id,
            receiver_id=data.receiver_id,
            trip_id=data.trip_id,
            message=data.message,
            status="pending"
        )
        session.add(req)
        await session.commit()
        
        # Trigger websocket/notification here (omitted for brevity)
        return {"status": "success", "id": req.id}

@router.get("/requests")
async def get_my_requests(request: Request, auth: dict = Depends(require_customer)):
    user_id = auth["customer_id"]
    async with request.app.state.session_factory() as session:
        # received requests
        result = await session.execute(
            select(TravelBuddyRequest)
            .where(TravelBuddyRequest.receiver_id == user_id)
            .order_by(TravelBuddyRequest.created_at.desc())
        )
        requests = result.scalars().all()
        return [
            {
                "id": r.id,
                "senderId": r.sender_id,
                "tripId": r.trip_id,
                "message": r.message,
                "status": r.status,
                "createdAt": r.created_at.isoformat()
            } for r in requests
        ]

@router.put("/requests/{request_id}/status")
async def update_request_status(request_id: str, status: str, request: Request, auth: dict = Depends(require_customer)):
    user_id = auth["customer_id"]
    if status not in ["accepted", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    async with request.app.state.session_factory() as session:
        result = await session.execute(
            select(TravelBuddyRequest).where(
                TravelBuddyRequest.id == request_id,
                TravelBuddyRequest.receiver_id == user_id
            )
        )
        req = result.scalar_one_or_none()
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
            
        req.status = status
        await session.commit()
        return {"status": "success"}

@router.get("/matches")
async def get_matches(request: Request, auth: dict = Depends(require_customer)):
    # Very basic matching algorithm for demonstration:
    # return active profiles that share at least one preferred destination
    user_id = auth["customer_id"]
    async with request.app.state.session_factory() as session:
        # Get my profile
        my_prof_res = await session.execute(select(TravelBuddyProfile).where(TravelBuddyProfile.customer_id == user_id))
        my_prof = my_prof_res.scalar_one_or_none()
        if not my_prof or not my_prof.preferred_destinations:
            return []
            
        # Get others who have overlap
        all_profs_res = await session.execute(
            select(TravelBuddyProfile)
            .where(TravelBuddyProfile.is_active == True, TravelBuddyProfile.customer_id != user_id)
        )
        all_profs = all_profs_res.scalars().all()
        
        matches = []
        for p in all_profs:
            overlap = set(my_prof.preferred_destinations).intersection(set(p.preferred_destinations))
            if overlap:
                matches.append({
                    "customerId": p.customer_id,
                    "bio": p.bio,
                    "travelStyles": p.travel_styles,
                    "preferredDestinations": p.preferred_destinations,
                    "languages": p.languages,
                    "matchScore": len(overlap)
                })
                
        # sort by match score desc
        matches.sort(key=lambda x: x["matchScore"], reverse=True)
        return matches
