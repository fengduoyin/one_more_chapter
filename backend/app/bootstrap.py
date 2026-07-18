"""Ensure database schema exists (used by portable / SQLite startups)."""

from __future__ import annotations

from sqlalchemy import inspect, text

from backend.app.db import Base, engine
from backend.app import models  # noqa: F401
from backend.app.settings import settings


def ensure_schema() -> None:
    """Create missing tables for the current models.

    Docker/Postgres continues to use Alembic. Portable SQLite uses create_all
    so we do not need dialect-specific historical migrations.
    """
    Base.metadata.create_all(bind=engine)

    if not settings.is_sqlite:
        return

    # Keep sqlite autoincrement counters aligned after create_all (empty DB).
    inspector = inspect(engine)
    with engine.begin() as conn:
        has_seq = conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
        ).scalar()
        if not has_seq:
            return

        for table_name in ("books", "checkins", "goals"):
            if table_name not in inspector.get_table_names():
                continue
            max_id = conn.execute(text(f"SELECT MAX(id) FROM {table_name}")).scalar()
            if max_id is None:
                continue
            exists = conn.execute(
                text("SELECT 1 FROM sqlite_sequence WHERE name = :name"),
                {"name": table_name},
            ).scalar()
            if exists:
                conn.execute(
                    text("UPDATE sqlite_sequence SET seq = :seq WHERE name = :name"),
                    {"seq": int(max_id), "name": table_name},
                )
            else:
                conn.execute(
                    text("INSERT INTO sqlite_sequence(name, seq) VALUES (:name, :seq)"),
                    {"name": table_name, "seq": int(max_id)},
                )
