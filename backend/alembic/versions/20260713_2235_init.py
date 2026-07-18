"""init

Revision ID: 20260713_2235
Revises: 
Create Date: 2026-07-13

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260713_2235"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("author", sa.String(length=256), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("words_total", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_path", sa.String(length=512), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("review", sa.Text(), nullable=True),
        sa.Column("words_read", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.create_index("ix_books_status", "books", ["status"])
    op.create_index("ix_books_end_date", "books", ["end_date"])

    op.create_table(
        "checkins",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("book_id", sa.BigInteger(), sa.ForeignKey("books.id", ondelete="SET NULL"), nullable=True),
        sa.Column("words_delta", sa.BigInteger(), nullable=False),
        sa.Column("note", sa.String(length=512), nullable=True),
    )
    op.create_index("ux_checkins_day", "checkins", ["day"], unique=True)

    op.create_table(
        "goals",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("period_type", sa.String(length=16), nullable=False),  # month|year
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("metric", sa.String(length=16), nullable=False),  # books|words
        sa.Column("target", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=True),
    )
    op.create_index("ux_goals_period_metric", "goals", ["period_type", "period_start", "metric"], unique=True)


def downgrade() -> None:
    op.drop_index("ux_goals_period_metric", table_name="goals")
    op.drop_table("goals")

    op.drop_index("ux_checkins_day", table_name="checkins")
    op.drop_table("checkins")

    op.drop_index("ix_books_end_date", table_name="books")
    op.drop_index("ix_books_status", table_name="books")
    op.drop_table("books")

