#!/usr/bin/env python3
"""Thin PyInstaller entrypoint — keeps frozen module layout stable."""

from __future__ import annotations

from multiprocessing import freeze_support

from backend.app.desktop import (
    app_dir,
    ensure_windowed_stdio,
    is_frozen,
    main,
    unblock_windows_zone_identifiers,
)


if __name__ == "__main__":
    # Windowed Windows builds have sys.stdout/stderr = None before anything runs.
    ensure_windowed_stdio()
    # Clear Mark-of-the-Web on extracted ZIP files before loading WebView DLLs.
    unblock_windows_zone_identifiers(app_dir())
    if is_frozen():
        freeze_support()
    main()
