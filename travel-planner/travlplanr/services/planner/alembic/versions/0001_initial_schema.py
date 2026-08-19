"""initial schema — trips, destinations, packages, cms

Revision ID: 0001
Revises:
Create Date: 2024-05-20 11:00:00.000000

Base schema for the planner service. Creates the trips table (without the
`segments`/`customizations` columns, which are added in 0002), plus the
destinations, packages and CMS tables, and the trip_status_enum type.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# trip_status_enum — labels are the TripStatus member *names* (SQLAlchemy's
# default for a native enum), matching what the ORM persists.
trip_status_enum = postgresql.ENUM(
    'DRAFT', 'GENERATING', 'READY', 'PENDING', 'BOOKED', 'CANCELLED', 'CREATED',
    name='trip_status_enum',
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    trip_status_enum.create(bind, checkfirst=True)

    op.create_table(
        'trips',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('customer_id', sa.Uuid(), nullable=False),
        sa.Column('customer_name', sa.String(), nullable=False),
        sa.Column('display_code', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('destination', sa.String(), nullable=False),
        sa.Column('start_date', sa.String(), nullable=False),
        sa.Column('end_date', sa.String(), nullable=False),
        sa.Column('travelers', sa.Integer(), nullable=False),
        sa.Column('travel_style', sa.String(), nullable=True),
        sa.Column('travel_method', sa.String(), nullable=True),
        sa.Column('budget', sa.String(), nullable=True),
        sa.Column('interests', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('food_preferences', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('status', trip_status_enum, nullable=False),
        sa.Column('image', sa.String(), nullable=True),
        sa.Column('days', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('city_days', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_trips_tenant_id', 'trips', ['tenant_id'])
    op.create_index('ix_trips_customer_id', 'trips', ['customer_id'])

    op.create_table(
        'destinations',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('base_price', sa.Integer(), nullable=False),
        sa.Column('region', sa.String(), nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_destinations_name', 'destinations', ['name'])
    op.create_index('ix_destinations_region', 'destinations', ['region'])

    op.create_table(
        'packages',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('theme', sa.String(), nullable=False),
        sa.Column('price', sa.Integer(), nullable=False),
        sa.Column('days', sa.Integer(), nullable=False),
        sa.Column('group_type', sa.String(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('region', sa.String(), nullable=False),
        sa.Column('country', sa.String(), nullable=False),
        sa.Column('budget_tier', sa.String(), nullable=False),
        sa.Column('rating', sa.Float(), nullable=False),
        sa.Column('itinerary_id', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_packages_title', 'packages', ['title'])
    op.create_index('ix_packages_region', 'packages', ['region'])
    op.create_index('ix_packages_country', 'packages', ['country'])

    op.create_table(
        'blog_posts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('excerpt', sa.Text(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=False),
        sa.Column('published_at', sa.String(length=50), nullable=False),
        sa.Column('read_time', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('category_label', sa.String(length=100), nullable=False),
        sa.Column('featured', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )

    op.create_table(
        'faq_sections',
        sa.Column('id', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'faq_items',
        sa.Column('id', sa.String(length=100), nullable=False),
        sa.Column('section_id', sa.String(length=100), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['faq_sections.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('faq_items')
    op.drop_table('faq_sections')
    op.drop_table('blog_posts')
    op.drop_index('ix_packages_country', table_name='packages')
    op.drop_index('ix_packages_region', table_name='packages')
    op.drop_index('ix_packages_title', table_name='packages')
    op.drop_table('packages')
    op.drop_index('ix_destinations_region', table_name='destinations')
    op.drop_index('ix_destinations_name', table_name='destinations')
    op.drop_table('destinations')
    op.drop_index('ix_trips_customer_id', table_name='trips')
    op.drop_index('ix_trips_tenant_id', table_name='trips')
    op.drop_table('trips')
    trip_status_enum.drop(op.get_bind(), checkfirst=True)
