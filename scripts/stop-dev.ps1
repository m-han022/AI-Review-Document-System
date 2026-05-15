param(
  [switch]$StopRedis
)

$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $root "docker-compose.yml"
$ports = @(8000, 5173)

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  $pids = $connections.OwningProcess | Select-Object -Unique
  foreach ($pid in $pids) {
    if ($pid) {
      Stop-Process -Id $pid -Force
      Write-Host "[dev] Stopped PID $pid on port $port"
    }
  }
}

# Celery worker does not expose a port, so stop it by command line signature.
$workerProcesses = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match '^python(\.exe)?$' -and
    $_.CommandLine -match 'celery' -and
    $_.CommandLine -match [regex]::Escape($root)
  }

foreach ($proc in $workerProcesses) {
  Stop-Process -Id $proc.ProcessId -Force
  Write-Host "[dev] Stopped Celery worker PID $($proc.ProcessId)"
}

if ($StopRedis) {
  if (Get-Command docker -ErrorAction SilentlyContinue -and (Test-Path $composeFile)) {
    docker compose -f $composeFile stop redis | Out-Null
    Write-Host "[dev] Stopped Docker Compose redis service"
  } else {
    Write-Host "[dev] Skip redis stop: Docker or docker-compose.yml not available"
  }
}

Write-Host "[dev] Stop completed."
