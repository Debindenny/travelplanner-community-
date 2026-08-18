import json
import logging
import re
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from shared.auth_dependencies import require_customer
from shared.rate_limit import rate_limiter
from sqlalchemy import func, or_, select

from app.models.destinations import Destination
from app.models.inventory import InventoryItem
from app.models.packages import Package
from app.models.cms import FaqItem, BlogPost
from app.services.chat_providers import generate_reply, generate_reply_stream
from app.services.destination_resolver import resolve_destination, resolve_destination_with_history
from app.services.chat_intent import (
    build_actions,
    enrich_reply,
    extract_destination,
    extract_duration_days,
    infer_intent,
    parse_itinerary_edits,
    partition_chat_actions,
    _guess_unrecognized_place,
)
from app.services.llm_slot_extraction import extract_slots_via_llm
from app.services.llm_edit_extraction import extract_edit_via_llm
from app.services.llm_intent_router import route_intent_and_slots
from app.services.chat_learning_service import (
    _customer_uuid,
    ensure_active_prompt_version,
    learning_dashboard_stats,
    record_activity_outcome,
    record_chat_interaction,
    submit_chat_feedback,
    get_customer_travel_profile,
)
from app.services.activity_suggestion_service import build_ranked_activity_suggestions, _city_for_day
from app.models.trips import Trip
from app.routers.inventory import _run_search
from app.services.trip_planning_slots import gather_trip_slots, slots_for_response
from app.services.weather_service import fetch_weather_summary, format_weather_for_reply
from app.services.image_search_service import search_images_async

_TRIP_SHAPED_INTENTS = {"create_trip", "group_trip", "multi_city_trip", "start_planning", "show_itinerary"}
_DURATION_WORD_RE = re.compile(r"\b(day|days|week|weeks|weekend|fortnight)\b", re.I)
# Free-form trip phrasings with no duration word at all — "somewhere warm in
# december", "honeymoon ideas", "want to visit the mountains" — still deserve
# an LLM slot pass so they don't dead-end as 'general'.
_TRIP_WORD_RE = re.compile(
    r"\b(trip|travel|vacation|holiday|getaway|honeymoon|visit|itinerar\w*|escape|tour|"
    r"somewhere|anywhere|beach|mountain\w*|backpack\w*|"
    r"january|february|march|april|may|june|july|august|september|october|november|december)\b",
    re.I,
)


def _looks_trip_shaped(message: str, intent: str) -> bool:
    """Decide whether it's worth spending an LLM call on slot extraction.

    Runs for messages the regex classifier already recognizes as trip
    planning, plus free-form phrasings it misses — e.g. "a week" or "a
    long weekend" don't match extract_duration_days's digit-only pattern,
    so a genuine trip request like "relax on a beach for a week" would
    otherwise fall through to 'general' and never get slot-filled.
    """
    if intent in _TRIP_SHAPED_INTENTS:
        return True
    if intent == "general" and len(message.split()) >= 4 and (
        _DURATION_WORD_RE.search(message) or _TRIP_WORD_RE.search(message)
    ):
        return True
    return False


def _should_emit_trip_slots(
    intent: str,
    message: str,
    *,
    known_slots: dict | None,
    resolved,
) -> bool:
    """Keep the Trip-so-far chips in sync on slot follow-ups (not only create_trip)."""
    if intent in _TRIP_SHAPED_INTENTS:
        return True
    if known_slots and (
        known_slots.get("destination")
        or known_slots.get("duration_days")
        or known_slots.get("travelers")
    ):
        return True
    if resolved is not None and getattr(resolved, "display_name", None):
        return True
    from app.services.trip_planning_slots import message_advances_planning_slots

    return message_advances_planning_slots(message)

_EDIT_VERB_RE = re.compile(r"\b(add|insert|include|put|remove|delete|drop|cancel|swap|replace|change)\b", re.I)
_EDIT_SUBJECT_RE = re.compile(
    r"\b(activit\w*|thing|things|stuff|experience|sight|spot|place|excursion|tour|attraction|option|"
    r"day\s*\d+|train|bus|flight|car|transfer|itinerar\w*)\b",
    re.I,
)


def _looks_edit_shaped(message: str) -> bool:
    """Worth an LLM edit-extraction call only when the message reads like an
    itinerary edit (an edit verb plus an activity/transport/day subject) that
    the regex parser failed to structure — keeps the extra latency off the
    common path."""
    return bool(_EDIT_VERB_RE.search(message) and _EDIT_SUBJECT_RE.search(message))


def _edit_confirmation_reply(edit: dict) -> str:
    """A short confirmation for an LLM-extracted edit. Kept separate from
    enrich_reply's modify_itinerary branch because that branch re-runs the
    regex parser (which found nothing here) and would wrongly say it couldn't
    apply the change."""
    day = edit.get("day") or 1
    kind = edit.get("edit")
    if kind == "add_activity" and edit.get("title"):
        return f"Got it — adding {edit['title']} to day {day}. It'll show up on your itinerary in a moment."
    if kind == "add_activity":
        count = edit.get("count", 1)
        return (
            f"Got it — I'm adding {count} curated activities to day {day}. "
            "They'll appear on your itinerary in a moment."
        )
    if kind == "add_transport":
        return f"On it — adding a {edit.get('transportType', 'car')} to day {day}. It'll appear on your itinerary shortly."
    if kind == "remove_item":
        return f"Done — removing {edit.get('titleMatch', 'that')} from your itinerary."
    return "Done — I've updated your itinerary on the page."

logger = logging.getLogger(__name__)
router = APIRouter()

