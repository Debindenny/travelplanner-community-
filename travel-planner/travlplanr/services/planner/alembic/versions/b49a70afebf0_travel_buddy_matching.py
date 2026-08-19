"""travel buddy matching + reel columns

Revision ID: b49a70afebf0
Revises: 0006_collaborative_itineraries
Create Date: 2026-06-24 00:00:00.000000

Hand-trimmed from autogenerate. Creates the travel-buddy matching tables
(which had no migration) and the reel/views columns on community_posts +
trips.section_versions. The raw autogenerate additionally wanted to DROP the
`hashtags_tag_key` unique constraint and churn the trip-invite token
constraint — those are intentional schema from 0005/0006 and are deliberately
NOT included here. NOT NULL columns get server_defaults so they apply cleanly
to existing rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b49a70afebf0'
down_revision: Union[str, None] = '0006_collaborative_itineraries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- travel buddy matching (no prior migration) ------------------------
    op.create_table(
        'travel_buddy_profiles',
        sa.Column('customer_id', sa.String(), nullable=False),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('travel_styles', sa.JSON(), nullable=True),
        sa.Column('preferred_destinations', sa.JSON(), nullable=True),
        sa.Column('languages', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('customer_id'),
    )
    op.create_table(
        'travel_buddy_requests',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('sender_id', sa.String(), nullable=True),
        sa.Column('receiver_id', sa.String(), nullable=True),
        sa.Column('trip_id', sa.String(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_travel_buddy_requests_receiver_id'), 'travel_buddy_requests', ['receiver_id'], unique=False)
    op.create_index(op.f('ix_travel_buddy_requests_sender_id'), 'travel_buddy_requests', ['sender_id'], unique=False)

    # --- reel / views columns on community_posts (safe server defaults) ----
    op.add_column('community_posts', sa.Column('views_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('community_posts', sa.Column('is_reel', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('community_posts', sa.Column('video_url', sa.String(length=2048), nullable=True))

    # --- trips.section_versions -------------------------------------------
    op.add_column('trips', sa.Column('section_versions', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True))


def downgrade() -> None:
    op.drop_column('trips', 'section_versions')
    op.drop_column('community_posts', 'video_url')
    op.drop_column('community_posts', 'is_reel')
    op.drop_column('community_posts', 'views_count')
    op.drop_index(op.f('ix_travel_buddy_requests_sender_id'), table_name='travel_buddy_requests')
    op.drop_index(op.f('ix_travel_buddy_requests_receiver_id'), table_name='travel_buddy_requests')
    op.drop_table('travel_buddy_requests')
    op.drop_table('travel_buddy_profiles')
