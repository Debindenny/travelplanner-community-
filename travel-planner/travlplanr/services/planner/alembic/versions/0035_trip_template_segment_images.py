"""Backfill missing images on the 4 seeded trip-template segments

Revision ID: 0035_template_seg_images
Revises: 0034_trip_templates
Create Date: 2026-09-08 00:00:00.000000

0034_trip_templates seeded activity/hotel/train/flight segments without an
`image`/`imageUrl` field — the itinerary page renders each activity card's
image directly from `segment.image` (see itinerary-page.component.html,
`<img [src]="act.image">`), so every activity card on these 4 templates was
rendering a broken image. Backfills each segment missing that field with the
trip's own hero image rather than re-seeding all segment content.
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0035_template_seg_images'
down_revision: Union[str, Sequence[str], None] = '0034_trip_templates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TRIP_IMAGES = {
    '20000000-0000-0000-0000-000000000001': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80',
    '20000000-0000-0000-0000-000000000002': 'https://images.unsplash.com/photo-1503756234508-e32d1769ee16?auto=format&fit=crop&w=900&q=80',
    '20000000-0000-0000-0000-000000000003': 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
    '20000000-0000-0000-0000-000000000004': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80',
}

UPDATE_SQL = sa.text("""
    UPDATE trips
    SET segments = (
        SELECT jsonb_agg(
            CASE
                WHEN elem->>'type' = 'activity' AND NOT (elem ? 'image')
                    THEN elem || jsonb_build_object('image', CAST(:image AS text))
                WHEN elem->>'type' IN ('hotel', 'car', 'train', 'flight', 'bus') AND NOT (elem ? 'imageUrl')
                    THEN elem || jsonb_build_object('imageUrl', CAST(:image AS text))
                ELSE elem
            END
        )
        FROM jsonb_array_elements(segments) AS elem
    )
    WHERE id = :id AND is_template = true
""")


def upgrade() -> None:
    conn = op.get_bind()
    for trip_id, image in TRIP_IMAGES.items():
        conn.execute(UPDATE_SQL, {"id": uuid.UUID(trip_id), "image": image})


def downgrade() -> None:
    # Backfilled fields are harmless to leave in place; no reliable way to
    # distinguish them from originally-present ones to strip back out.
    pass
