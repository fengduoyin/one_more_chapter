"""add book and checkin pages

Revision ID: 20260717_0100
Revises: 20260714_0400
Create Date: 2026-07-17

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260717_0100"
down_revision = "20260714_0400"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("pages_total", sa.BigInteger(), nullable=True))
    op.add_column(
        "books",
        sa.Column("pages_read", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.add_column(
        "checkins",
        sa.Column("pages_delta", sa.BigInteger(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("checkins", "pages_delta")
    op.drop_column("books", "pages_read")
    op.drop_column("books", "pages_total")
