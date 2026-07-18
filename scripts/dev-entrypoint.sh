#!/usr/bin/env bash
set -euo pipefail

cd /app/frontend
npm install
npm run build

mkdir -p /data/uploads

cd /app
exec uvicorn backend.app.main:app \
  --host "${APP_HOST:-0.0.0.0}" \
  --port "${APP_PORT:-3050}" \
  --reload \
  --reload-dir backend
