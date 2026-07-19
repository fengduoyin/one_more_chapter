#!/usr/bin/env bash
# Build a Windows portable One More Chapter ZIP from Linux/WSL via Wine+Docker.
#
# Usage (from repo root):
#   ./scripts/build_portable_windows.sh
#   INCLUDE_DATA=1 ./scripts/build_portable_windows.sh
#
# Output:
#   dist/OneMoreChapter-portable-win64/
#   dist/OneMoreChapter-portable-win64-YYYYMMDD.zip
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INCLUDE_DATA="${INCLUDE_DATA:-0}"
OUT_NAME="OneMoreChapter-portable-win64"
APP_NAME="One More Chapter"
DIST_DIR="$ROOT/dist/$OUT_NAME"
IMAGE="${PORTABLE_WINDOWS_IMAGE:-tobix/pywine:3.13}"
FILE_IMAGE="${PORTABLE_FILE_IMAGE:-python:3.13-slim}"
STAMP="$(date +%Y%m%d)"
ZIP_PATH="$ROOT/dist/${OUT_NAME}-${STAMP}.zip"

if [[ ! -f frontend/dist/index.html ]]; then
  echo "Building frontend…"
  if [[ ! -d frontend/node_modules ]]; then
    (cd frontend && npm ci)
  fi
  (cd frontend && npm run build)
fi

# Host-side cleanup when possible (avoids Wine/XDG issues on simple rm/chown).
safe_rm() {
  local path="$1"
  if [[ -e "$path" ]] || [[ -L "$path" ]]; then
    rm -rf "$path" 2>/dev/null || \
      docker run --rm -v "$ROOT:/src" -e DEBIAN_FRONTEND=noninteractive "$FILE_IMAGE" \
        bash -lc "rm -rf /src/${path#"$ROOT"/}"
  fi
}

echo "Building Windows PyInstaller bundle with $IMAGE (Wine)…"
safe_rm "$ROOT/dist/pyi-dist-win"
safe_rm "$ROOT/dist/pyi-work-win"
safe_rm "$DIST_DIR"
mkdir -p "$ROOT/dist"

docker run --rm \
  -v "$ROOT:/src" -w /src \
  -e DEBIAN_FRONTEND=noninteractive \
  -e XDG_RUNTIME_DIR=/tmp/runtime-root \
  -e WINEDEBUG=-all \
  "$IMAGE" \
  bash -lc "
    set -euo pipefail
    mkdir -p /tmp/runtime-root
    chmod 700 /tmp/runtime-root
    . /opt/mkuserwineprefix
    wine python -m pip install -q -r backend/requirements.txt -r packaging/requirements-portable.txt
    wine python -m PyInstaller --noconfirm --clean \
      --distpath Z:/src/dist/pyi-dist-win \
      --workpath Z:/src/dist/pyi-work-win \
      packaging/one_more_chapter.spec
  "

SRC="$ROOT/dist/pyi-dist-win/${APP_NAME}"
if [[ ! -f "$SRC/${APP_NAME}.exe" ]]; then
  echo "PyInstaller Windows output missing at $SRC" >&2
  ls -la "$ROOT/dist/pyi-dist-win" >&2 || true
  ls -la "$SRC" >&2 || true
  exit 1
fi

mkdir -p "$DIST_DIR"
# Wine may create root-owned files — copy via container if needed.
if cp -a "$SRC/." "$DIST_DIR/" 2>/dev/null; then
  :
else
  docker run --rm -v "$ROOT:/src" "$FILE_IMAGE" bash -lc "
    set -euo pipefail
    mkdir -p /src/dist/${OUT_NAME}
    cp -a '/src/dist/pyi-dist-win/${APP_NAME}/.' /src/dist/${OUT_NAME}/
  "
fi
cp packaging/README_PORTABLE.txt "$DIST_DIR/README.txt"
cp packaging/Start.bat "$DIST_DIR/Start.bat"
mkdir -p "$DIST_DIR/data" "$DIST_DIR/uploads"

if [[ "$INCLUDE_DATA" == "1" ]]; then
  # Prefer Docker self-host data/, fall back to portable/ (dev portable run).
  if [[ -f data/ocm_db.db ]]; then
    cp -a data/ocm_db.db "$DIST_DIR/data/"
    echo "Included SQLite database from data/."
  elif [[ -f portable/data/ocm_db.db ]]; then
    cp -a portable/data/ocm_db.db "$DIST_DIR/data/"
    echo "Included SQLite database from portable/data/."
  fi
  if [[ -d data/uploads ]] && [[ -n "$(ls -A data/uploads 2>/dev/null || true)" ]]; then
    cp -a data/uploads/. "$DIST_DIR/uploads/"
    echo "Included uploads from data/uploads/."
  elif [[ -d portable/uploads ]] && [[ -n "$(ls -A portable/uploads 2>/dev/null || true)" ]]; then
    cp -a portable/uploads/. "$DIST_DIR/uploads/"
    echo "Included uploads from portable/uploads/."
  fi
fi

rm -f "$ZIP_PATH"
python3 - <<PY
import pathlib, zipfile
root = pathlib.Path(${ROOT@Q}) / "dist"
folder = root / ${OUT_NAME@Q}
zip_path = pathlib.Path(${ZIP_PATH@Q})
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(folder.rglob("*")):
        if path.is_file():
            zf.write(path, path.relative_to(root).as_posix())
print(f"Wrote {zip_path}")
PY

safe_rm "$ROOT/dist/pyi-dist-win"
safe_rm "$ROOT/dist/pyi-work-win"

# Fix ownership if Wine left root-owned artifacts.
docker run --rm -v "$ROOT:/src" "$FILE_IMAGE" bash -lc \
  "chown -R $(id -u):$(id -g) /src/dist/${OUT_NAME} /src/dist/$(basename "$ZIP_PATH") 2>/dev/null || true"

echo
echo "Windows portable build ready:"
echo "  folder: $DIST_DIR"
echo "  zip:    $ZIP_PATH"
echo
echo "On Windows: unpack and run \"${APP_NAME}.exe\" (or Start.bat)."
