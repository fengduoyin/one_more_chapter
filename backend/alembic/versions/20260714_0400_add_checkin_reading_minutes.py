"""add checkin reading minutes

Revision ID: 20260714_0400
Revises: 20260714_0300
Create Date: 2026-07-14

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260714_0400"
down_revision = "20260714_0300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("checkins", sa.Column("reading_minutes", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("checkins", "reading_minutes")
