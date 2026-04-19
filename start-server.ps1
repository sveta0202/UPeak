$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = 8080

Write-Host "PulseBurn: folder $root" -ForegroundColor Cyan
Write-Host "Starting server on http://127.0.0.1:$port/ ..." -ForegroundColor Cyan

if (Get-Command npx -ErrorAction SilentlyContinue) {
  npx --yes serve . -l $port
  exit $LASTEXITCODE
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  py -m http.server $port
  exit $LASTEXITCODE
}

if (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $port
  exit $LASTEXITCODE
}

Write-Host "Need Node.js (npx) or Python. Install one of them and run this script again." -ForegroundColor Red
exit 1
