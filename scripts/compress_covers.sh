#!/usr/bin/env bash
# Compress existing cover images under data/uploads and portable/uploads.
# Usage (from repo root):
#   ./scripts/compress_covers.sh
#   python -m backend.app.covers_cli
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
exec python3 -m backend.app.covers_cli "$@"
