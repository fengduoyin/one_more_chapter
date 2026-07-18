# Reading Library — portable
#
# 1. Unpack this folder anywhere (USB stick, Documents, Desktop).
# 2. Run:
#      Windows: Start.bat  (preferred)  or ReadingLibrary.exe
#      Linux:   ./ReadingLibrary                 (or Start.sh)
# 3. A native app window opens (pywebview). If that fails, the system browser is used.
# 4. To stop: close the app window (or the console / Ctrl+C in browser mode).
#
# Remembers between launches: window size/position, theme, language.
# Always opens on the Books tab.
#
# Your data is stored next to the program:
#   data/reading_library.db  — books, check-ins, goals
#   data/window.json         — window size/position
#   data/webview/            — theme/locale browser storage
#   uploads/                 — cover images
#
# Backup tip: copy the whole folder (or at least data/ + uploads/).
#
# Notes
# - No Docker or PostgreSQL required.
# - Windows needs WebView2 (usually preinstalled with Edge). SmartScreen may warn
#   about an unsigned app — choose "More info" → Run anyway.
# - After downloading the ZIP, prefer Start.bat (it clears Windows "blocked" marks
#   on DLLs). Or: right-click ZIP → Properties → Unblock → Extract.
# - Linux needs a WebKitGTK webview package, e.g. gir1.2-webkit2-4.1 (name varies).
# - Force browser mode: set READING_LIBRARY_BROWSER=1 before launch.
# - Debug log (windowed Windows builds): data/app.log
# - If port 3050 is busy, set APP_PORT before launch, e.g.:
#     Windows CMD:  set APP_PORT=3051 && Start.bat
#     Linux:        APP_PORT=3051 ./ReadingLibrary
