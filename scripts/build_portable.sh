#!/usr/bin/env bash
# Build a portable Reading Library folder + ZIP (Linux via Docker/Python 3.13).
#
# Usage (from repo root):
#   ./scripts/build_portable.sh
#   INCLUDE_DATA=1 ./scripts/build_portable.sh   # also copy current portable/data + uploads
#
# Output:
#   dist/ReadingLibrary-portable/     — ready-to-run folder
#   dist/ReadingLibrary-portable-*.zip
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INCLUDE_DATA="${INCLUDE_DATA:-0}"
OUT_NAME="ReadingLibrary-portable"
BUILD_DIR="$ROOT/dist/pyi-build"
DIST_DIR="$ROOT/dist/$OUT_NAME"
IMAGE="${PORTABLE_BUILD_IMAGE:-python:3.13-slim}"
STAMP="$(date +%Y%m%d)"
ZIP_PATH="$ROOT/dist/${OUT_NAME}-linux-x64-${STAMP}.zip"

if [[ ! -f frontend/dist/index.html ]]; then
  echo "Building frontend…"
  if [[ ! -d frontend/node_modules ]]; then
    (cd frontend && npm ci)
  fi
  (cd frontend && npm run build)
fi

echo "Building PyInstaller bundle with $IMAGE…"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$ROOT/dist"

docker run --rm \
  -v "$ROOT:/app" -w /app \
  "$IMAGE" \
  bash -lc "
    set -euo pipefail
    apt-get update -qq
    apt-get install -y -qq binutils >/dev/null
    pip install -q -r packaging/requirements-portable.txt
    pyinstaller --noconfirm --clean \
      --distpath /app/dist/pyi-dist \
      --workpath /app/dist/pyi-work \
      packaging/reading_library.spec
  "

# PyInstaller COLLECT name=ReadingLibrary → dist/pyi-dist/ReadingLibrary/
SRC="$ROOT/dist/pyi-dist/ReadingLibrary"
if [[ ! -x "$SRC/ReadingLibrary" && ! -f "$SRC/ReadingLibrary.exe" ]]; then
  echo "PyInstaller output missing at $SRC" >&2
  ls -la "$ROOT/dist/pyi-dist" >&2 || true
  exit 1
fi

mkdir -p "$DIST_DIR"
cp -a "$SRC/." "$DIST_DIR/"
cp packaging/README_PORTABLE.txt "$DIST_DIR/README.txt"
cp packaging/Start.sh "$DIST_DIR/Start.sh"
cp packaging/Start.bat "$DIST_DIR/Start.bat"
chmod +x "$DIST_DIR/ReadingLibrary" "$DIST_DIR/Start.sh" || true
mkdir -p "$DIST_DIR/data" "$DIST_DIR/uploads"

if [[ "$INCLUDE_DATA" == "1" ]]; then
  if [[ -f portable/data/reading_library.db ]]; then
    cp -a portable/data/reading_library.db "$DIST_DIR/data/"
    echo "Included existing SQLite database."
  fi
  if [[ -d portable/uploads ]] && [[ -n "$(ls -A portable/uploads 2>/dev/null || true)" ]]; then
    cp -a portable/uploads/. "$DIST_DIR/uploads/"
    echo "Included existing uploads."
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

# Keep tree tidy for local testing; leave pyi intermediates optional
rm -rf "$ROOT/dist/pyi-dist" "$ROOT/dist/pyi-work" "$BUILD_DIR"

echo
echo "Portable build ready:"
echo "  folder: $DIST_DIR"
echo "  zip:    $ZIP_PATH"
echo
echo "Run:  $DIST_DIR/ReadingLibrary"
echo "Or:   INCLUDE_DATA=1 ./scripts/build_portable.sh  # bake in your current data"
