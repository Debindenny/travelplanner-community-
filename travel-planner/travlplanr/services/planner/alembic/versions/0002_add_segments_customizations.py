"""add segments and customizations to trips

Revision ID: 0002
Revises: 0001
Create Date: 2024-05-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trips', sa.Column('segments', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('trips', sa.Column('customizations', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('trips', 'customizations')
    op.drop_column('trips', 'segments')
