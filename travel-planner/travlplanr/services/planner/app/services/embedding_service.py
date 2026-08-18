import logging
import asyncio
import hashlib
import time
from collections import OrderedDict
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_model = None

# T3.2 — in-memory embedding cache (text hash → vector, TTL 15 min).
# Uses an OrderedDict LRU-style eviction at 2048 entries so memory is bounded.
_EMBEDDING_CACHE: OrderedDict[str, tuple[list[float], float]] = OrderedDict()
_EMBEDDING_CACHE_TTL = float(__import__("os").environ.get("EMBEDDING_CACHE_TTL_SECONDS", "900"))
_EMBEDDING_CACHE_MAX = 2048


def _embedding_cache_key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:24]


def _get_cached_embedding(key: str) -> list[float] | None:
    entry = _EMBEDDING_CACHE.get(key)
    if entry is None:
        return None
    vector, ts = entry
    if time.monotonic() - ts > _EMBEDDING_CACHE_TTL:
        _EMBEDDING_CACHE.pop(key, None)
        return None
    _EMBEDDING_CACHE.move_to_end(key)
    return vector


def _set_cached_embedding(key: str, vector: list[float]) -> None:
    if key in _EMBEDDING_CACHE:
        _EMBEDDING_CACHE.move_to_end(key)
    _EMBEDDING_CACHE[key] = (vector, time.monotonic())
    while len(_EMBEDDING_CACHE) > _EMBEDDING_CACHE_MAX:
        _EMBEDDING_CACHE.popitem(last=False)

def get_embedding_model():
    global _model
    if _model is None:
        try:
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as e:
            logger.error(f"Failed to load sentence transformer model: {e}")
    return _model

def destination_embedding_text(name: str, region: str, description: str | None, tags: list[str] | None) -> str:
    parts = [name, region, description or "", ", ".join(tags or [])]
    return " — ".join(p for p in parts if p)


async def generate_embedding(text: str) -> list[float] | None:
    key = _embedding_cache_key(text)
    cached = _get_cached_embedding(key)
    if cached is not None:
        return cached

    model = get_embedding_model()
    if not model:
        return None
    try:
        vector = await asyncio.to_thread(model.encode, text)
        result = vector.tolist()
        _set_cached_embedding(key, result)
        return result
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return None
