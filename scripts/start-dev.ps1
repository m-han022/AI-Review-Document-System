param(
  [switch]$UseCelery
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

if ($UseCelery) {
  $env:USE_CELERY = "true"
  Write-Host "[dev] Async mode enabled: backend will dispatch grading jobs to Celery."
  Write-Host "[dev] Prerequisite: Redis and Celery worker must already be running, otherwise runs will stay PENDING."
} else {
  $env:USE_CELERY = "false"
  Write-Host "[dev] Sync mode enabled for local development (USE_CELERY=false)."
  Write-Host "[dev] This avoids orphaned PENDING runs when Redis/worker are not running."
}

Write-Host "[dev] Starting backend on :8000"
Start-Process python `
  -ArgumentList "-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000" `
  -WorkingDirectory $backendDir `
  -WindowStyle Normal

Write-Host "[dev] Starting frontend on :5173"
Start-Process node `
  -ArgumentList "node_modules/vite/bin/vite.js","--host","0.0.0.0","--port","5173" `
  -WorkingDirectory $frontendDir `
  -WindowStyle Normal

if ($UseCelery) {
  Write-Host "[dev] Done. Frontend: http://127.0.0.1:5173 | Backend: http://127.0.0.1:8000/docs | Mode: async"
} else {
  Write-Host "[dev] Done. Frontend: http://127.0.0.1:5173 | Backend: http://127.0.0.1:8000/docs | Mode: sync"
  Write-Host "[dev] To test full async flow explicitly, run: .\\scripts\\start-dev.ps1 -UseCelery"
}
