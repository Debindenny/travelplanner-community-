"""Add structured price/saves metrics to seeded trip templates.

The community Trips page's Popular/Recent/Budget/Luxury pills were acting as
FILTERS (Budget/Luxury hid every trip outside that tier), and price/saves
were only free-form display strings ("2.4K saves", "E1.9K") with no numeric
value to sort by. This adds explicit numeric fields to each template's
`template_meta` so the pills can become SORTS instead (every trip stays
visible, just reordered): `saves_count` for Popular, and
`per_person_amount` + `per_person_currency` (ISO code) for Budget/Luxury —
the amount is in the template's own currency; the API converts it to INR at
a static rate for cross-currency comparison (see community_misc.py).

Revision ID: 0038_template_metrics
Revises: 0037_template_destination_labels
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = '0038_template_metrics'
down_revision: Union[str, Sequence[str], None] = '0037_template_destination_labels'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# trip_id -> (saves_count, per_person_amount, per_person_currency)
METRICS = {
    '20000000-0000-0000-0000-000000000001': (2400, 140000, 'INR'),   # 7 Days in Japan — "2.4K saves" / "Rs1.4L"
    '20000000-0000-0000-0000-000000000002': (1800, 620, 'EUR'),      # 5 Days in Lisbon & Sintra — "1.8K saves" / "E620"
    '20000000-0000-0000-0000-000000000003': (1200, 1900, 'EUR'),     # Europe by Train - 14 Days — "1.2K saves" / "E1.9K"
    '20000000-0000-0000-0000-000000000004': (940, 540, 'GBP'),       # Paris Long Weekend — "940 saves" / "GBP540"
}


def upgrade() -> None:
    conn = op.get_bind()
    stmt = sa.text(
        "UPDATE trips SET template_meta = COALESCE(template_meta, '{}'::jsonb) || "
        "jsonb_build_object('saves_count', :saves_count, 'per_person_amount', :amount, 'per_person_currency', :currency) "
        "WHERE id = :id AND is_template = true"
    ).bindparams(
        sa.bindparam("saves_count", type_=sa.Integer),
        sa.bindparam("amount", type_=sa.Numeric),
        sa.bindparam("currency", type_=sa.String),
    )
    for trip_id, (saves_count, amount, currency) in METRICS.items():
        conn.execute(stmt, {"id": trip_id, "saves_count": saves_count, "amount": amount, "currency": currency})


def downgrade() -> None:
    conn = op.get_bind()
    for trip_id in METRICS:
        conn.execute(
            sa.text(
                "UPDATE trips SET template_meta = template_meta - 'saves_count' - 'per_person_amount' - 'per_person_currency' "
                "WHERE id = :id AND is_template = true"
            ),
            {"id": trip_id},
        )