# T3.2 — in-process catalog_context cache (destination key → (text, ts)).
# Keeps context builds off the hot path for repeated questions about the same
# destination.  Redis is the L1 cache when available; this dict is L2.
_CATALOG_CTX_CACHE: dict[str, tuple[str | None, float]] = {}
_CATALOG_CTX_TTL = float(__import__("os").environ.get("CATALOG_CTX_CACHE_TTL_SECONDS", "600"))  # 10 min default


async def _load_supported_destinations(request: Request) -> tuple[set[str], dict[str, str]]:
    names: set[str] = set()
    by_id: dict[str, str] = {}
    try:
        async with request.app.state.session_factory() as session:
            rows = (await session.execute(select(Destination.id, Destination.name))).all()
            for dest_id, name in rows:
                key = name.lower().strip()
                names.add(key)
                by_id[key] = str(dest_id)
    except Exception as exc:
        logger.warning("Could not load destination catalog for chat resolver: %s", exc)
    return names, by_id


async def _build_catalog_context(request: Request, message: str, region: str | None) -> str | None:
    """Ground the model in real inventory: when the message (or page context)
    names a place we may cover, hand the top packages for it to the system
    prompt so replies quote real titles/prices instead of inventing them.

    T3.2: Results are cached in-process (TTL 10 min) to avoid repeated DB
    queries when the same destination is mentioned across consecutive messages.
    """
    dest = extract_destination(message) or region
    if not dest:
        return None

    # T3.2 — check in-process cache first
    cache_key = dest.lower().strip()
    cached_entry = _CATALOG_CTX_CACHE.get(cache_key)
    if cached_entry is not None:
        text, ts = cached_entry
        if time.monotonic() - ts < _CATALOG_CTX_TTL:
            return text

    try:
        async with request.app.state.session_factory() as session:
            like = f"%{dest.lower().strip()}%"
            rows = (
                await session.execute(
                    select(
                        Package.title, Package.days, Package.price,
                        Package.theme, Package.budget_tier, Package.rating, Package.region,
                    )
                    .where(
                        or_(
                            func.lower(Package.region).like(like),
                            func.lower(Package.country).like(like),
                            # T2.5: city-level destinations usually appear in titles.
                            func.lower(Package.title).like(like),
                        )
                    )
                    .order_by(Package.rating.desc())
                    .limit(5)
                )
            ).all()
    except Exception as exc:
        logger.warning("Could not load package catalog for chat grounding: %s", exc)
        return None
    if not rows:
        _CATALOG_CTX_CACHE[cache_key] = (None, time.monotonic())
        return None
    lines = [
        f"- {title} ({pkg_region}): {days} days, ₹{price:,}, {theme}, {tier} tier, rated {rating}/5"
        for title, days, price, theme, tier, rating, pkg_region in rows
    ]

    # T2.5 — augment with live affiliate inventory (hotels + activities) so
    # replies mention real options from our actual inventory feed.
    inventory_lines: list[str] = []
    try:
        async with request.app.state.session_factory() as _inv_s:
            like2 = f"%{dest.lower().strip()}%"
            inv_rows = (
                await _inv_s.execute(
                    select(InventoryItem.title, InventoryItem.item_type, InventoryItem.price_amount)
                    .where(func.lower(InventoryItem.title).like(like2))
                    .where(InventoryItem.item_type.in_(["hotel", "activity"]))
                    .order_by(InventoryItem.price_amount)
                    .limit(4)
                )
            ).all()
            for title, item_type, price in inv_rows:
                inventory_lines.append(f"- {title} ({item_type}): ₹{price:,}")
    except Exception as exc:
        logger.debug("Could not load inventory for chat grounding: %s", exc)

    sections = [f"Packages we actually sell for {dest}:\n" + "\n".join(lines)]
    if inventory_lines:
        sections.append(f"Live inventory for {dest}:\n" + "\n".join(inventory_lines))
    result = "\n\n".join(sections)
    _CATALOG_CTX_CACHE[cache_key] = (result, time.monotonic())
    return result


# T3.3 — page-context grounding: which page the user is on, and (when they're
# looking at an itinerary) what's actually on it. Lets the assistant answer
# "what's on day 3?" or "where am I" instead of guessing from the message alone.
_PAGE_DESCRIPTIONS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"^/itinerary/"), "the user's trip itinerary page, viewing their own booked/generated plan"),
    (re.compile(r"^/packages/"), "a specific package's detail page"),
    (re.compile(r"^/packages\b"), "the packages browsing page"),
    (re.compile(r"^/blog/"), "a blog article page"),
    (re.compile(r"^/blog\b"), "the blog listing page"),
    (re.compile(r"^/faq\b"), "the FAQ page"),
    (re.compile(r"^/pricing\b"), "the pricing page"),
    (re.compile(r"^/how-it-works\b"), "the how-it-works page"),
    (re.compile(r"^/explore\b"), "the Explore destinations page"),
    (re.compile(r"^/wizard\b"), "the trip-planning wizard"),
    (re.compile(r"^/trips\b"), "the user's saved trips list"),
    (re.compile(r"^/community\b"), "the community section"),
    (re.compile(r"^/for-you\b"), "the personalized recommendations page"),
    (re.compile(r"^/$"), "the home page"),
]


def _describe_page(path: str | None) -> str | None:
    if not path:
        return None
    clean = path.split("?")[0]
    for pattern, desc in _PAGE_DESCRIPTIONS:
        if pattern.search(clean):
            return desc
    return None


