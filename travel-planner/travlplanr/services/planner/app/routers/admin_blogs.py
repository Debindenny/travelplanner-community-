import json
import logging
import os
import re
import uuid
from collections import Counter
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from shared.database import get_db
from shared.auth_dependencies import require_staff
from app.models.cms import BlogPost, BlogPostRevision
from app.services.chat_providers import generate_with_system_prompt

logger = logging.getLogger(__name__)
router = APIRouter()

class BlogPostCreate(BaseModel):
    title: str
    slug: str
    locale: str = "en"
    excerpt: str
    content: str
    image_url: str
    author: str
    published_at: str
    read_time: str
    category: str
    category_label: str
    featured: bool = False
    status: str = "published"
    tags: str = "[]"
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    target_keywords: Optional[str] = None

class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    locale: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    author: Optional[str] = None
    published_at: Optional[str] = None
    read_time: Optional[str] = None
    category: Optional[str] = None
    category_label: Optional[str] = None
    featured: Optional[bool] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    target_keywords: Optional[str] = None

class BlogPostResponse(BaseModel):
    """Mirrors BlogPost.to_dict() exactly (camelCase) — the admin frontend's
    BlogPostData interface expects the same shape the customer-facing CMS
    router already returns, not the raw snake_case ORM column names."""
    id: str
    title: str
    slug: str
    locale: str
    excerpt: str
    content: str
    image: str
    author: str
    publishedAt: str
    readTime: str
    category: str
    categoryLabel: str
    featured: bool
    status: str
    tags: str
    metaTitle: Optional[str] = None
    metaDescription: Optional[str] = None
    targetKeywords: Optional[str] = None

@router.get("/", response_model=List[BlogPostResponse])
async def list_blogs(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    result = await db.execute(
        select(BlogPost).order_by(BlogPost.published_at.desc()).offset(offset).limit(limit)
    )
    return [blog.to_dict() for blog in result.scalars().all()]

@router.post("/", response_model=BlogPostResponse)
async def create_blog(blog: BlogPostCreate, db: AsyncSession = Depends(get_db), auth: dict = Depends(require_staff)):
    # Slugs are only unique per locale (uq_blog_posts_slug_locale) — the same
    # slug is expected to exist once per translated copy of a post.
    existing = await db.execute(
        select(BlogPost).where(BlogPost.slug == blog.slug, BlogPost.locale == blog.locale)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Blog post with this slug already exists for this locale")

    new_blog = BlogPost(
        title=blog.title,
        slug=blog.slug,
        locale=blog.locale,
        excerpt=blog.excerpt,
        content=blog.content,
        image_url=blog.image_url,
        author=blog.author,
        published_at=blog.published_at,
        read_time=blog.read_time,
        category=blog.category,
        category_label=blog.category_label,
        featured=blog.featured,
        status=blog.status,
        tags=blog.tags,
        meta_title=blog.meta_title,
        meta_description=blog.meta_description,
        target_keywords=blog.target_keywords
    )
    db.add(new_blog)
    await db.commit()
    await db.refresh(new_blog)
    return new_blog.to_dict()

@router.patch("/{slug}", response_model=BlogPostResponse)
async def update_blog(slug: str, update_data: BlogPostUpdate, locale: str = "en", db: AsyncSession = Depends(get_db), auth: dict = Depends(require_staff)):
    # slug alone is ambiguous once a slug has locale variants (uq_blog_posts_slug_locale)
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug, BlogPost.locale == locale))
    blog = result.scalars().first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog post not found")
        
    # Save a revision before updating
    revision = BlogPostRevision(
        blog_post_id=blog.id,
        title=blog.title,
        content=blog.content,
        excerpt=blog.excerpt
    )
    db.add(revision)
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(blog, key, value)
        
    await db.commit()
    await db.refresh(blog)
    return blog.to_dict()

@router.get("/{slug}/revisions")
async def get_blog_revisions(slug: str, locale: str = "en", db: AsyncSession = Depends(get_db), auth: dict = Depends(require_staff)):
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug, BlogPost.locale == locale))
    blog = result.scalars().first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog post not found")
        
    rev_result = await db.execute(select(BlogPostRevision).where(BlogPostRevision.blog_post_id == blog.id).order_by(BlogPostRevision.created_at.desc()))
    revisions = rev_result.scalars().all()
    return [r.to_dict() for r in revisions]

