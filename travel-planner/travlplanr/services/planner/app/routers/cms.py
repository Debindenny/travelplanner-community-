from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Request, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from shared.rate_limit import rate_limiter
from app.models.cms import BlogPost, FaqSection, FaqItem
from app.models.faq_feedback import FaqFeedback

router = APIRouter()

DEFAULT_LOCALE = "en"
SITE_URL = "https://travlplanr.com"


class FaqFeedbackRequest(BaseModel):
    helpful: bool


@router.get("/blog")
async def get_blog_posts(request: Request, locale: str = DEFAULT_LOCALE):
    async with request.app.state.session_factory() as session:
        query = (
            select(BlogPost)
            .where(BlogPost.status == 'published', BlogPost.locale == locale)
            .order_by(BlogPost.published_at.desc())
        )
        result = await session.execute(query)
        posts = result.scalars().all()
        # No content translated for this locale yet — fall back to English
        # rather than showing an empty blog list.
        if not posts and locale != DEFAULT_LOCALE:
            fallback_query = (
                select(BlogPost)
                .where(BlogPost.status == 'published', BlogPost.locale == DEFAULT_LOCALE)
                .order_by(BlogPost.published_at.desc())
            )
            posts = (await session.execute(fallback_query)).scalars().all()
        return [p.to_dict() for p in posts]

def _parse_published_at(value: str) -> datetime:
    """`published_at` is a free-text string like 'Jun 12, 2025', not a real
    timestamp column — best-effort parse it for RSS's pubDate, falling back
    to "now" rather than letting an unexpected format break the feed."""
    try:
        return datetime.strptime(value, "%b %d, %Y").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


@router.get("/blog/rss.xml")
async def get_blog_rss(request: Request, locale: str = DEFAULT_LOCALE):
    async with request.app.state.session_factory() as session:
        query = (
            select(BlogPost)
            .where(BlogPost.status == 'published', BlogPost.locale == locale)
            .order_by(BlogPost.published_at.desc())
        )
        posts = (await session.execute(query)).scalars().all()
        if not posts and locale != DEFAULT_LOCALE:
            fallback_query = (
                select(BlogPost)
                .where(BlogPost.status == 'published', BlogPost.locale == DEFAULT_LOCALE)
                .order_by(BlogPost.published_at.desc())
            )
            posts = (await session.execute(fallback_query)).scalars().all()

    items = []
    for post in posts:
        link = f"{SITE_URL}/blog/{post.slug}"
        items.append(
            "<item>"
            f"<title>{escape(post.title)}</title>"
            f"<link>{escape(link)}</link>"
            f'<guid isPermaLink="true">{escape(link)}</guid>'
            f"<description>{escape(post.excerpt)}</description>"
            f"<pubDate>{format_datetime(_parse_published_at(post.published_at))}</pubDate>"
            "</item>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0"><channel>'
        "<title>TRAVL PLANR Blog</title>"
        f"<link>{SITE_URL}/blog</link>"
        "<description>Travel stories, destination guides, and planning tips from the Travl Planr team.</description>"
        f"<language>{escape(locale)}</language>"
        + "".join(items)
        + "</channel></rss>"
    )
    return Response(content=xml, media_type="application/rss+xml")


@router.get("/blog/{slug}")
async def get_blog_post(request: Request, slug: str, locale: str = DEFAULT_LOCALE):
    async with request.app.state.session_factory() as session:
        query = select(BlogPost).where(BlogPost.slug == slug, BlogPost.locale == locale)
        result = await session.execute(query)
        post = result.scalars().first()
        if not post and locale != DEFAULT_LOCALE:
            fallback_query = select(BlogPost).where(BlogPost.slug == slug, BlogPost.locale == DEFAULT_LOCALE)
            post = (await session.execute(fallback_query)).scalars().first()
        if not post:
            raise HTTPException(status_code=404, detail="Blog post not found")
        return post.to_dict()

@router.get("/faq")
async def get_faqs(request: Request, locale: str = DEFAULT_LOCALE):
    async with request.app.state.session_factory() as session:
        # Load FaqSections with their Items
        # Due to relationships and lazy loading with async, it's better to eager load
        from sqlalchemy.orm import selectinload
        query = (
            select(FaqSection)
            .where(FaqSection.locale == locale)
            .options(selectinload(FaqSection.items))
            .order_by(FaqSection.order)
        )
        result = await session.execute(query)
        sections = result.scalars().all()
        if not sections and locale != DEFAULT_LOCALE:
            fallback_query = (
                select(FaqSection)
                .where(FaqSection.locale == DEFAULT_LOCALE)
                .options(selectinload(FaqSection.items))
                .order_by(FaqSection.order)
            )
            sections = (await session.execute(fallback_query)).scalars().all()
        return [s.to_dict() for s in sections]


@router.post("/faq/{item_id}/feedback", dependencies=[Depends(rate_limiter("faq-feedback", 20, 300))])
async def submit_faq_feedback(item_id: str, body: FaqFeedbackRequest, request: Request):
    """Anonymous 'Was this helpful?' vote on a single FAQ item."""
    async with request.app.state.session_factory() as session:
        item = await session.get(FaqItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="FAQ item not found")
        session.add(FaqFeedback(item_id=item_id, helpful=body.helpful))
        await session.commit()
    return {"status": "recorded"}