async def _load_trip_summary(request: Request, trip_id: str | None) -> str | None:
    """Compact day-by-day summary of the itinerary the user is currently
    viewing (trip_id comes from page context), so the assistant can answer
    questions about it directly instead of pretending it can see the page."""
    if not trip_id:
        return None
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        return None
    try:
        async with request.app.state.session_factory() as session:
            trip = await session.get(Trip, trip_uuid)
            if not trip or not trip.segments:
                return None
            by_day: dict[int, list[str]] = {}
            for segment in trip.segments:
                day = segment.get("day")
                title = segment.get("title") or segment.get("name")
                if day is None or not title:
                    continue
                by_day.setdefault(int(day), []).append(str(title))
            if not by_day:
                return None
            lines = [
                f"Day {day}: " + ", ".join(titles[:6])
                for day, titles in sorted(by_day.items())[:14]
            ]
            return f"Itinerary for {trip.destination} ({trip.start_date} to {trip.end_date}):\n" + "\n".join(lines)
    except Exception as exc:
        logger.debug("Could not load trip summary for chat grounding: %s", exc)
        return None


# T3.3 — platform-self grounding: pricing/how-it-works are static frontend
# data with no DB source (mirrored here), FAQ is queried live from the CMS.
_PRICING_CONTEXT = (
    "Pricing plans:\n"
    "- Free: ₹0 forever — 2 AI itineraries/month, basic destinations, email support.\n"
    "- Individual: ₹999/month — 10 AI itineraries/month, priority generation, affiliate booking links, PDF export.\n"
    "- Travel Partner: ₹4,999/month — 50 AI itineraries/month, white-label options, API access, dedicated support."
)

_HOW_IT_WORKS_CONTEXT = (
    "How Travl Planr works:\n"
    "1. Choose a Destination — search 190+ destinations or let us suggest one based on your travel style.\n"
    "2. Get an Instant Itinerary — AI generates a detailed day-by-day plan in seconds (hotels, activities, "
    "restaurants, tips included).\n"
    "3. Personalise & Book — swap activities, adjust days, and book flights, hotels, and tours through our "
    "partner integrations."
)

_PRICING_TRIGGER_RE = re.compile(
    r"\b(pricing|subscription|plans?\s+(?:cost|price)|free\s+plan|upgrade\s+(?:my\s+)?plan|cancel\s+my\s+(?:plan|subscription))\b",
    re.I,
)
_HOW_IT_WORKS_TRIGGER_RE = re.compile(
    r"\bhow\s+(?:does|do)\s+(?:this|it|travl\s*planr|the\s+app|the\s+site)\s+work\b|\bhow\s+it\s+works\b",
    re.I,
)
_STOP_WORDS = frozenset({"travl", "planr", "does", "what", "how", "about", "with", "your", "have", "this", "that"})


async def _build_platform_context(request: Request, message: str) -> str | None:
    """Ground platform-self questions (pricing, FAQ, how-it-works) in our own
    real content, instead of letting the model improvise about our product."""
    text = message.lower()
    sections: list[str] = []

    if _PRICING_TRIGGER_RE.search(text):
        sections.append(_PRICING_CONTEXT)
    if _HOW_IT_WORKS_TRIGGER_RE.search(text):
        sections.append(_HOW_IT_WORKS_CONTEXT)

    words = [w for w in re.findall(r"[a-z]{4,}", text) if w not in _STOP_WORDS]
    if words:
        try:
            async with request.app.state.session_factory() as session:
                or_clauses = [
                    or_(func.lower(FaqItem.question).like(f"%{w}%"), func.lower(FaqItem.answer).like(f"%{w}%"))
                    for w in words[:5]
                ]
                faq_rows = (
                    await session.execute(
                        select(FaqItem.question, FaqItem.answer).where(or_(*or_clauses)).limit(3)
                    )
                ).all()
                if faq_rows:
                    sections.append(
                        "Relevant FAQ entries:\n" + "\n".join(f"Q: {q}\nA: {a}" for q, a in faq_rows)
                    )
        except Exception as exc:
            logger.debug("Could not load FAQ context for chat grounding: %s", exc)

    if not sections:
        return None
    return "\n\n".join(sections)


async def _load_page_entity_context(request: Request, entity_type: str | None, entity_id: str | None) -> str | None:
    """When the user is on a specific package or blog post page (entity_type/
    entity_id come from page context), load that exact item so the assistant
    can answer questions about what's actually on screen."""
    if not entity_type or not entity_id:
        return None
    try:
        async with request.app.state.session_factory() as session:
            if entity_type == "package":
                row = (
                    await session.execute(
                        select(
                            Package.title, Package.days, Package.price,
                            Package.theme, Package.region, Package.budget_tier,
                        ).where(Package.id == entity_id)
                    )
                ).first()
                if not row:
                    return None
                title, days, price, theme, region, tier = row
                return (
                    "The user is viewing this exact package right now:\n"
                    f"- {title} ({region}): {days} days, ₹{price:,}, {theme}, {tier} tier."
                )
            if entity_type == "blog":
                row = (
                    await session.execute(
                        select(BlogPost.title, BlogPost.excerpt).where(BlogPost.slug == entity_id)
                    )
                ).first()
                if not row:
                    return None
                title, excerpt = row
                return f'The user is reading this blog post right now:\n- "{title}": {excerpt}'
    except Exception as exc:
        logger.debug("Could not load page entity context for chat grounding: %s", exc)
    return None


