"""fix enums casing and roles

Revision ID: 82f42a17bca8
Revises: 61950fd85731
Create Date: 2026-07-02 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '82f42a17bca8'
down_revision: Union[str, None] = '61950fd85731'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        # Alembic runs migrations inside a transaction.
        # We must commit the current transaction block first to run ALTER TYPE / CREATE TYPE safely.
        op.execute("COMMIT")
        
        # 1. user_kind_enum
        op.execute("ALTER TYPE user_kind_enum RENAME TO user_kind_enum_old")
        op.execute("CREATE TYPE user_kind_enum AS ENUM ('customer', 'staff', 'corporate_admin', 'travel_agent')")
        op.execute("ALTER TABLE users ALTER COLUMN user_kind TYPE user_kind_enum USING LOWER(user_kind::text)::user_kind_enum")
        op.execute("DROP TYPE user_kind_enum_old")

        # 2. user_status_enum
        op.execute("ALTER TYPE user_status_enum RENAME TO user_status_enum_old")
        op.execute("CREATE TYPE user_status_enum AS ENUM ('active', 'inactive', 'suspended')")
        op.execute("ALTER TABLE users ALTER COLUMN status TYPE user_status_enum USING LOWER(status::text)::user_status_enum")
        op.execute("DROP TYPE user_status_enum_old")

        # 3. customer_type_enum
        op.execute("ALTER TYPE customer_type_enum RENAME TO customer_type_enum_old")
        op.execute("CREATE TYPE customer_type_enum AS ENUM ('Couple', 'Solo', 'Family', 'Friends')")
        op.execute("ALTER TABLE customer_profiles ALTER COLUMN customer_type TYPE customer_type_enum USING INITCAP(customer_type::text)::customer_type_enum")
        op.execute("DROP TYPE customer_type_enum_old")
        
        # 4. staff_role_enum
        op.execute("ALTER TYPE staff_role_enum RENAME TO staff_role_enum_old")
        op.execute("CREATE TYPE staff_role_enum AS ENUM ('Staff', 'Manager', 'Admin')")
        op.execute("ALTER TABLE staff ALTER COLUMN role TYPE staff_role_enum USING INITCAP(role::text)::staff_role_enum")
        op.execute("DROP TYPE staff_role_enum_old")

        # 5. assignment_role_enum
        op.execute("ALTER TYPE assignment_role_enum RENAME TO assignment_role_enum_old")
        op.execute("CREATE TYPE assignment_role_enum AS ENUM ('onboarded_by', 'manages')")
        op.execute("ALTER TABLE customer_assignments ALTER COLUMN role TYPE assignment_role_enum USING LOWER(role::text)::assignment_role_enum")
        op.execute("DROP TYPE assignment_role_enum_old")
        
        # Restart transaction block for alembic's internals
        op.execute("BEGIN")
    else:
        # SQLite or other database: convert raw string values in columns
        op.execute("UPDATE users SET user_kind = 'customer' WHERE UPPER(user_kind) = 'CUSTOMER'")
        op.execute("UPDATE users SET user_kind = 'staff' WHERE UPPER(user_kind) = 'STAFF'")
        op.execute("UPDATE users SET user_kind = 'corporate_admin' WHERE UPPER(user_kind) = 'CORPORATE_ADMIN'")
        op.execute("UPDATE users SET user_kind = 'travel_agent' WHERE UPPER(user_kind) = 'TRAVEL_AGENT'")

        op.execute("UPDATE users SET status = 'active' WHERE UPPER(status) = 'ACTIVE'")
        op.execute("UPDATE users SET status = 'inactive' WHERE UPPER(status) = 'INACTIVE'")
        op.execute("UPDATE users SET status = 'suspended' WHERE UPPER(status) = 'SUSPENDED'")

        op.execute("UPDATE customer_profiles SET customer_type = 'Couple' WHERE UPPER(customer_type) = 'COUPLE'")
        op.execute("UPDATE customer_profiles SET customer_type = 'Solo' WHERE UPPER(customer_type) = 'SOLO'")
        op.execute("UPDATE customer_profiles SET customer_type = 'Family' WHERE UPPER(customer_type) = 'FAMILY'")
        op.execute("UPDATE customer_profiles SET customer_type = 'Friends' WHERE UPPER(customer_type) = 'FRIENDS'")

        op.execute("UPDATE staff SET role = 'Staff' WHERE UPPER(role) = 'STAFF'")
        op.execute("UPDATE staff SET role = 'Manager' WHERE UPPER(role) = 'MANAGER'")
        op.execute("UPDATE staff SET role = 'Admin' WHERE UPPER(role) = 'ADMIN'")

        op.execute("UPDATE customer_assignments SET role = 'onboarded_by' WHERE UPPER(role) = 'ONBOARDED_BY'")
        op.execute("UPDATE customer_assignments SET role = 'manages' WHERE UPPER(role) = 'MANAGES'")


def downgrade() -> None:
    pass
