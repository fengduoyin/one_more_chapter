# One More Chapter — portable (Windows)
#
# 1. Unpack this folder anywhere (USB stick, Documents, Desktop).
# 2. Run: Start.bat or "One More Chapter.exe"
# 3. A native app window opens (pywebview). If that fails, the system browser is used.
# 4. To stop: close the app window (or the console / Ctrl+C in browser mode).
#
# Your data is stored next to the program:
#   data/ocm_db.db           — books, check-ins, goals
#   data/window.json         — window size/position
#   data/webview/            — theme/locale browser storage
#   uploads/                 — cover images
#
# Backup tip: copy the whole folder (or at least data/ + uploads/).
#
# Notes
# - No Docker or Python install required.
# - UI font (Open Sans) is bundled — no network needed for typography.
# - Windows needs WebView2 (usually preinstalled with Edge). SmartScreen may warn
#   about an unsigned app — choose "More info" → Run anyway.

