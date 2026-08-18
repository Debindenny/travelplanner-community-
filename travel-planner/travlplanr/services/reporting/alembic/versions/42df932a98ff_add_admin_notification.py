"""Add AdminNotification

Revision ID: 42df932a98ff
Revises: 42df932a98fe
Create Date: 2026-06-22 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '42df932a98ff'
down_revision: Union[str, None] = '42df932a98fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'admin_notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.String(length=1024), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_admin_notifications_tenant_id'), 'admin_notifications', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_admin_notifications_created_at'), 'admin_notifications', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_admin_notifications_created_at'), table_name='admin_notifications')
    op.drop_index(op.f('ix_admin_notifications_tenant_id'), table_name='admin_notifications')
    op.drop_table('admin_notifications')
