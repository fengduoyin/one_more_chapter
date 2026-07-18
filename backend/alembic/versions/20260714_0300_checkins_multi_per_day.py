"""checkins multi per day

Revision ID: 20260714_0300
Revises: 20260714_0201
Create Date: 2026-07-14

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260714_0300"
down_revision = "20260714_0201"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ux_checkins_day", table_name="checkins")
    op.create_index("ux_checkins_day_book", "checkins", ["day", "book_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ux_checkins_day_book", table_name="checkins")
    op.create_index("ux_checkins_day", "checkins", ["day"], unique=True)