async def _get_explicit_preferences(request: Request, auth: dict | None) -> str | None:
    """Fetch explicit customer preferences from the identity service."""
    if not auth:
        return None
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    
    import os
    import httpx
    try:
        identity_url = os.environ.get("IDENTITY_URL", "http://identity:8000")
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{identity_url}/api/v1/me/preferences", headers={"Authorization": auth_header})
            if resp.status_code == 200:
                prefs = resp.json()
                explicit_parts = []
                if prefs.get("travelStyle"):
                    explicit_parts.append(f"explicit style: {prefs['travelStyle']}")
                if prefs.get("accommodation"):
                    explicit_parts.append(f"explicit accommodation: {prefs['accommodation']}")
                if prefs.get("transport"):
                    explicit_parts.append(f"explicit transport: {prefs['transport']}")
                if prefs.get("destinations"):
                    explicit_parts.append(f"explicit destinations: {', '.join(prefs['destinations'])}")
                if prefs.get("activities"):
                    explicit_parts.append(f"explicit activities: {', '.join(prefs['activities'])}")
                if prefs.get("dietary"):
                    explicit_parts.append(f"dietary restrictions: {', '.join(prefs['dietary'])}")
                if explicit_parts:
                    return "; ".join(explicit_parts)
    except Exception as e:
        logger.debug(f"Failed to fetch explicit preferences from identity: {e}")
    return None


def _dev_assistant_reply(message: str, customer_name: str) -> str:
    """Rule-based replies when no AI provider is available."""
    text = message.lower().strip()
    name = customer_name or "there"

    if re.search(r"\b(hi|hello|hey|heyy|howdy|good morning|good evening)\b", text):
        return (
            f"Hey {name}! I'm your Travl Planr assistant. "
            "Tell me where you'd like to go, or ask about destinations, budgets, or visas."
        )

    if re.search(r"\b(paris|france|europe|brussels|belgium|barcelona|madrid|rome|italy|dubai|bali|tokyo|thailand)\b", text):
        return (
            "Great choice! Browse curated packages on the Explore page, or open Start Planning "
            "to build a custom itinerary. Popular picks right now include Brussels, Paris, and Bali."
        )

    if re.search(r"\b(budget|price|cost|cheap|expensive|afford)\b", text):
        return (
            "We offer Budget, Standard, and Premium tiers. Open any package to see estimated costs, "
            "or use the wizard to set your budget before generating an itinerary."
        )

    if re.search(r"\b(visa|passport|document)\b", text):
        return (
            "Visa rules depend on your nationality and destination. "
            "Check your destination's embassy site for the latest requirements."
        )

    if re.search(r"\b(flight|hotel|car|train|itinerary|plan|trip)\b", text):
        return (
            "You can customize flights, hotels, cars, and activities on your itinerary page — "
            "tap Change on any item to swap it. Head to My Trips to see saved plans."
        )

    if re.search(r"\b(help|what can you do|how does this work)\b", text):
        return (
            "I can help you discover destinations, explain how planning works, and point you to packages. "
            "Try Explore for inspiration or Start Planning to build a trip in minutes."
        )

    days = extract_duration_days(message)
    if days and re.search(r"\b(package|filter|tour)\b", text):
        return (
            f"Got it — I'm showing {days}-day packages on the page now. "
            "You can also pick a destination like Dubai or Bali for more specific options."
        )

    if days and re.search(r"\b(trip|itinerar\w*|vacation|holiday)\b", text):
        dest = extract_destination(message)
        if not dest:
            guess = _guess_unrecognized_place(message)
            if guess:
                return (
                    f"I don't have \"{guess}\" as a supported destination yet, but I can build a draft AI itinerary. "
                    "Use the buttons below to create a draft, see similar places, or request we add it."
                )
            return "I couldn't tell which destination you meant — try naming a specific city or country."
        return (
            f"On it — I'm creating a {days}-day trip to {dest} and opening your itinerary now."
        )

    if re.search(r"\b(add|remove|delete)\b", text) and re.search(
        r"\b(activity|transport|train|bus|flight|car)\b", text
    ):
        return "Done — I've applied that change to your itinerary on the page."

    stripped = message.strip()
    words = stripped.split()
    if stripped and len(words) <= 6 and not extract_destination(stripped):
        shown = stripped[:60]
        return (
            f"I don't have \"{shown}\" in our curated list yet, {name}, but I can search the web for real "
            f"info about {shown} and build a draft itinerary — try \"plan a 4 day trip to {shown}\" or just send "
            f"the place name and hit Plan Trip."
        )

    return (
        f"Thanks for your message, {name}! I can help with destinations, packages, and itineraries. "
        "Try: make a 4 day trip to Dubai, add snorkeling on day 2, or remove food tasting."
    )


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatPageContext(BaseModel):
    path: str | None = None
    trip_id: str | None = None
    region: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    # Client already shows under-bar duration chips — skip asking again in text.
    collecting_duration: bool = False
    # UI locale (en/fr/es) so collection prompts match the localized chrome.
    locale: str | None = None
    # Client-confirmed trip slots ("Trip so far" row) — merge into server gather.
    known_slots: dict[str, Any] | None = None
    # What the app just did on the previous turn (client-reported) — keeps the model truthful.
    last_action_outcome: str | None = None


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = Field(default_factory=list)
    context: ChatPageContext | None = None


class ChatResponse(BaseModel):
    reply: str
    destination: str | None = None
    intent: str = "general"
    actions: list[dict] = Field(default_factory=list)
    suggested_actions: list[dict] = Field(default_factory=list)
    destination_tier: str | None = None
    images: list[dict] = Field(default_factory=list)
    weather: dict | None = None
    trip_slots: dict | None = None
    interaction_id: str | None = None
    provider: str | None = None
    # Silent page-status lines — shown as UI hints, not spliced into the bubble.
    ui_status: list[str] = Field(default_factory=list)


class ChatFeedbackRequest(BaseModel):
    interaction_id: str
    feedback: str  # up | down
    note: str | None = None


class ActivityOutcomeItem(BaseModel):
    city: str
    activity_title: str
    event_type: str  # suggested|kept|removed|swapped|booked
    budget_tier: str = "standard"
    day_number: int | None = None
    source: str = "chat"
    interaction_id: str | None = None


class ActivityOutcomesRequest(BaseModel):
    trip_id: str | None = None
    outcomes: list[ActivityOutcomeItem]


