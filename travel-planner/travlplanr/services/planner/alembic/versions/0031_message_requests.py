"""Add message_requests table for message request approval

Revision ID: 0031_message_requests
Revises: 0030_seed_paris_crew
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0031_message_requests'
down_revision: Union[str, Sequence[str], None] = '0030_seed_paris_crew'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'message_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('receiver_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('sender_id', 'receiver_id', name='uq_message_requests_sender_receiver'),
    )
    # sender_id/receiver_id already get single-column indexes from Column(index=True)
    # above — only the composite one needs creating explicitly.
    op.create_index('ix_message_requests_receiver_status', 'message_requests', ['receiver_id', 'status'])


def downgrade() -> None:
    op.drop_index('ix_message_requests_receiver_status', table_name='message_requests')
    op.drop_table('message_requests')
