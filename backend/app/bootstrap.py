"""Ensure database schema exists (SQLite startups)."""

from __future__ import annotations

import re

from sqlalchemy import inspect, text

from backend.app.db import Base, engine
from backend.app import models  # noqa: F401


def _ensure_column(conn, inspector, table: str, column: str, ddl_type: str) -> None:
    if table not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns(table)}
    if column in existing:
        return
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))


def _parse_series_number(raw: object) -> int | None:
    """Extract the first integer from a legacy volume string, if any."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    match = re.search(r"\d+", text)
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def _migrate_volume_to_number(conn, inspector) -> None:
    """One-time: copy integers from legacy string `volume` into `number`."""
    if "books" not in inspector.get_table_names():
        return

    # Refresh columns after possible ALTER below.
    cols = {c["name"] for c in inspect(engine).get_columns("books")}
    if "number" not in cols:
        conn.execute(text("ALTER TABLE books ADD COLUMN number INTEGER"))
        cols.add("number")

    if "volume" not in cols:
        return

    rows = conn.execute(text("SELECT id, volume, number FROM books")).all()
    for row_id, volume, number in rows:
        if number is not None:
            continue
        parsed = _parse_series_number(volume)
        if parsed is None:
            continue
        conn.execute(
            text("UPDATE books SET number = :num WHERE id = :id"),
            {"num": parsed, "id": row_id},
        )


def ensure_schema() -> None:
    """Create missing tables for the current models."""
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    with engine.begin() as conn:
        _ensure_column(conn, inspector, "books", "series", "VARCHAR(256)")
        _migrate_volume_to_number(conn, inspector)

        # Keep sqlite autoincrement counters aligned after create_all.
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
