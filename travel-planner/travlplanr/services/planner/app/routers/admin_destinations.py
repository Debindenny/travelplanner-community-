from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional
import uuid

from shared.database import get_db
from shared.auth_dependencies import require_staff
from app.models.destinations import Destination

router = APIRouter(dependencies=[Depends(require_staff)])

class DestinationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: str
    base_price: int
    region: str
    tags: List[str] = []

class DestinationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    base_price: Optional[int] = None
    region: Optional[str] = None
    tags: Optional[List[str]] = None

class DestinationResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    image_url: str
    base_price: int
    region: str
    tags: List[str]

@router.get("/", response_model=List[DestinationResponse])
async def list_destinations(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Destination).order_by(Destination.name.asc()).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/", response_model=DestinationResponse)
async def create_destination(dest: DestinationCreate, db: AsyncSession = Depends(get_db)):
    new_dest = Destination(
        name=dest.name,
        description=dest.description,
        image_url=dest.image_url,
        base_price=dest.base_price,
        region=dest.region,
        tags=dest.tags
    )
    db.add(new_dest)
    await db.commit()
    await db.refresh(new_dest)
    return new_dest

@router.patch("/{dest_id}", response_model=DestinationResponse)
async def update_destination(dest_id: uuid.UUID, update_data: DestinationUpdate, db: AsyncSession = Depends(get_db)):
    dest = await db.get(Destination, dest_id)
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(dest, key, value)
        
    await db.commit()
    await db.refresh(dest)
    return dest

@router.delete("/{dest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_destination(dest_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    dest = await db.get(Destination, dest_id)
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    await db.delete(dest)
    await db.commit()
