Param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$sandboxHome = Join-Path $repoRoot ".tmp\node-home"
$sandboxCache = Join-Path $repoRoot ".tmp\npm-cache"

New-Item -ItemType Directory -Force -Path $sandboxHome | Out-Null
New-Item -ItemType Directory -Force -Path $sandboxCache | Out-Null

$env:HOME = $sandboxHome
$env:USERPROFILE = $sandboxHome
$env:APPDATA = Join-Path $sandboxHome "AppData\Roaming"
$env:LOCALAPPDATA = Join-Path $sandboxHome "AppData\Local"
$env:NPM_CONFIG_CACHE = $sandboxCache
$env:NPM_CONFIG_USERCONFIG = Join-Path $sandboxHome ".npmrc"

Push-Location $frontendDir
try {
  Write-Host "[frontend-gate] npm run check:i18n"
  npm run check:i18n
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[frontend-gate] npm run build"
  npm run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[frontend-gate] OK"
}
finally {
  Pop-Location
}
