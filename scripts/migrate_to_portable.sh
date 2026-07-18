#!/usr/bin/env bash
# Migrate PostgreSQL → portable SQLite (+ copy cover uploads).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set DB_* credentials." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

# From the host (WSL), Docker's host.docker.internal is usually localhost Postgres.
if [[ "${DB_HOST:-}" == "host.docker.internal" || "${DB_HOST:-}" == "db" ]]; then
  export DB_HOST=127.0.0.1
fi

export SQLITE_PATH="${SQLITE_PATH:-$ROOT/portable/data/reading_library.db}"
export UPLOADS_DIR="${UPLOADS_DIR:-$ROOT/portable/uploads}"
export UPLOADS_SRC="${UPLOADS_SRC:-$ROOT/backend/uploads}"

run_with_venv() {
  if [[ ! -d .venv ]]; then
    python3 -m venv .venv
    .venv/bin/pip install -q -r backend/requirements.txt
  fi
  exec .venv/bin/python scripts/migrate_pg_to_sqlite.py
}

run_with_docker() {
  local image="${PORTABLE_DOCKER_IMAGE:-reading-library-app:latest}"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "Docker image '$image' not found. Build once with: docker compose build" >&2
    exit 1
  fi
  echo "Migrating via Docker ($image)…"
  exec docker run --rm --network host \
    -v "$ROOT:/app" -w /app \
    -e DB_HOST=127.0.0.1 \
    -e DB_PORT="${DB_PORT:-5432}" \
    -e DB_NAME="$DB_NAME" \
    -e DB_USER="$DB_USER" \
    -e DB_PASSWORD="$DB_PASSWORD" \
    -e SQLITE_PATH=/app/portable/data/reading_library.db \
    -e UPLOADS_DIR=/app/portable/uploads \
    -e UPLOADS_SRC=/app/backend/uploads \
    "$image" \
    python scripts/migrate_pg_to_sqlite.py
}

PY_MINOR="$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo 99)"
if [[ "$PY_MINOR" -ge 14 ]] && command -v docker >/dev/null 2>&1; then
  run_with_docker
fi

if run_with_venv; then
  :
else
  echo "Local venv install failed; trying Docker fallback…" >&2
  run_with_docker
fi
