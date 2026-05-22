param()

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$composeFile = Join-Path $root "docker-compose.yml"

function Test-PortOpen {
  param(
    [string]$HostName,
    [int]$Port
  )

  try {
    $result = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue
    return [bool]$result.TcpTestSucceeded
  } catch {
    return $false
  }
}

Write-Host "[dev-async] Preparing async local environment"

Write-Host "[dev-async] Running preflight checks"
$preflightScript = Join-Path $PSScriptRoot "dev-preflight.ps1"
if (Test-Path $preflightScript) {
  & $preflightScript
  if ($LASTEXITCODE -ne 0) {
    throw "[dev-async] Preflight failed. Fix issues above and retry."
  }
}

if (-not (Test-PortOpen -HostName "localhost" -Port 6379)) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "[dev-async] Redis is not reachable on localhost:6379 and Docker is not available. Start Redis manually first."
  }
  if (-not (Test-Path $composeFile)) {
    throw "[dev-async] Redis is not reachable and docker-compose.yml was not found."
  }

  Write-Host "[dev-async] Redis is not running. Starting compose service: redis"
  docker compose -f $composeFile up -d redis

  $redisReady = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-PortOpen -HostName "localhost" -Port 6379) {
      $redisReady = $true
      break
    }
  }

  if (-not $redisReady) {
    throw "[dev-async] Redis did not become reachable on localhost:6379 after startup."
  }
}

$env:USE_CELERY = "true"

Write-Host "[dev-async] Starting backend on :8000 with USE_CELERY=true"
Start-Process python `
  -ArgumentList "-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000" `
  -WorkingDirectory $backendDir `
  -WindowStyle Normal

Write-Host "[dev-async] Starting Celery worker"
Start-Process python `
  -ArgumentList "-m","celery","-A","app.celery_app","worker","--loglevel=info","--pool=solo" `
  -WorkingDirectory $backendDir `
  -WindowStyle Normal

Write-Host "[dev-async] Starting frontend on :5173"
Start-Process node `
  -ArgumentList "node_modules/vite/bin/vite.js","--host","0.0.0.0","--port","5173" `
  -WorkingDirectory $frontendDir `
  -WindowStyle Normal

Write-Host "[dev-async] Done. Frontend: http://127.0.0.1:5173 | Backend: http://127.0.0.1:8000/docs | Mode: async"
Write-Host "[dev-async] Redis is expected on localhost:6379. Use .\\scripts\\stop-dev.ps1 to stop frontend/backend ports. Stop Redis separately if it was started via Docker."