@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog(slug: str, locale: str = "en", db: AsyncSession = Depends(get_db), auth: dict = Depends(require_staff)):
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug, BlogPost.locale == locale))
    blog = result.scalars().first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    await db.delete(blog)
    await db.commit()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

# Signature (magic-byte) -> extension. The upload's real type is determined
# from these leading bytes, not the client-supplied filename, since a
# filename extension is trivially spoofable.
IMAGE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
    (b"RIFF", "webp"),  # narrowed to WEBP below (RIFF also covers WAV/AVI)
]


def _detect_image_extension(header: bytes) -> str | None:
    for signature, ext in IMAGE_SIGNATURES:
        if header.startswith(signature):
            if ext == "webp" and header[8:12] != b"WEBP":
                continue
            return ext
    return None


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), auth: dict = Depends(require_staff)):
    header = await file.read(12)
    ext = _detect_image_extension(header)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Only PNG, JPEG, GIF, and WEBP images are allowed.",
        )

    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = "app/static/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)

    total_written = len(header)
    if total_written > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="File too large")

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(header)
            while chunk := await file.read(64 * 1024):
                total_written += len(chunk)
                if total_written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit",
                    )
                buffer.write(chunk)
    except HTTPException:
        os.remove(file_path)
        raise

    return {"url": f"/api/v1/static/uploads/{filename}"}

class SeoGenerationRequest(BaseModel):
    title: str
    content: str


def _heuristic_seo(title: str, text_content: str) -> dict:
    """Word-frequency fallback used only if no LLM provider is available or it fails."""
    excerpt = text_content[:150] + "..." if len(text_content) > 150 else text_content
    meta_description = text_content[:160]
    words = [w.lower() for w in text_content.split() if len(w) > 4]
    common_words = [word for word, count in Counter(words).most_common(4)]
    return {
        "meta_title": title,
        "meta_description": meta_description,
        "excerpt": excerpt,
        "target_keywords": ", ".join(common_words),
        "tags": common_words,
    }


@router.post("/generate-seo")
async def generate_seo(req: SeoGenerationRequest, auth: dict = Depends(require_staff)):
    text_content = re.sub(r"\s+", " ", re.sub("<[^<]+>", " ", req.content)).strip()

    prompt = (
        f"Blog post title: {req.title}\n\nBlog post content:\n{text_content[:4000]}\n\n"
        "Return ONLY a JSON object (no markdown fences, no commentary) with exactly these keys: "
        '"meta_title" (<=60 chars), "meta_description" (<=160 chars), "excerpt" (1-2 sentences), '
        '"tags" (array of 3-5 lowercase keyword strings).'
    )
    system_prompt = (
        "You are an SEO copywriter for a travel blog. You respond with strict JSON only."
    )

    try:
        raw, provider = await generate_with_system_prompt(prompt, system_prompt)
        if raw:
            cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            data = json.loads(cleaned)
            tags = [str(t) for t in (data.get("tags") or [])][:5]
            return {
                "meta_title": str(data.get("meta_title") or req.title)[:60],
                "meta_description": str(data.get("meta_description") or "")[:160],
                "excerpt": data.get("excerpt") or "",
                "target_keywords": ", ".join(tags),
                "tags": tags,
            }
        logger.warning("SEO generation: no LLM provider available, using heuristic fallback")
    except Exception as exc:
        logger.warning(f"SEO generation via {provider if 'provider' in locals() else 'llm'} failed, using heuristic fallback: {exc}")

    return _heuristic_seo(req.title, text_content)

@router.get("/media")
async def list_media(auth: dict = Depends(require_staff)):
    upload_dir = "app/static/uploads"
    if not os.path.exists(upload_dir):
        return []
        
    files = []
    for f in os.listdir(upload_dir):
        if os.path.isfile(os.path.join(upload_dir, f)) and not f.startswith('.'):
            files.append({
                "url": f"/api/v1/static/uploads/{f}",
                "name": f
            })
    return files


# Registered last: "/{slug}" is a single-segment wildcard that would
# otherwise shadow the literal GET routes above it (e.g. "/media" would be
# matched as slug="media") if it were declared earlier.
@router.get("/{slug}", response_model=BlogPostResponse)
async def get_blog(slug: str, locale: str = "en", db: AsyncSession = Depends(get_db), auth: dict = Depends(require_staff)):
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug, BlogPost.locale == locale))
    blog = result.scalars().first()
    if not blog:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return blog.to_dict()
