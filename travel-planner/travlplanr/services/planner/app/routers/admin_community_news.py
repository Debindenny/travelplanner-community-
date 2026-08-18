from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select
from pydantic import BaseModel
from typing import List
from uuid import UUID

from app.models.community import CommunityNews
from shared.auth_dependencies import require_staff

router = APIRouter()

class NewsCreate(BaseModel):
    title: str
    content: str
    imageUrl: str | None = None
    link: str | None = None
    isActive: bool = True

class NewsResponse(NewsCreate):
    id: str

@router.get("", response_model=List[NewsResponse])
async def get_all_news(request: Request, auth: dict = Depends(require_staff)):
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(CommunityNews).order_by(CommunityNews.created_at.desc()))
        news = result.scalars().all()
        return [
            NewsResponse(
                id=str(n.id),
                title=n.title,
                content=n.content,
                imageUrl=n.image_url,
                link=n.link,
                isActive=n.is_active
            ) for n in news
        ]

@router.post("", response_model=NewsResponse)
async def create_news(data: NewsCreate, request: Request, auth: dict = Depends(require_staff)):
    async with request.app.state.session_factory() as session:
        news_item = CommunityNews(
            title=data.title,
            content=data.content,
            image_url=data.imageUrl,
            link=data.link,
            is_active=data.isActive
        )
        session.add(news_item)
        await session.commit()
        await session.refresh(news_item)
        return NewsResponse(
            id=str(news_item.id),
            title=news_item.title,
            content=news_item.content,
            imageUrl=news_item.image_url,
            link=news_item.link,
            isActive=news_item.is_active
        )

@router.put("/{news_id}", response_model=NewsResponse)
async def update_news(news_id: str, data: NewsCreate, request: Request, auth: dict = Depends(require_staff)):
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(CommunityNews).where(CommunityNews.id == UUID(news_id)))
        news_item = result.scalar_one_or_none()
        if not news_item:
            raise HTTPException(status_code=404, detail="News item not found")
            
        news_item.title = data.title
        news_item.content = data.content
        news_item.image_url = data.imageUrl
        news_item.link = data.link
        news_item.is_active = data.isActive
        
        await session.commit()
        return NewsResponse(
            id=str(news_item.id),
            title=news_item.title,
            content=news_item.content,
            imageUrl=news_item.image_url,
            link=news_item.link,
            isActive=news_item.is_active
        )

@router.delete("/{news_id}")
async def delete_news(news_id: str, request: Request, auth: dict = Depends(require_staff)):
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(CommunityNews).where(CommunityNews.id == UUID(news_id)))
        news_item = result.scalar_one_or_none()
        if not news_item:
            raise HTTPException(status_code=404, detail="News item not found")
            
        await session.delete(news_item)
        await session.commit()
        return {"status": "success"}
