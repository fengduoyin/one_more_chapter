# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Reading Library portable build.

Built by scripts/build_portable.sh from the repo root (paths are relative to CWD).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_dynamic_libs, collect_submodules

ROOT = Path.cwd().resolve()
FRONTEND_DIST = ROOT / "frontend" / "dist"

if not (FRONTEND_DIST / "index.html").exists():
    raise SystemExit(f"Missing frontend build at {FRONTEND_DIST} — run npm run build first")

datas = [
    (str(FRONTEND_DIST), "frontend/dist"),
]
binaries: list = []
hiddenimports = collect_submodules("backend") + [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "sqlalchemy.dialects.sqlite",
    "webview",
    "webview.platforms",
    "webview.platforms.edgechromium",
    "webview.platforms.winforms",
    "webview.platforms.mshtml",
    "clr",
    "clr_loader",
    "pythonnet",
]

for package in (
    "uvicorn",
    "anyio",
    "starlette",
    "fastapi",
    "pydantic",
    "pydantic_settings",
    "webview",
    "pythonnet",
    "clr_loader",
):
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(package)
    except Exception:
        continue
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

try:
    binaries += collect_dynamic_libs("webview")
except Exception:
    pass

a = Analysis(
    [str(ROOT / "packaging" / "entry.py")],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=sorted(set(hiddenimports)),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["psycopg", "psycopg2", "alembic", "tkinter", "matplotlib", "numpy"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ReadingLibrary",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # Hide the console on Windows so the app feels like a normal GUI program.
    # Linux keeps a console for easier troubleshooting in portable builds.
    console=(sys.platform != "win32"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="ReadingLibrary",
)
