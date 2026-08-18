from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from shared.database import get_db
from shared.auth_dependencies import require_staff
from app.models.reviews import Review

router = APIRouter(dependencies=[Depends(require_staff)])

class ReviewUpdate(BaseModel):
    status: str

class ReviewResponse(BaseModel):
    id: uuid.UUID
    target_type: str
    target_id: uuid.UUID
    customer_name: str
    rating: int
    comment: str
    status: str
    created_at: datetime

@router.get("/", response_model=List[ReviewResponse])
async def list_reviews(
    status: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Review).order_by(Review.created_at.desc())
    if status:
        query = query.where(Review.status == status)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{review_id}", response_model=ReviewResponse)
async def update_review_status(review_id: uuid.UUID, update_data: ReviewUpdate, db: AsyncSession = Depends(get_db)):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if update_data.status not in ["Pending", "Approved", "Rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    review.status = update_data.status
    await db.commit()
    await db.refresh(review)
    return review

@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(review_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    await db.delete(review)
    await db.commit()
