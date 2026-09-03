#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VITE_APP_VERSION:-}" ]]; then
  VITE_APP_VERSION="$(cd /app && python -c 'from backend.app.version import current_version; print(current_version())')"
fi

cd /app/frontend
npm install
VITE_APP_VERSION="$VITE_APP_VERSION" npm run build

mkdir -p /data/uploads

cd /app
exec uvicorn backend.app.main:app \
  --host "${APP_HOST:-0.0.0.0}" \
  --port "${APP_PORT:-3050}" \
  --reload \
  --reload-dir backend
