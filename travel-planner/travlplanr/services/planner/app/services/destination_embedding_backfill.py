"""Background job: embed destinations that lack vectors.

Moved out of GET /destinations so list requests never block on MiniLM encode
or risk double-embedding under concurrency.
"""

from __future__ import annotations

import asyncio
import logging
import os

from sqlalchemy import select

from app.models.destinations import Destination
from app.services.embedding_service import destination_embedding_text, generate_embedding

logger = logging.getLogger(__name__)

BACKFILL_INTERVAL = float(os.environ.get("DESTINATION_EMBED_BACKFILL_SECONDS", "120"))
BACKFILL_BATCH = int(os.environ.get("DESTINATION_EMBED_BACKFILL_BATCH", "25"))


async def backfill_destination_embeddings_once(session_factory) -> int:
    """Embed up to BACKFILL_BATCH destinations missing embeddings. Returns count."""
    async with session_factory() as session:
        result = await session.execute(
            select(Destination)
            .where(Destination.embedding.is_(None))
            .order_by(Destination.name)
            .limit(BACKFILL_BATCH)
            .with_for_update(skip_locked=True)
        )
        dests = list(result.scalars().all())
        if not dests:
            return 0

        filled = 0
        for dest in dests:
            text = destination_embedding_text(dest.name, dest.region, dest.description, dest.tags)
            vector = await generate_embedding(text)
            if vector:
                dest.embedding = vector
                filled += 1
        if filled:
            await session.commit()
        return filled


async def run_destination_embedding_backfill(session_factory) -> None:
    """Periodic loop started from planner lifespan."""
    if BACKFILL_INTERVAL <= 0:
        return
    # Small delay so boot isn't competing with model load.
    await asyncio.sleep(15)
    while True:
        try:
            n = await backfill_destination_embeddings_once(session_factory)
            if n:
                logger.info("destination embedding backfill wrote %s rows", n)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("destination embedding backfill failed")
        await asyncio.sleep(BACKFILL_INTERVAL)
