from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select

from app.models.packages import Package
from shared.auth_dependencies import require_staff

router = APIRouter()

class PackageCreateUpdate(BaseModel):
    title: str
    theme: str
    price: int
    days: int
    group_type: str
    image_url: str
    region: str
    country: str
    budget_tier: str
    rating: float
    itinerary_id: str | None = None

@router.get("")
async def list_packages(request: Request, auth: dict = Depends(require_staff)):
    """List all holiday packages."""
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Package).order_by(Package.title))
        packages = result.scalars().all()
        return {"items": [p.to_dict() for p in packages]}

@router.post("")
async def create_package(data: PackageCreateUpdate, request: Request, auth: dict = Depends(require_staff)):
    """Create a new holiday package."""
    async with request.app.state.session_factory() as session:
        pkg = Package(
            title=data.title,
            theme=data.theme,
            price=data.price,
            days=data.days,
            group_type=data.group_type,
            image_url=data.image_url,
            region=data.region,
            country=data.country,
            budget_tier=data.budget_tier,
            rating=data.rating,
            itinerary_id=data.itinerary_id
        )
        session.add(pkg)
        await session.commit()
        await session.refresh(pkg)
        return pkg.to_dict()

@router.put("/{package_id}")
async def update_package(package_id: str, data: PackageCreateUpdate, request: Request, auth: dict = Depends(require_staff)):
    """Update an existing holiday package."""
    async with request.app.state.session_factory() as session:
        pkg = await session.get(Package, uuid.UUID(package_id))
        if not pkg:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Package not found")
            
        pkg.title = data.title
        pkg.theme = data.theme
        pkg.price = data.price
        pkg.days = data.days
        pkg.group_type = data.group_type
        pkg.image_url = data.image_url
        pkg.region = data.region
        pkg.country = data.country
        pkg.budget_tier = data.budget_tier
        pkg.rating = data.rating
        pkg.itinerary_id = data.itinerary_id
        
        await session.commit()
        await session.refresh(pkg)
        return pkg.to_dict()

@router.delete("/{package_id}")
async def delete_package(package_id: str, request: Request, auth: dict = Depends(require_staff)):
    """Delete a holiday package."""
    async with request.app.state.session_factory() as session:
        pkg = await session.get(Package, uuid.UUID(package_id))
        if not pkg:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Package not found")
            
        await session.delete(pkg)
        await session.commit()
        return {"success": True}
