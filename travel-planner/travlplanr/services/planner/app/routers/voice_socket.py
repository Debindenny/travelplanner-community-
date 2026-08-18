from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from shared.auth_dependencies import decode_websocket_customer_token

from app.services.chat_providers import generate_reply, generate_reply_stream, transcribe_audio

import logging

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_BUFFER_BYTES = 15 * 1024 * 1024  # 15MB per utterance — bounds memory/cost per connection
MAX_TRANSCRIPT_CHARS = 4000  # bounds what an unvalidated transcript can inject into the LLM prompt
MAX_UTTERANCES_PER_CONNECTION = 30


async def _reject_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)


@router.websocket("/stream")
async def websocket_voice_endpoint(websocket: WebSocket):
    """
    Streaming voice endpoint (authenticated).

    Protocol (additive — old clients that ignore unknown event types still work):
      Client → server:
        binary frames  — raw audio chunks
        text "end"     — marks end of utterance; triggers transcription + reply

      Server → client (JSON frames):
        {"type": "transcript", "text": str}       — partial/final transcript
        {"type": "token", "text": str}             — streamed reply token (T2.6)
        {"type": "reply", "transcript": str,       — final reply (backwards compat)
         "text": str, "provider": str}
        {"type": "error", "detail": str}

    Old clients that only handle "reply" and "error" frames continue to work
    because they ignore the new "transcript" and "token" types.
    """
    payload = await decode_websocket_customer_token(websocket)
    if not payload:
        await _reject_websocket(websocket)
        return

    customer_name = payload.get("customer_name", "traveler")
    await websocket.accept()
    logger.info("Client connected to voice stream")
    buffer = bytearray()
    history: list[dict[str, str]] = []
    utterance_count = 0
    # T2.6: streaming enabled by default; client can opt-out by sending
    # {"type": "config", "stream_tokens": false} before the first utterance.
    stream_tokens = True
    try:
        while True:
            message = await websocket.receive()
            if message.get("bytes") is not None:
                if len(buffer) + len(message["bytes"]) > MAX_BUFFER_BYTES:
                    await websocket.send_json({
                        "type": "error",
                        "detail": "Audio utterance is too large.",
                    })
                    buffer.clear()
                    continue
                buffer.extend(message["bytes"])
                continue

            text = message.get("text")
            if text is None:
                continue

            # T2.6: optional config frame to disable token streaming
            if text.strip().startswith("{"):
                try:
                    import json as _json
                    cfg = _json.loads(text)
                    if cfg.get("type") == "config":
                        stream_tokens = bool(cfg.get("stream_tokens", True))
                except Exception:
                    pass
                continue

            if text.strip().lower() != "end" or not buffer:
                continue

            if utterance_count >= MAX_UTTERANCES_PER_CONNECTION:
                await websocket.send_json({
                    "type": "error",
                    "detail": "This voice session has reached its message limit — please reconnect.",
                })
                break
            utterance_count += 1

            audio_bytes = bytes(buffer)
            buffer.clear()

            try:
                transcript = await transcribe_audio(audio_bytes, "chunk.webm", "audio/webm")
            except Exception as exc:
                logger.error("Voice stream transcription failed: %s", exc)
                transcript = None

            if not transcript:
                await websocket.send_json({
                    "type": "error",
                    "detail": "Could not transcribe audio — no speech-to-text provider configured or the request failed.",
                })
                continue

            transcript = transcript[:MAX_TRANSCRIPT_CHARS]
            # Send the final transcript so clients can display what was heard.
            await websocket.send_json({"type": "transcript", "text": transcript})

            reply_text = ""
            provider = "dev"

            if stream_tokens:
                # T2.6: stream reply tokens as they arrive.
                try:
                    async for kind, value in generate_reply_stream(
                        transcript, customer_name, history=history
                    ):
                        if kind == "provider":
                            provider = value
                        elif kind == "token":
                            reply_text += value
                            await websocket.send_json({"type": "token", "text": value})
                except Exception as exc:
                    logger.warning("Voice stream token streaming failed, falling back: %s", exc)
                    reply_text = ""

            if not reply_text:
                # Fallback to non-streaming path.
                reply_text, provider = await generate_reply(transcript, customer_name, history=history)

            history.append({"role": "user", "content": transcript})
            if reply_text:
                history.append({"role": "assistant", "content": reply_text})

            # Always emit the "reply" frame for backwards compatibility.
            await websocket.send_json({
                "type": "reply",
                "transcript": transcript,
                "text": reply_text,
                "provider": provider,
            })

    except WebSocketDisconnect:
        logger.info("Client disconnected from voice stream")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
