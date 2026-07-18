#!/usr/bin/env python3
"""Copy data from PostgreSQL into the portable SQLite database.

Usage (from repo root, with Postgres reachable on localhost):

    ./scripts/migrate_to_portable.sh

Or manually:

    set -a && source .env && set +a
    export DB_HOST=127.0.0.1
    python scripts/migrate_pg_to_sqlite.py
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from sqlalchemy import create_engine, insert, select, text


ROOT = Path(__file__).resolve().parents[1]


def _pg_url() -> str:
    host = os.getenv("DB_HOST", "127.0.0.1")
    if host in {"host.docker.internal", "db"}:
        host = "127.0.0.1"
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "reading_library")
    user = os.getenv("DB_USER", "example_user")
    password = os.getenv("DB_PASSWORD", "example_password")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"


def _sqlite_path() -> Path:
    return Path(os.getenv("SQLITE_PATH", str(ROOT / "portable" / "data" / "reading_library.db"))).resolve()


def _uploads_src() -> Path:
    return Path(os.getenv("UPLOADS_SRC", str(ROOT / "backend" / "uploads"))).resolve()


def _uploads_dst() -> Path:
    return Path(os.getenv("UPLOADS_DIR", str(ROOT / "portable" / "uploads"))).resolve()


def _sync_sqlite_sequences(conn, table_names: list[str]) -> None:
    has_seq = conn.execute(
        text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
    ).scalar()
    if not has_seq:
        # INTEGER PRIMARY KEY without AUTOINCREMENT uses max(rowid)+1 — nothing to sync.
        return

    for table_name in table_names:
        max_id = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")).scalar() or 0
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


def main() -> int:
    sys.path.insert(0, str(ROOT))

    sqlite_file = _sqlite_path()
    sqlite_file.parent.mkdir(parents=True, exist_ok=True)
    if sqlite_file.exists():
        sqlite_file.unlink()

    os.environ["DB_ENGINE"] = "sqlite"
    os.environ["SQLITE_PATH"] = str(sqlite_file)
    os.environ["UPLOADS_DIR"] = str(_uploads_dst())

    # Late imports after destination env is configured.
    from backend.app.bootstrap import ensure_schema
    from backend.app.db import engine as sqlite_engine
    from backend.app.models import Book, Checkin, Goal

    ensure_schema()

    pg_engine = create_engine(_pg_url(), pool_pre_ping=True)
    tables = [Book.__table__, Checkin.__table__, Goal.__table__]
    counts: dict[str, int] = {}

    with pg_engine.connect() as src_conn, sqlite_engine.begin() as dst_conn:
        for table in tables:
            rows = [dict(row) for row in src_conn.execute(select(table)).mappings().all()]
            counts[table.name] = len(rows)
            if rows:
                dst_conn.execute(insert(table), rows)
        _sync_sqlite_sequences(dst_conn, [t.name for t in tables])

    src_uploads = _uploads_src()
    dst_uploads = _uploads_dst()
    if dst_uploads.exists():
        shutil.rmtree(dst_uploads)
    dst_uploads.mkdir(parents=True, exist_ok=True)
    copied_files = 0
    if src_uploads.exists():
        for path in src_uploads.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(src_uploads)
            target = dst_uploads / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            copied_files += 1

    print("Migration complete.")
    print(f"  books:    {counts.get('books', 0)}")
    print(f"  checkins: {counts.get('checkins', 0)}")
    print(f"  goals:    {counts.get('goals', 0)}")
    print(f"  covers:   {copied_files} file(s)")
    print(f"  sqlite:   {sqlite_file}")
    print(f"  uploads:  {dst_uploads}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
