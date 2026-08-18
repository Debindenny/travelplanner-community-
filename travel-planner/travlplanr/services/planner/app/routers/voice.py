import logging
import os
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from shared.auth_dependencies import require_customer
from shared.rate_limit import rate_limiter

from app.models.communications import ChatSession, ChatMessage
from app.routers.chat import _chat_with_assistant, ChatRequest, HistoryMessage, ChatPageContext
from app.services.chat_providers import transcribe_audio

logger = logging.getLogger(__name__)
router = APIRouter()

AUDIO_UPLOAD_DIR = "app/static/uploads/audio"
MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15MB — bounds cost/DoS exposure on the paid Whisper call
MAX_TRANSCRIPT_CHARS = 4000  # bounds what an unvalidated transcript can inject into the LLM prompt
MAX_AUDIO_AGE_SECONDS = 24 * 3600  # uploaded clips are transient chat artifacts, not durable storage


def _prune_stale_audio() -> None:
    """Uploads otherwise accumulate forever — nothing else ever deletes them."""
    try:
        cutoff = time.time() - MAX_AUDIO_AGE_SECONDS
        with os.scandir(AUDIO_UPLOAD_DIR) as entries:
            for entry in entries:
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    os.unlink(entry.path)
    except FileNotFoundError:
        pass
    except Exception:
        logger.warning("Could not prune stale audio uploads", exc_info=True)

@router.post("/message", dependencies=[Depends(rate_limiter("voice", 15, 60))])
async def process_voice_message(
    request: Request,
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    trip_id: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    path: Optional[str] = Form(None),
    collecting_duration: Optional[str] = Form(None),
    locale: Optional[str] = Form(None),
    known_slots: Optional[str] = Form(None),
    history: Optional[str] = Form(None),
    auth: dict = Depends(require_customer),
):
    """
    Accepts an audio recording from the user, transcribes it, 
    passes it to the assistant, and returns a text reply 
    along with an optional TTS audio_url.
    """
    # 1. Persist the uploaded audio and expose it via the static file mount.
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio recording is too large.")
    ext = os.path.splitext(audio.filename or "")[1] or ".webm"
    stored_filename = f"{uuid.uuid4()}{ext}"
    os.makedirs(AUDIO_UPLOAD_DIR, exist_ok=True)
    _prune_stale_audio()
    with open(os.path.join(AUDIO_UPLOAD_DIR, stored_filename), "wb") as f:
        f.write(audio_bytes)
    audio_url = f"/api/v1/static/uploads/audio/{stored_filename}"

    # 2. Transcribe the audio via Groq's hosted Whisper endpoint.
    try:
        transcript = await transcribe_audio(audio_bytes, stored_filename, audio.content_type)
    except Exception as exc:
        logger.error(f"Voice transcription failed: {exc}")
        transcript = None
    if not transcript:
        raise HTTPException(
            status_code=502,
            detail=(
                "Voice-to-text isn't available in this browser and no speech-to-text "
                "provider is configured on the server."
            ),
        )
    transcript = transcript[:MAX_TRANSCRIPT_CHARS]
    logger.info(f"Transcribed voice message ({len(transcript)} chars)")

    # Prefer client chat history (same memory as typed chat) when provided.
    client_history: list[HistoryMessage] = []
    if history:
        try:
            import json as _json
            raw = _json.loads(history)
            if isinstance(raw, list):
                for turn in raw[-20:]:
                    if isinstance(turn, dict) and turn.get("content"):
                        client_history.append(
                            HistoryMessage(
                                role=str(turn.get("role") or "user"),
                                content=str(turn["content"])[:4000],
                            )
                        )
        except Exception:
            logger.debug("Could not parse client voice history", exc_info=True)

    known_slots_dict = None
    if known_slots:
        try:
            import json as _json
            parsed = _json.loads(known_slots)
            if isinstance(parsed, dict):
                known_slots_dict = parsed
        except Exception:
            logger.debug("Could not parse known_slots", exc_info=True)

    # 3. Create or fetch ChatSession
    customer_id = uuid.UUID(auth["customer_id"])
    
    async with request.app.state.session_factory() as db:
        chat_session = None
        if session_id and customer_id:
            try:
                sid = uuid.UUID(session_id)
                chat_session = (await db.execute(
                    select(ChatSession).where(
                        ChatSession.id == sid,
                        ChatSession.customer_id == customer_id,
                    )
                )).scalar_one_or_none()
            except ValueError:
                pass
                
        if not chat_session:
            chat_session = ChatSession(
                customer_id=customer_id,
                trip_id=uuid.UUID(trip_id) if trip_id else None
            )
            db.add(chat_session)
            await db.flush()

        # 4. Save user message to DB
        user_msg = ChatMessage(
            session_id=chat_session.id,
            sender="user",
            content_type="audio",
            text_content=transcript,
            audio_url=audio_url,
        )
        db.add(user_msg)
        await db.commit()

        # 5. History: client thread wins; fall back to DB session history.
        history_msgs = client_history
        if not history_msgs:
            history_records = (await db.execute(
                select(ChatMessage).where(ChatMessage.session_id == chat_session.id).order_by(ChatMessage.created_at)
            )).scalars().all()
            for rec in history_records:
                history_msgs.append(HistoryMessage(role=rec.sender, content=rec.text_content or ""))

        # 6. Call the existing Chat Assistant logic with the same context as typed chat.
        chat_req = ChatRequest(
            message=transcript,
            history=history_msgs,
            context=ChatPageContext(
                trip_id=trip_id,
                region=region,
                path=path,
                collecting_duration=str(collecting_duration or "").lower() in {"1", "true", "yes"},
                locale=locale,
                known_slots=known_slots_dict,
            ),
        )
        assistant_res = await _chat_with_assistant(chat_req, auth, request)

        # 7. No TTS provider is configured, so the assistant reply stays text-only.
        reply_audio_url = None

        # 8. Save assistant reply to DB
        assistant_msg = ChatMessage(
            session_id=chat_session.id,
            sender="assistant",
            content_type="audio",
            text_content=assistant_res["reply"],
            audio_url=reply_audio_url
        )
        db.add(assistant_msg)
        await db.commit()

        return {
            "reply": assistant_res["reply"],
            "destination": assistant_res.get("destination"),
            "intent": assistant_res.get("intent"),
            "actions": assistant_res.get("actions", []),
            "suggested_actions": assistant_res.get("suggested_actions", []),
            "destination_tier": assistant_res.get("destination_tier"),
            "images": assistant_res.get("images", []),
            "weather": assistant_res.get("weather"),
            "trip_slots": assistant_res.get("trip_slots"),
            "interaction_id": assistant_res.get("interaction_id"),
            "audio_url": reply_audio_url,
            "transcript": transcript,
            "session_id": str(chat_session.id)
        }
