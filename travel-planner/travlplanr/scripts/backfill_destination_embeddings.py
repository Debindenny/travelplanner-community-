"""One-off backfill: compute pgvector embeddings for destinations that
predate the `destinations.embedding` column (migration 0017).

New destinations self-heal via the lazy backfill in
services/planner/app/routers/destinations.py, so this only needs to run
once after the migration lands. Run inside the planner container, where
DATABASE_URL and the sentence-transformers model are already available:

    docker compose exec planner python -m scripts.backfill_destination_embeddings
"""
import asyncio
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.destinations import Destination
from app.services.embedding_service import destination_embedding_text, generate_embedding


async def main():
    database_url = os.environ["DATABASE_URL"]
    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        rows = (
            await session.execute(select(Destination).where(Destination.embedding.is_(None)))
        ).scalars().all()
        print(f"{len(rows)} destinations missing embeddings")
        for dest in rows:
            text = destination_embedding_text(dest.name, dest.region, dest.description, dest.tags)
            vector = await generate_embedding(text)
            if vector:
                dest.embedding = vector
        await session.commit()
        print("Backfill completed successfully.")


if __name__ == "__main__":
    asyncio.run(main())