class ActivitySuggestionsRequest(BaseModel):
    trip_id: str
    day: int = Field(ge=1, le=60)
    count: int = Field(default=3, ge=1, le=8)
    existing_titles: list[str] = Field(default_factory=list)
    curated_candidates: list[dict] = Field(default_factory=list)


@router.post(
    "",
    response_model=ChatResponse,
    dependencies=[Depends(rate_limiter("chat", 20, 60))],
)
async def chat_with_assistant(
    body: ChatRequest,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Travel assistant — Groq / Gemini / Ollama (free) or Anthropic when configured."""
    try:
        return await _chat_with_assistant(body, auth, request)
    except Exception as exc:
        settings = request.app.state.settings
        if settings.environment.lower() not in {"development", "dev", "local", "test"}:
            raise exc
        logger.exception("chat request failed — using dev fallback")
        msg = body.message.strip() or "hello"
        customer_name = (auth or {}).get("customer_name", "traveler")
        supported_names, supported_by_id = await _load_supported_destinations(request)
        region = body.context.region if body.context else None
        history = [{"role": h.role, "content": h.content} for h in body.history if h.content.strip()]
        resolved = resolve_destination_with_history(
            msg,
            history,
            region=region,
            supported_names=supported_names,
            supported_by_id=supported_by_id,
        )
        destination = resolved.display_name or extract_destination(msg)
        intent = infer_intent(msg)
        all_actions = build_actions(
            msg,
            trip_id=body.context.trip_id if body.context else None,
            region=region,
            resolved=resolved,
            history=history,
            known_slots=body.context.known_slots if body.context else None,
        )
        auto_actions, suggested_actions = partition_chat_actions(all_actions)
        reply = _dev_assistant_reply(msg, customer_name)
        enriched = enrich_reply(
            reply,
            intent,
            destination,
            msg,
            resolved=resolved,
            auto_actions=auto_actions,
            history=history,
            region=region,
            skip_duration_prompt=bool(body.context and body.context.collecting_duration),
            locale=body.context.locale if body.context else None,
            known_slots=body.context.known_slots if body.context else None,
        )
        trip_slots = (
            slots_for_response(
                gather_trip_slots(
                    msg,
                    history=history,
                    region=region,
                    resolved=resolved,
                    known_slots=body.context.known_slots if body.context else None,
                )
            )
            if _should_emit_trip_slots(
                intent,
                msg,
                known_slots=body.context.known_slots if body.context else None,
                resolved=resolved,
            )
            else None
        )
        return {
            "reply": enriched.reply,
            "destination": destination,
            "intent": intent,
            "actions": auto_actions,
            "suggested_actions": suggested_actions,
            "destination_tier": resolved.tier if resolved else None,
            "images": [],
            "trip_slots": trip_slots,
            "weather": None,
            "ui_status": enriched.ui_status,
        }


async def _chat_with_assistant(body: ChatRequest, auth: dict | None, request: Request):
    import time as _time

    msg = body.message.strip()
    if not msg:
        return {"reply": "Please type a message and I'll do my best to help."}

    customer_name = (auth or {}).get("customer_name", "traveler")
    history = [{"role": h.role, "content": h.content} for h in body.history if h.content.strip()]
    trip_region = body.context.region if body.context else None
    catalog_context = await _build_catalog_context(request, msg, trip_region)
    page_context = _describe_page(body.context.path if body.context else None)
    trip_summary = await _load_trip_summary(request, body.context.trip_id if body.context else None)
    platform_context = await _build_platform_context(request, msg)
    entity_context = await _load_page_entity_context(
        request,
        body.context.entity_type if body.context else None,
        body.context.entity_id if body.context else None,
    )
    if entity_context:
        platform_context = f"{entity_context}\n\n{platform_context}" if platform_context else entity_context

    # T2.4 — inject customer travel profile into system prompt when logged in.
    travel_profile_context: str | None = None
    customer_id = _customer_uuid(auth)
    if customer_id:
        try:
            async with request.app.state.session_factory() as _ps:
                profile = await get_customer_travel_profile(_ps, customer_id)
                if profile:
                    parts: list[str] = []
                    if profile.preferred_pace:
                        parts.append(f"preferred pace: {profile.preferred_pace}")
                    if profile.typical_budget_tier:
                        parts.append(f"budget tier: {profile.typical_budget_tier}")
                    if profile.interests:
                        parts.append(f"interests: {', '.join(profile.interests)}")
                    if profile.avoided_types:
                        parts.append(f"avoids: {', '.join(profile.avoided_types[:6])}")
                    if parts:
                        travel_profile_context = "; ".join(parts)
        except Exception:
            logger.debug("could not load travel profile for chat", exc_info=True)

        # Merge with explicit preferences from identity
        explicit_prefs = await _get_explicit_preferences(request, auth)
        if explicit_prefs:
            if travel_profile_context:
                travel_profile_context += f" | {explicit_prefs}"
            else:
                travel_profile_context = explicit_prefs

    _t0 = _time.monotonic()
    reply, provider = await generate_reply(
        msg,
        customer_name,
        history=history,
        trip_destination=trip_region,
        catalog_context=catalog_context,
        travel_profile_context=travel_profile_context,
        page_context=page_context,
        trip_summary=trip_summary,
        platform_context=platform_context,
        known_slots=body.context.known_slots if body.context else None,
        last_action_outcome=body.context.last_action_outcome if body.context else None,
    )
    llm_latency_ms = round((_time.monotonic() - _t0) * 1000)

    if provider == "dev" or not reply:
        logger.info("chat using dev assistant fallback")
        reply = _dev_assistant_reply(msg, customer_name)
    else:
        logger.info("chat reply via provider=%s latency_ms=%d", provider, llm_latency_ms)

    return await _finalize_chat(
        msg, reply, body, auth, request,
        history=history, provider=provider, llm_latency_ms=llm_latency_ms
    )


async def _finalize_chat(
    msg: str,
    reply: str,
    body: ChatRequest,
    auth: dict | None,
    request: Request,
    *,
    history: list[dict[str, str]],
    provider: str | None = None,
    llm_latency_ms: int | None = None,
) -> dict:
    """Everything downstream of the LLM reply: intent/action extraction,
    slot filling, weather/images, reply enrichment. Shared by the blocking
    and streaming chat endpoints."""
    import time as _time

    trip_id = body.context.trip_id if body.context else None
    region = body.context.region if body.context else None
    supported_names, supported_by_id = await _load_supported_destinations(request)

    # T2.1 — LLM-first router: one combined intent+slot call via local Qwen.
    # On failure the regex cascade below provides identical behaviour.
    llm_route_intent: str | None = None
    llm_hints: dict | None = None
    _t0 = _time.monotonic()
    try:
        llm_route = await route_intent_and_slots(msg, history)
        if llm_route:
            llm_route_intent = llm_route.pop("intent", None)
            if llm_route:
                llm_hints = llm_route
    except Exception:
        logger.debug("llm_intent_router raised unexpectedly", exc_info=True)

    regex_intent = infer_intent(msg)
    # Fall back to separate slot extraction only when the router didn't fire.
    if llm_hints is None and _looks_trip_shaped(msg, regex_intent):
        llm_hints = await extract_slots_via_llm(msg, history)

    resolved = resolve_destination_with_history(
        msg,
        history,
        region=region,
        supported_names=supported_names,
        supported_by_id=supported_by_id,
        llm_destination_hint=(llm_hints or {}).get("destination"),
    )
    destination = resolved.display_name or extract_destination(msg) or region

    # T2.1: prefer the router's combined classification when available; the
    # router already won a slot call so we skip the upgrade heuristic below.
    if llm_route_intent:
        intent = llm_route_intent
    else:
        intent = regex_intent
        if intent == "general" and llm_hints and (llm_hints.get("destination") or llm_hints.get("duration_days")):
            intent = "create_trip"

    # Follow-ups that finish collecting slots ("3 days", "just my wife") must
    # promote to create_trip so actions + Trip-so-far chips stay in sync —
    # including when the LLM router mislabels the turn.
    if intent not in {
        "create_trip",
        "group_trip",
        "show_itinerary",
        "multi_city_trip",
        "modify_itinerary",
        "fix_itinerary",
        "book_trip",
        "book_package",
    }:
        from app.services.trip_planning_slots import (
            gather_trip_slots,
            message_advances_planning_slots,
            ready_to_auto_create,
        )

        if message_advances_planning_slots(msg):
            preview = gather_trip_slots(
                msg,
                history=history,
                region=region,
                resolved=resolved,
                llm_hints=llm_hints,
                known_slots=body.context.known_slots if body.context else None,
            )
            if ready_to_auto_create(preview):
                intent = "create_trip"
    all_actions = build_actions(
        msg,
        trip_id=trip_id,
        region=region,
        resolved=resolved,
        history=history,
        llm_hints=llm_hints,
        intent_override=intent,
        known_slots=body.context.known_slots if body.context else None,
    )
    auto_actions, suggested_actions = partition_chat_actions(all_actions)
    edits = parse_itinerary_edits(msg)

    # Shadow LLM edit extraction — log what the model would have returned even
    # when regex already parsed the message, for weekly parser promotion / eval.
    shadow_llm_edits: list[dict] | None = None
    if _looks_edit_shaped(msg):
        try:
            shadow_llm_edits = await extract_edit_via_llm(msg, destination=destination, history=history)
        except Exception:
            logger.debug("shadow llm edit extraction failed", exc_info=True)

    # Fallback layer: when the deterministic parser found no edit but the user
    # is on an open itinerary and the message reads like an edit, ask the LLM
    # to structure it. Its output is normalized into the same edit dicts, so
    # the frontend applies it identically — and generic asks still become
    # curated bulk suggestions, never a card titled with the raw command.
    llm_edit_used = False
    if not edits and trip_id and regex_intent in {"general", "modify_itinerary"} and _looks_edit_shaped(msg):
        llm_edits = await extract_edit_via_llm(msg, destination=destination, history=history)
        if llm_edits:
            edits = llm_edits
            llm_edit_used = True
            intent = "modify_itinerary"
            for edit in llm_edits:
                auto_actions.append({"type": "itinerary_edit", **edit, "tripId": trip_id})

    bulk_edit = next((e for e in edits if e.get("autoSuggest") and e.get("count")), None)
    ui_status: list[str] = []
    if bulk_edit:
        count = bulk_edit.get("count", 1)
        day_num = bulk_edit.get("day", 1)
        dest = region or destination or "your trip"
        ui_status.append(f"Adding {count} activities to day {day_num} · {dest}")
        # Keep the model's voice; don't replace the bubble with a scripted claim.
        reply = reply or f"Adding {count} options to day {day_num}."
    elif llm_edit_used:
        ui_status.append("Itinerary updated")
        reply = reply or _edit_confirmation_reply(edits[0])
    else:
        enriched = enrich_reply(
            reply,
            intent,
            destination,
            msg,
            resolved=resolved,
            auto_actions=auto_actions,
            history=history,
            region=region,
            llm_hints=llm_hints,
            skip_duration_prompt=bool(body.context and body.context.collecting_duration),
            locale=body.context.locale if body.context else None,
            known_slots=body.context.known_slots if body.context else None,
        )
        reply = enriched.reply
        ui_status.extend(enriched.ui_status)

    images: list[dict] = []
    weather_data = None

    if intent == "show_images":
        redis = getattr(request.app.state, "redis", None)
        images = await search_images_async(msg, destination, redis=redis)

    # Checked against regex_intent, not the (possibly LLM-promoted) intent —
    # trip-creation promotion and a weather lookup are independent concerns,
    # and a message can legitimately trigger both.
    if regex_intent in {"weather_query", "general"} and re.search(
        r"\b(weather|temperature|rain|forecast|climate|season|good\s+in\s+\w+|best\s+time(?:\s+to\s+visit)?|when\s+to\s+visit)\b",
        msg.lower(),
    ):
        weather_data = await fetch_weather_summary(destination)
        weather_text = format_weather_for_reply(weather_data)
        if weather_text:
            reply = f"{reply.rstrip()} {weather_text}"

    if intent == "show_images" and images:
        for img_action in auto_actions:
            if img_action.get("type") == "show_images":
                img_action["images"] = images

    trip_slots = None
    known = body.context.known_slots if body.context else None
    if _should_emit_trip_slots(intent, msg, known_slots=known, resolved=resolved):
        trip_slots = slots_for_response(
            gather_trip_slots(
                msg,
                history=history,
                region=region,
                resolved=resolved,
                llm_hints=llm_hints,
                known_slots=known,
            )
        )

    interaction_id: str | None = None
    try:
        customer_name = (auth or {}).get("customer_name", "traveler")
        from app.services.chat_providers import build_system_prompt

        async with request.app.state.session_factory() as session:
            await ensure_active_prompt_version(
                session, build_system_prompt(customer_name, trip_destination=region)
            )
            interaction = await record_chat_interaction(
                session,
                auth=auth,
                user_message=msg,
                assistant_reply=reply,
                trip_id=trip_id,
                page_path=body.context.path if body.context else None,
                region=region,
                regex_intent=regex_intent,
                final_intent=intent,
                provider=provider,
                parsed_edits=edits,
                actions_emitted=auto_actions,
                llm_hints=llm_hints,
                llm_edit_used=llm_edit_used,
                shadow_llm_edits=shadow_llm_edits,
                llm_latency_ms=llm_latency_ms,
            )
            await session.commit()
            interaction_id = str(interaction.id)
    except Exception:
        logger.warning("failed to persist chat interaction", exc_info=True)

    return {
        "reply": reply,
        "destination": destination,
        "intent": intent,
        "actions": auto_actions,
        "suggested_actions": suggested_actions,
        "destination_tier": resolved.tier if resolved else None,
        "images": images,
        "trip_slots": trip_slots,
        "weather": weather_data,
        "interaction_id": interaction_id,
        "provider": provider,
        "ui_status": ui_status,
    }


@router.post("/stream", dependencies=[Depends(rate_limiter("chat", 20, 60))])
async def chat_with_assistant_stream(
    body: ChatRequest,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Streaming variant of the chat endpoint. Emits newline-delimited JSON:
    {"type":"token","text":...} chunks as the model generates, an optional
    {"type":"replace","text":...} if post-processing rewrote the reply, then
    {"type":"meta","data":<ChatResponse>} with actions/slots/images."""

    def line(obj: dict) -> str:
        return json.dumps(obj, ensure_ascii=False) + "\n"

    async def generate():
        msg = body.message.strip()
        customer_name = (auth or {}).get("customer_name", "traveler")
        if not msg:
            yield line({"type": "meta", "data": {"reply": "Please type a message and I'll do my best to help."}})
            return

        import time as _time

        history = [{"role": h.role, "content": h.content} for h in body.history if h.content.strip()]
        trip_region = body.context.region if body.context else None
        page_context = _describe_page(body.context.path if body.context else None)
        trip_summary = await _load_trip_summary(request, body.context.trip_id if body.context else None)
        platform_context = await _build_platform_context(request, msg)
        entity_context = await _load_page_entity_context(
            request,
            body.context.entity_type if body.context else None,
            body.context.entity_id if body.context else None,
        )
        if entity_context:
            platform_context = f"{entity_context}\n\n{platform_context}" if platform_context else entity_context
        raw = ""
        final: dict | None = None
        stream_provider: str | None = None
        # T2.4: load travel profile for system prompt personalisation.
        travel_profile_context: str | None = None
        customer_id = _customer_uuid(auth)
        if customer_id:
            try:
                async with request.app.state.session_factory() as _ps:
                    profile = await get_customer_travel_profile(_ps, customer_id)
                    if profile:
                        _parts: list[str] = []
                        if profile.preferred_pace:
                            _parts.append(f"preferred pace: {profile.preferred_pace}")
                        if profile.typical_budget_tier:
                            _parts.append(f"budget tier: {profile.typical_budget_tier}")
                        if profile.interests:
                            _parts.append(f"interests: {', '.join(profile.interests)}")
                        if profile.avoided_types:
                            _parts.append(f"avoids: {', '.join(profile.avoided_types[:6])}")
                        if _parts:
                            travel_profile_context = "; ".join(_parts)
            except Exception:
                logger.debug("could not load travel profile for stream chat", exc_info=True)

            # Merge with explicit preferences from identity
            explicit_prefs = await _get_explicit_preferences(request, auth)
            if explicit_prefs:
                if travel_profile_context:
                    travel_profile_context += f" | {explicit_prefs}"
                else:
                    travel_profile_context = explicit_prefs

        _t0_stream = _time.monotonic()
        try:
            catalog_context = await _build_catalog_context(request, msg, trip_region)
            async for kind, value in generate_reply_stream(
                msg,
                customer_name,
                history=history,
                trip_destination=trip_region,
                catalog_context=catalog_context,
                travel_profile_context=travel_profile_context,
                page_context=page_context,
                trip_summary=trip_summary,
                platform_context=platform_context,
                known_slots=body.context.known_slots if body.context else None,
                last_action_outcome=body.context.last_action_outcome if body.context else None,
            ):
                if kind == "provider":
                    stream_provider = value
                    logger.info("chat stream reply via provider=%s", value)
                elif kind == "token":
                    raw += value
                    yield line({"type": "token", "text": value})
            stream_latency_ms = round((_time.monotonic() - _t0_stream) * 1000)
            if not raw.strip():
                raw = _dev_assistant_reply(msg, customer_name)
                yield line({"type": "token", "text": raw})
            final = await _finalize_chat(
                msg, raw, body, auth, request,
                history=history, provider=stream_provider or "dev",
                llm_latency_ms=stream_latency_ms,
            )
        except Exception as exc:
            settings = request.app.state.settings
            if settings.environment.lower() not in {"development", "dev", "local", "test"}:
                logger.error("Production chat stream error", exc_info=exc)
                yield line({"type": "error", "message": "Assistant unavailable"})
                return
            logger.exception("chat stream failed — degrading to dev reply")
            if not raw.strip():
                raw = _dev_assistant_reply(msg, customer_name)
                yield line({"type": "token", "text": raw})
            final = {
                "reply": raw,
                "destination": None,
                "intent": "general",
                "actions": [],
                "suggested_actions": [],
                "destination_tier": None,
                "images": [],
                "trip_slots": None,
                "weather": None,
            }

        final_reply = str(final.get("reply") or raw)
        if final_reply != raw:
            # Enrichment usually appends (weather line, coverage notes) — send
            # just the suffix so the visible text never flickers; anything
            # else (e.g. the bulk-edit rewrite) replaces the bubble wholesale.
            base = raw.rstrip()
            if base and final_reply.startswith(base):
                yield line({"type": "token", "text": final_reply[len(base):]})
            elif final_reply.startswith(raw):
                yield line({"type": "token", "text": final_reply[len(raw):]})
            else:
                yield line({"type": "replace", "text": final_reply})
        yield line({"type": "meta", "data": final})

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        # nginx (our gateway) buffers proxied responses by default, which
        # would turn this stream back into one blob — this header disables
        # that per-response.
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@router.post("/feedback", dependencies=[Depends(rate_limiter("chat-feedback", 30, 300))])
async def submit_feedback(body: ChatFeedbackRequest, request: Request, auth: dict = Depends(require_customer)):
    """Record thumbs up/down on an assistant reply for the learning flywheel."""
    try:
        interaction_uuid = uuid.UUID(body.interaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interaction_id")
    if body.feedback not in {"up", "down"}:
        raise HTTPException(status_code=400, detail="feedback must be 'up' or 'down'")
    async with request.app.state.session_factory() as session:
        ok = await submit_chat_feedback(
            session,
            interaction_id=interaction_uuid,
            customer_id=_customer_uuid(auth),
            feedback=body.feedback,
            note=body.note,
        )
        if not ok:
            raise HTTPException(status_code=404, detail="Interaction not found")
        await session.commit()
    return {"status": "recorded"}


@router.post("/outcomes", dependencies=[Depends(rate_limiter("chat-outcomes", 60, 300))])
async def record_outcomes(body: ActivityOutcomesRequest, request: Request, auth: dict = Depends(require_customer)):
    """Batch implicit learning signals from itinerary UI (kept/removed/swapped/booked)."""
    async with request.app.state.session_factory() as session:
        for item in body.outcomes:
            iid = None
            if item.interaction_id:
                try:
                    iid = uuid.UUID(item.interaction_id)
                except ValueError:
                    iid = None
            await record_activity_outcome(
                session,
                auth=auth,
                city=item.city,
                activity_title=item.activity_title,
                event_type=item.event_type,
                budget_tier=item.budget_tier,
                trip_id=body.trip_id,
                interaction_id=iid,
                day_number=item.day_number,
                source=item.source,
            )
        await session.commit()
    return {"status": "recorded", "count": len(body.outcomes)}


@router.post("/activity-suggestions", dependencies=[Depends(rate_limiter("chat-suggest", 30, 60))])
async def activity_suggestions(
    body: ActivitySuggestionsRequest,
    request: Request,
    auth: dict = Depends(require_customer),
):
    """Ranked activity suggestions — inventory + curated + RAG + acceptance stats."""
    customer_id = _customer_uuid(auth)
    try:
        trip_uuid = uuid.UUID(body.trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip_id")

    async with request.app.state.session_factory() as session:
        trip = await session.get(Trip, trip_uuid)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if customer_id and trip.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="Not your trip")

        city = _city_for_day(trip, body.day)
        inventory_rows = await _run_search(
            session,
            item_type="activity",
            location=city,
            dep=None,
            arr=None,
            date=None,
            budget=trip.budget,
            limit=20,
        )
        inventory = [
            {
                "title": row.title,
                "duration": (row.metadata_json or {}).get("duration") or "2 hours",
                "price": float(row.price_amount or 0),
                "image": row.image_url,
            }
            for row in inventory_rows
        ]

        profile = await get_customer_travel_profile(session, customer_id) if customer_id else None
        kept = None
        avoided = None
        if profile:
            kept = (profile.kept_activities_by_city or {}).get(city)
            avoided = profile.avoided_types

        ranked = await build_ranked_activity_suggestions(
            session,
            trip=trip,
            day=body.day,
            count=body.count,
            inventory_results=inventory,
            curated=body.curated_candidates,
            existing_titles={t.lower() for t in body.existing_titles},
            profile_kept=kept,
            profile_avoided=avoided,
        )
        return {"city": city, "day": body.day, "suggestions": ranked}

