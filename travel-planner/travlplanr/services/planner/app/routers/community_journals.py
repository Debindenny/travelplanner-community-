from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func

from shared.auth_dependencies import optional_customer, require_customer
from shared.rate_limit import rate_limiter
from app.models.community import Journal, CommunityProfile

router = APIRouter()


class CreateJournalRequest(BaseModel):
    title: str = Field(..., max_length=255)
    content: str | None = Field(default=None, max_length=20000)
    itinerary_id: str | None = None
    cover_image: str | None = None
    is_public: bool = False


class UpdateJournalRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    content: str | None = Field(default=None, max_length=20000)
    cover_image: str | None = None
    is_public: bool | None = None


async def _authors_map(session, customer_ids: set[UUID]) -> dict:
    if not customer_ids:
        return {}
    profiles = (await session.execute(
        select(CommunityProfile).where(CommunityProfile.customer_id.in_(customer_ids))
    )).scalars().all()
    return {p.customer_id: p for p in profiles}


def _serialize_journal(journal: Journal, profile: CommunityProfile | None) -> dict:
    return {
        "id": str(journal.id),
        "title": journal.title,
        "content": journal.content,
        "itinerary_id": str(journal.itinerary_id) if journal.itinerary_id else None,
        "cover_image": journal.cover_image,
        "is_public": journal.is_public,
        "created_at": journal.created_at.isoformat() if journal.created_at else None,
        "updated_at": journal.updated_at.isoformat() if journal.updated_at else None,
        "author": {
            "id": str(journal.customer_id),
            "name": profile.name if profile and profile.name else "Traveler",
            "avatar": profile.avatar_url if profile else None,
        },
    }


@router.post("", dependencies=[Depends(rate_limiter("journal-create", 10, 3600))])
async def create_journal(data: CreateJournalRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    if not data.title or not data.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    if data.cover_image is not None and not data.cover_image.strip():
        raise HTTPException(status_code=400, detail="cover_image cannot be blank if provided")

    itinerary_id_uuid = None
    if data.itinerary_id:
        try:
            itinerary_id_uuid = UUID(data.itinerary_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid itinerary_id")

    async with request.app.state.session_factory() as session:
        journal = Journal(
            customer_id=customer_id,
            title=data.title.strip(),
            content=data.content,
            itinerary_id=itinerary_id_uuid,
            cover_image=data.cover_image,
            is_public=bool(data.is_public),
        )
        session.add(journal)
        await session.commit()
        await session.refresh(journal)
        profile = (await session.execute(
            select(CommunityProfile).where(CommunityProfile.customer_id == customer_id)
        )).scalar_one_or_none()
        return _serialize_journal(journal, profile)


@router.get("")
async def get_my_journals(request: Request, limit: int = 20, offset: int = 0, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        journals = (await session.execute(
            select(Journal).where(Journal.customer_id == customer_id)
            .order_by(desc(Journal.updated_at)).limit(limit).offset(offset)
        )).scalars().all()
        profile = (await session.execute(
            select(CommunityProfile).where(CommunityProfile.customer_id == customer_id)
        )).scalar_one_or_none()
        return [_serialize_journal(j, profile) for j in journals]


@router.get("/public")
async def get_public_journals(request: Request, limit: int = 20, offset: int = 0, auth: dict | None = Depends(optional_customer)):
    async with request.app.state.session_factory() as session:
        journals = (await session.execute(
            select(Journal).where(Journal.is_public == True)  # noqa: E712
            .order_by(desc(Journal.updated_at)).limit(limit).offset(offset)
        )).scalars().all()
        authors = await _authors_map(session, {j.customer_id for j in journals})
        return [_serialize_journal(j, authors.get(j.customer_id)) for j in journals]


@router.get("/{journal_id}")
async def get_journal(journal_id: UUID, request: Request, auth: dict | None = Depends(optional_customer)):
    customer_id = UUID(auth["customer_id"]) if auth and "customer_id" in auth else None
    async with request.app.state.session_factory() as session:
        journal = (await session.execute(select(Journal).where(Journal.id == journal_id))).scalar_one_or_none()
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        if not journal.is_public and journal.customer_id != customer_id:
            raise HTTPException(status_code=404, detail="Journal not found")
        profile = (await session.execute(
            select(CommunityProfile).where(CommunityProfile.customer_id == journal.customer_id)
        )).scalar_one_or_none()
        return _serialize_journal(journal, profile)


@router.patch("/{journal_id}")
async def update_journal(journal_id: UUID, data: UpdateJournalRequest, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        journal = (await session.execute(select(Journal).where(Journal.id == journal_id))).scalar_one_or_none()
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        if journal.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="You can only edit your own journals")

        if data.title is not None:
            if not data.title.strip():
                raise HTTPException(status_code=400, detail="Title cannot be empty")
            journal.title = data.title.strip()
        if data.content is not None:
            journal.content = data.content
        if data.cover_image is not None:
            journal.cover_image = data.cover_image
        if data.is_public is not None:
            journal.is_public = data.is_public
        journal.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(journal)
        profile = (await session.execute(
            select(CommunityProfile).where(CommunityProfile.customer_id == customer_id)
        )).scalar_one_or_none()
        return _serialize_journal(journal, profile)


@router.delete("/{journal_id}")
async def delete_journal(journal_id: UUID, request: Request, auth: dict = Depends(require_customer)):
    customer_id = UUID(auth["customer_id"])
    async with request.app.state.session_factory() as session:
        journal = (await session.execute(select(Journal).where(Journal.id == journal_id))).scalar_one_or_none()
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        if journal.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="You can only delete your own journals")
        await session.delete(journal)
        await session.commit()
        return {"status": "success", "message": "Journal deleted"}
