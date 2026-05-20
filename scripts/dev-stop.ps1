param(
  [switch]$StopRedis
)

$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $root "docker-compose.yml"
$ports = @(8000, 5173)
$stoppedAny = $false
$maxPasses = 4

function Get-ListeningPidsByPorts {
  param([int[]]$TargetPorts)

  $pids = @()
  foreach ($port in $TargetPorts) {
    $rows = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($rows) {
      $pids += ($rows | Select-Object -ExpandProperty OwningProcess)
    }
  }

  if (-not $pids) {
    $netstatRows = netstat -ano | Select-String -Pattern "LISTENING"
    foreach ($row in $netstatRows) {
      $line = ($row.Line -replace "\s+", " ").Trim()
      foreach ($port in $TargetPorts) {
        if ($line -match "127\.0\.0\.1:$port " -or $line -match "0\.0\.0\.0:$port ") {
          $parts = $line.Split(" ")
          if ($parts.Length -ge 5) {
            $pidCandidate = $parts[-1]
            if ($pidCandidate -match "^\d+$") {
              $pids += [int]$pidCandidate
            }
          }
        }
      }
    }
  }

  return ($pids | Where-Object { $_ -and $_ -gt 0 } | Select-Object -Unique)
}

for ($pass = 1; $pass -le $maxPasses; $pass++) {
  $owningProcessIds = Get-ListeningPidsByPorts -TargetPorts $ports

  if (-not $owningProcessIds) {
    if ($pass -gt 1) {
      Write-Host "[dev] Ports 8000/5173 are no longer listening (pass $pass)."
    }
    break
  }

  foreach ($procId in $owningProcessIds) {
    if ($procId) {
      Stop-Process -Id $procId -Force
      Write-Host "[dev] Stopped PID $procId (pass $pass)"
      $stoppedAny = $true
    }
  }

  Start-Sleep -Milliseconds 250
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
  $stoppedAny = $true
}

if (-not $stoppedAny) {
  Write-Host "[dev] No matching local dev process found on ports 8000/5173 and no celery worker found."
}

if ($StopRedis) {
  if ((Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $composeFile)) {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[dev] Skip redis stop: Docker daemon is not available."
    } else {
      $redisContainerId = docker compose -f $composeFile ps -q redis 2>$null
      if (-not $redisContainerId) {
        Write-Host "[dev] Redis service is not running (or not created) in docker compose."
      } else {
        docker compose -f $composeFile stop redis | Out-Null
        if ($LASTEXITCODE -eq 0) {
          Write-Host "[dev] Stopped Docker Compose redis service"
        } else {
          Write-Host "[dev] Failed to stop redis service (docker compose exit code: $LASTEXITCODE)"
        }
      }
    } 
  } else {
    Write-Host "[dev] Skip redis stop: Docker or docker-compose.yml not available"
  }
}

$remainingPids = Get-ListeningPidsByPorts -TargetPorts $ports
if ($remainingPids) {
  $left = ($remainingPids | Select-Object -Unique) -join ", "
  Write-Host "[dev] Warning: some listeners are still alive on 8000/5173. Remaining PID(s): $left"
}

Write-Host "[dev] Stop completed."
