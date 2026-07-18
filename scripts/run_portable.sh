#!/usr/bin/env bash
# Start the portable (SQLite) app locally from the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Prefer already-built frontend (e.g. from Docker). Build locally if missing.
if [[ ! -f frontend/dist/index.html ]]; then
  if [[ ! -d frontend/node_modules ]]; then
    (cd frontend && npm ci)
  fi
  (cd frontend && npm run build)
fi

export DB_ENGINE=sqlite
export SQLITE_PATH="${SQLITE_PATH:-$ROOT/portable/data/reading_library.db}"
export UPLOADS_DIR="${UPLOADS_DIR:-$ROOT/portable/uploads}"
export STATIC_DIR="${STATIC_DIR:-$ROOT/frontend/dist}"
export APP_HOST="${APP_HOST:-127.0.0.1}"
export APP_PORT="${APP_PORT:-3050}"

# Docker / headless: no display → use system browser fallback (or open URL manually).
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  export READING_LIBRARY_BROWSER="${READING_LIBRARY_BROWSER:-1}"
fi

run_with_venv() {
  if [[ ! -d .venv ]]; then
    python3 -m venv .venv
    .venv/bin/pip install -q -r backend/requirements.txt
  fi
  exec .venv/bin/python -m backend.app.desktop
}

run_with_docker() {
  local image="${PORTABLE_DOCKER_IMAGE:-reading-library-app:latest}"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "Docker image '$image' not found. Build once with: docker compose build" >&2
    exit 1
  fi
  echo "Starting portable app via Docker ($image)…"
  exec docker run --rm --name reading-library-portable \
    -p "${APP_PORT}:${APP_PORT}" \
    -v "$ROOT:/app" -w /app \
    -e DB_ENGINE=sqlite \
    -e SQLITE_PATH=/app/portable/data/reading_library.db \
    -e UPLOADS_DIR=/app/portable/uploads \
    -e STATIC_DIR=/app/frontend/dist \
    -e APP_HOST=0.0.0.0 \
    -e APP_PORT="$APP_PORT" \
    -e READING_LIBRARY_BROWSER=1 \
    "$image" \
    python -m backend.app.desktop
}
# Host Python 3.14+ often lacks binary wheels for pinned deps — prefer Docker then.
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
