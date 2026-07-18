#!/usr/bin/env bash
set -euo pipefail

cd /app/frontend
npm install
npm run build

mkdir -p /app/backend/uploads

cd /app
alembic -c backend/alembic.ini upgrade head
exec uvicorn backend.app.main:app \
  --host "${APP_HOST:-0.0.0.0}" \
  --port "${APP_PORT:-3050}" \
  --reload \
  --reload-dir backend
