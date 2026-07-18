@echo off
cd /d "%~dp0"

REM ZIP downloads get Windows "Mark of the Web", which breaks pythonnet/WebView2 DLLs.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Get-ChildItem -LiteralPath '%~dp0' -Recurse -Force -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue } catch {}" >nul 2>&1

start "" "%~dp0ReadingLibrary.exe"
