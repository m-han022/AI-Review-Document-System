param(
  [switch]$Json
)

$ErrorActionPreference = "SilentlyContinue"

function New-CheckResult {
  param(
    [string]$Name,
    [bool]$Ok,
    [string]$Detail,
    [string]$Remediation
  )
  [PSCustomObject]@{
    name = $Name
    ok = $Ok
    detail = $Detail
    remediation = $Remediation
  }
}

function Test-PortOpen {
  param([string]$HostName, [int]$Port)
  try {
    $result = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue
    return [bool]$result.TcpTestSucceeded
  } catch {
    return $false
  }
}

function Test-DockerDaemon {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  docker info *> $null
  return ($LASTEXITCODE -eq 0)
}

$results = @()

# 1) ExecutionPolicy
$policy = Get-ExecutionPolicy -Scope CurrentUser
$policyOk = $policy -ne "Restricted"
$results += New-CheckResult `
  -Name "ExecutionPolicy(CurrentUser)" `
  -Ok $policyOk `
  -Detail "CurrentUser policy = $policy" `
  -Remediation "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned"

# 2) Redis reachability
$redisOk = Test-PortOpen -HostName "localhost" -Port 6379
$results += New-CheckResult `
  -Name "Redis localhost:6379" `
  -Ok $redisOk `
  -Detail ($(if ($redisOk) { "reachable" } else { "not reachable" })) `
  -Remediation "Start Redis (docker compose up -d redis) or local redis-server"

# 3) Docker daemon (for auto-start redis fallback)
$dockerOk = Test-DockerDaemon
$results += New-CheckResult `
  -Name "Docker daemon" `
  -Ok $dockerOk `
  -Detail ($(if ($dockerOk) { "available" } else { "not available" })) `
  -Remediation "Start Docker Desktop daemon"

# 4) Port occupancy checks
$backendBusy = Test-PortOpen -HostName "localhost" -Port 8000
$frontendBusy = Test-PortOpen -HostName "localhost" -Port 5173
$results += New-CheckResult `
  -Name "Port 8000 (backend)" `
  -Ok (-not $backendBusy) `
  -Detail ($(if ($backendBusy) { "already in use" } else { "free" })) `
  -Remediation ".\\scripts\\dev-stop.ps1"
$results += New-CheckResult `
  -Name "Port 5173 (frontend)" `
  -Ok (-not $frontendBusy) `
  -Detail ($(if ($frontendBusy) { "already in use" } else { "free" })) `
  -Remediation ".\\scripts\\dev-stop.ps1"

# 5) Worker presence (best effort signature check)
$cwd = Split-Path -Parent $PSScriptRoot
$worker = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^python(\.exe)?$' -and
  $_.CommandLine -match 'celery' -and
  $_.CommandLine -match [regex]::Escape($cwd)
}
$workerOk = [bool]$worker
$results += New-CheckResult `
  -Name "Celery worker process" `
  -Ok $workerOk `
  -Detail ($(if ($workerOk) { "detected" } else { "not detected (will be started by dev-start-async)" })) `
  -Remediation "Manual check: python -m celery -A app.celery_app worker --loglevel=info --pool=solo"

$allOk = -not ($results | Where-Object { -not $_.ok })

if ($Json) {
  [PSCustomObject]@{
    ok = $allOk
    checks = $results
  } | ConvertTo-Json -Depth 5
  if (-not $allOk) { exit 1 }
  exit 0
}

Write-Host "[preflight] Async environment checks"
foreach ($r in $results) {
  $badge = if ($r.ok) { "[PASS]" } else { "[FAIL]" }
  Write-Host "$badge $($r.name): $($r.detail)"
  if (-not $r.ok) {
    Write-Host "       Fix: $($r.remediation)"
  }
}

if (-not $allOk) {
  Write-Host "[preflight] FAILED: resolve failed checks above."
  exit 1
}

Write-Host "[preflight] All required checks passed."
exit 0

