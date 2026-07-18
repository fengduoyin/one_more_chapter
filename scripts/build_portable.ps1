# Build Reading Library portable for Windows (run on a Windows machine).
#
# Usage (from repo root in PowerShell):
#   .\scripts\build_portable.ps1
#   .\scripts\build_portable.ps1 -IncludeData
#
# Output:
#   dist\ReadingLibrary-portable-win64\
#   dist\ReadingLibrary-portable-win64-YYYYMMDD.zip

param(
  [switch]$IncludeData
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$OutName = "ReadingLibrary-portable-win64"
$DistDir = Join-Path $Root "dist\$OutName"
$Stamp = Get-Date -Format "yyyyMMdd"
$ZipPath = Join-Path $Root "dist\${OutName}-${Stamp}.zip"
$PyiDist = Join-Path $Root "dist\pyi-dist-win"
$PyiWork = Join-Path $Root "dist\pyi-work-win"

if (-not (Test-Path "frontend\dist\index.html")) {
  Write-Host "Building frontend…"
  Push-Location frontend
  if (-not (Test-Path "node_modules")) { npm ci }
  npm run build
  Pop-Location
}

$venv = Join-Path $Root ".venv-win-build"
if (-not (Test-Path $venv)) {
  py -3.13 -m venv $venv
  & "$venv\Scripts\pip.exe" install -r packaging\requirements-portable.txt
}

if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
if (Test-Path $PyiDist) { Remove-Item -Recurse -Force $PyiDist }
if (Test-Path $PyiWork) { Remove-Item -Recurse -Force $PyiWork }
New-Item -ItemType Directory -Force -Path (Join-Path $Root "dist") | Out-Null

& "$venv\Scripts\pyinstaller.exe" --noconfirm --clean `
  --distpath $PyiDist `
  --workpath $PyiWork `
  packaging\reading_library.spec

$Src = Join-Path $PyiDist "ReadingLibrary"
if (-not (Test-Path (Join-Path $Src "ReadingLibrary.exe"))) {
  throw "PyInstaller output missing: $Src\ReadingLibrary.exe"
}

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $Src "*") $DistDir
Copy-Item packaging\README_PORTABLE.txt (Join-Path $DistDir "README.txt")
Copy-Item packaging\Start.bat (Join-Path $DistDir "Start.bat")
New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DistDir "uploads") | Out-Null

if ($IncludeData) {
  $db = "portable\data\reading_library.db"
  if (Test-Path $db) {
    Copy-Item $db (Join-Path $DistDir "data\reading_library.db")
    Write-Host "Included existing SQLite database."
  }
  if (Test-Path "portable\uploads") {
    Copy-Item -Recurse -Force "portable\uploads\*" (Join-Path $DistDir "uploads")
    Write-Host "Included existing uploads."
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
Write-Host "Run: $DistDir\ReadingLibrary.exe"
