# Build One More Chapter portable for Windows (run on a Windows machine).
#
# Usage (from repo root in PowerShell):
#   .\scripts\build_portable.ps1
#   .\scripts\build_portable.ps1 -IncludeData
#
# Output:
#   dist\OneMoreChapter-portable-win64\
#   dist\OneMoreChapter-portable-win64-YYYYMMDD.zip

param(
  [switch]$IncludeData
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$OutName = "OneMoreChapter-portable-win64"
$AppName = "One More Chapter"
$DistDir = Join-Path $Root "dist\$OutName"
$Stamp = Get-Date -Format "yyyyMMdd"
$ZipPath = Join-Path $Root "dist\${OutName}-${Stamp}.zip"
$PyiDist = Join-Path $Root "dist\pyi-dist-win"
$PyiWork = Join-Path $Root "dist\pyi-work-win"

$env:PYTHONPATH = "$Root"
$AppVersion = py -3.13 -c "from backend.app.version import current_version; print(current_version())"
Write-Host "App version: v$AppVersion"

Write-Host "Building frontend…"
Push-Location frontend
if (-not (Test-Path "node_modules")) { npm ci }
$env:VITE_APP_VERSION = $AppVersion
npm run build
Pop-Location

$venv = Join-Path $Root ".venv-win-build"
if (-not (Test-Path $venv)) {
  py -3.13 -m venv $venv
  & "$venv\Scripts\pip.exe" install -r backend\requirements.txt -r packaging\requirements-portable.txt
}

if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
if (Test-Path $PyiDist) { Remove-Item -Recurse -Force $PyiDist }
if (Test-Path $PyiWork) { Remove-Item -Recurse -Force $PyiWork }
New-Item -ItemType Directory -Force -Path (Join-Path $Root "dist") | Out-Null

& "$venv\Scripts\pyinstaller.exe" --noconfirm --clean `
  --distpath $PyiDist `
  --workpath $PyiWork `
  packaging\one_more_chapter.spec

$Src = Join-Path $PyiDist $AppName
if (-not (Test-Path (Join-Path $Src "$AppName.exe"))) {
  throw "PyInstaller output missing: $Src\$AppName.exe"
}

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $Src "*") $DistDir
Copy-Item packaging\README_PORTABLE.txt (Join-Path $DistDir "README.txt")
Copy-Item packaging\Start.bat (Join-Path $DistDir "Start.bat")
New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "uploads") | Out-Null

if ($IncludeData) {
  # Prefer Docker self-host data/, fall back to portable/ (dev portable run).
  $dbDocker = "data\ocm_db.db"
  $dbPortable = "portable\data\ocm_db.db"
  if (Test-Path $dbDocker) {
    Copy-Item $dbDocker (Join-Path $DistDir "data\ocm_db.db")
    Write-Host "Included SQLite database from data/."
  } elseif (Test-Path $dbPortable) {
    Copy-Item $dbPortable (Join-Path $DistDir "data\ocm_db.db")
    Write-Host "Included SQLite database from portable/data/."
  }
  if ((Test-Path "data\uploads") -and (Get-ChildItem "data\uploads" -Force -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    Copy-Item -Recurse -Force "data\uploads\*" (Join-Path $DistDir "uploads")
    Write-Host "Included uploads from data/uploads/."
  } elseif ((Test-Path "portable\uploads") -and (Get-ChildItem "portable\uploads" -Force -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    Copy-Item -Recurse -Force "portable\uploads\*" (Join-Path $DistDir "uploads")
    Write-Host "Included uploads from portable/uploads/."
  }
}

if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path $DistDir -DestinationPath $ZipPath

Remove-Item -Recurse -Force $PyiDist, $PyiWork -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Windows portable build ready:"
Write-Host "  folder: $DistDir"
Write-Host "  zip:    $ZipPath"
Write-Host ""
Write-Host "Run: $DistDir\$AppName.exe"
