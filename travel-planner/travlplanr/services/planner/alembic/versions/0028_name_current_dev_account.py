"""Give the real dev-login account a display name

Revision ID: 0028_name_dev_account
Revises: 0027_seed_circle_members
Create Date: 2026-09-03 00:00:00.000000

The community UI's "current user" chrome (headers, "You" badges, "you created
this circle" toasts) is driven by a hardcoded frontend constant — Ava Reyes,
customer_id 1627e255-8a3c-4dbb-a553-fb797f6b0244 — that is NOT the customer_id
in the real auth session's JWT. The actually-authenticated dev account
(customer_id c4d9fcc8-01f4-4620-9f93-6fc1c58bab86, found by inspecting which
account really joined a circle) already has a community_profiles row but no
name, so it displayed as generic "Traveler" instead of a real identity.

Rather than rewire the whole community feature off that hardcoded constant
(a much larger change), this aligns the real account's display name with what
the rest of the UI already calls "you", so joins/creates attributed to the
real session show up correctly everywhere.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0028_name_dev_account'
down_revision: Union[str, Sequence[str], None] = '0027_seed_circle_members'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEV_ACCOUNT_ID = 'c4d9fcc8-01f4-4620-9f93-6fc1c58bab86'


def upgrade() -> None:
    op.execute(f"""
        UPDATE community_profiles
        SET name = 'Ava Reyes'
        WHERE customer_id = '{DEV_ACCOUNT_ID}' AND (name IS NULL OR name = '')
    """)
    op.execute(f"""
        INSERT INTO community_profiles (customer_id, name, profile_views, is_verified, countries_visited, post_visibility, created_at)
        SELECT '{DEV_ACCOUNT_ID}', 'Ava Reyes', 0, false, 0, 'everyone', now()
        WHERE NOT EXISTS (SELECT 1 FROM community_profiles WHERE customer_id = '{DEV_ACCOUNT_ID}')
    """)


def downgrade() -> None:
    op.execute(f"""
        UPDATE community_profiles SET name = NULL
        WHERE customer_id = '{DEV_ACCOUNT_ID}' AND name = 'Ava Reyes'
    """)
