"""Use short, friendly destination labels for the seeded trip templates.

The "Plan your version" flow (community-trips-page -> clone-trip-modal ->
host wizard) locks the wizard's destination field to `trips.destination`
for template trips. That column held the raw city list (e.g. "Tokyo, Kyoto,
Osaka"), which read poorly in a single-value "Where are you going?" field —
this updates it to a short place name (e.g. "Japan") for each of the 4
templates seeded in 0034_trip_templates.

Revision ID: 0037_template_destination_labels
Revises: 0036_merge_heads
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0037_template_destination_labels'
down_revision: Union[str, Sequence[str], None] = '0036_merge_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LABELS = {
    '20000000-0000-0000-0000-000000000001': ('Japan', 'Tokyo, Kyoto, Osaka'),
    '20000000-0000-0000-0000-000000000002': ('Portugal', 'Lisbon, Sintra'),
    '20000000-0000-0000-0000-000000000003': ('Europe', 'Amsterdam, Berlin, Prague, Vienna, Budapest, Zagreb'),
    '20000000-0000-0000-0000-000000000004': ('France', 'Paris'),
}


def upgrade() -> None:
    conn = op.get_bind()
    for trip_id, (short_label, _original) in LABELS.items():
        conn.execute(
            sa.text("UPDATE trips SET destination = :destination WHERE id = :id AND is_template = true"),
            {"destination": short_label, "id": trip_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for trip_id, (_short_label, original) in LABELS.items():
        conn.execute(
            sa.text("UPDATE trips SET destination = :destination WHERE id = :id AND is_template = true"),
            {"destination": original, "id": trip_id},
        )
