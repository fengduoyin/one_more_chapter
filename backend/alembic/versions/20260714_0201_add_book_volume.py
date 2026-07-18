"""add book volume

Revision ID: 20260714_0201
Revises: 20260713_2235
Create Date: 2026-07-14

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260714_0201"
down_revision = "20260713_2235"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("volume", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("books", "volume")
