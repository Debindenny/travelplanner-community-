from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from shared.database import get_db
from shared.auth_dependencies import require_staff
from app.models.promotions import Promotion

router = APIRouter(dependencies=[Depends(require_staff)])

class PromotionCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: int
    valid_until: datetime
    is_active: bool = True

class PromotionUpdate(BaseModel):
    is_active: bool

class PromotionResponse(BaseModel):
    id: uuid.UUID
    code: str
    discount_type: str
    discount_value: int
    valid_until: datetime
    is_active: bool

@router.get("/", response_model=List[PromotionResponse])
async def list_promotions(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Promotion).order_by(Promotion.valid_until.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/", response_model=PromotionResponse)
async def create_promotion(promo: PromotionCreate, db: AsyncSession = Depends(get_db)):
    # Check if code exists
    stmt = select(Promotion).where(Promotion.code == promo.code)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Promotion code already exists")
    
    new_promo = Promotion(
        code=promo.code,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        valid_until=promo.valid_until,
        is_active=promo.is_active
    )
    db.add(new_promo)
    await db.commit()
    await db.refresh(new_promo)
    return new_promo

@router.patch("/{promo_id}", response_model=PromotionResponse)
async def update_promotion(promo_id: uuid.UUID, update_data: PromotionUpdate, db: AsyncSession = Depends(get_db)):
    promo = await db.get(Promotion, promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    promo.is_active = update_data.is_active
    await db.commit()
    await db.refresh(promo)
    return promo

@router.delete("/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(promo_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    promo = await db.get(Promotion, promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    await db.delete(promo)
    await db.commit()