@router.get("/seed")
async def seed_cms(request: Request):
    import secrets as _secrets
    from shared.config import DEV_ENVIRONMENTS
    settings = request.app.state.settings
    if settings.environment.lower() not in DEV_ENVIRONMENTS:
        raise HTTPException(status_code=403, detail="Seeding is disabled outside development")
    if not _secrets.compare_digest(request.query_params.get("secret", ""), settings.seed_secret):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # hardcoded data
    BLOG_POSTS = [
        {
            "slug": 'hidden-gems-southeast-asia',
            "title": '10 Hidden Gems in Southeast Asia You Need to Visit',
            "excerpt": 'Skip the crowds and discover secluded beaches, mountain villages, and local food markets across Thailand, Vietnam, and beyond.',
            "content": 'Southeast Asia rewards travelers who venture beyond the well-trodden routes. From lantern-lit alleys in Hoi An to quiet rice terraces in northern Thailand, the region is full of places that feel worlds away from the busiest tourist hubs. Go where the ferries are smaller. Start with smaller islands off the main ferry routes, then pair each stop with a local guide who can recommend seasonal festivals and family-run restaurants. Travl Planr makes it easy to slot these detours into a broader itinerary without losing your core plans. The best discoveries rarely appear on a rigid schedule — leave at least one unplanned day per week. Pack light, keep cash for rural markets, and prioritize early mornings when temples and markets are at their calmest.',
            "image": 'assets/images/landing/thailand-trending.jpg',
            "category": 'destinations',
            "categoryLabel": 'Destinations',
            "author": 'Priya Sharma',
            "publishedAt": 'Jun 12, 2025',
            "readTime": '6 min read',
            "featured": True,
        },
        {
            "slug": 'pack-smart-long-haul',
            "title": 'How to Pack Smart for Long-Haul Flights',
            "excerpt": 'A carry-on checklist, comfort essentials, and timezone tricks to arrive refreshed instead of exhausted.',
            "content": 'Long-haul travel is less about how much you pack and more about what you prioritize within reach. Keep medications, chargers, and a change of clothes in your personal item — never in checked luggage. Comfort beats quantity. Layer clothing for cabin temperature swings, use compression socks on flights over six hours, and hydrate steadily from boarding to landing. A simple eye mask and noise-cancelling headphones often matter more than an extra outfit.',
            "image": 'assets/images/landing/hero-bg.jpg',
            "category": 'tips',
            "categoryLabel": 'Travel Tips',
            "author": 'Marcus Lee',
            "publishedAt": 'Jun 8, 2025',
            "readTime": '4 min read',
            "featured": False,
        },
        {
            "slug": 'dubai-weekend-itinerary',
            "title": 'The Perfect 3-Day Dubai Itinerary for First-Timers',
            "excerpt": 'Balance iconic skyline views, desert adventures, and old-town souks in one long weekend.',
            "content": 'Day 1 — Old Dubai. Start at the creek with abra rides, spice souks, and an evening stroll through Al Seef. This is the contrast that makes Dubai memorable. Day 2 — Modern landmarks. Visit Burj Khalifa at golden hour, then book dinner with a marina view. Keep the afternoon light for Dubai Mall or a short spa break. Day 3 — Desert escape. A morning safari leaves the afternoon free for last-minute shopping or a relaxed pool afternoon before your flight home.',
            "image": 'assets/images/landing/iconic-uae.jpg',
            "category": 'guides',
            "categoryLabel": 'Guides',
            "author": 'Aisha Khan',
            "publishedAt": 'Jun 3, 2025',
            "readTime": '7 min read',
            "featured": False,
        },
    ]

    FAQ_SECTIONS = [
        {
            "id": "general",
            "title": "General",
            "items": [
                {"question": "What is Travi Plan, and how does it stand out from other travel websites?", "answer": "Travl Planr is a free, AI-powered platform that creates personalized travel itineraries in moments."},
                {"question": "Do I need an account to start planning?", "answer": "No account is required to generate or preview a plan. Sign up only if you want to save, edit, or revisit your trips later."},
            ]
        },
        {
            "id": "ai-trip-planner",
            "title": "AI Trip Planner",
            "items": [
                {"question": "How does the AI plan my trip?", "answer": "After you enter details like destination, travel dates, group size, and interests, the AI generates a personalized day-by-day itinerary."},
                {"question": "Can I make changes after the AI suggests the plan?", "answer": "Yes. Every part of the plan is editable — you can swap hotels, activities, or transport with one click."},
            ]
        }
    ]

    async with request.app.state.session_factory() as session:
        for post in BLOG_POSTS:
            # check if exists
            existing = await session.execute(select(BlogPost).where(BlogPost.slug == post["slug"]))
            if not existing.scalars().first():
                bp = BlogPost(
                    title=post["title"],
                    slug=post["slug"],
                    excerpt=post["excerpt"],
                    content=post["content"],
                    image_url=post["image"],
                    author=post["author"],
                    published_at=post["publishedAt"],
                    read_time=post["readTime"],
                    category=post["category"],
                    category_label=post["categoryLabel"],
                    featured=post["featured"]
                )
                session.add(bp)
                
        for idx, sec in enumerate(FAQ_SECTIONS):
            existing = await session.execute(select(FaqSection).where(FaqSection.id == sec["id"]))
            if not existing.scalars().first():
                fs = FaqSection(id=sec["id"], title=sec["title"], order=idx)
                session.add(fs)
                for item_idx, item in enumerate(sec["items"]):
                    fi = FaqItem(id=f'{sec["id"]}-{item_idx}', section_id=sec["id"], question=item["question"], answer=item["answer"], order=item_idx)
                    session.add(fi)
        await session.commit()

    return {"message": "CMS seeded successfully"}
