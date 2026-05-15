param()

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"

Push-Location $backendDir
try {
  $env:PYTHONPATH='.'

  Write-Host "[verify-v2-local] 1/3 migration hardening report"
  python scripts/evaluation_bundle_v2_migration_hardening.py --output artifacts/evaluation_bundle_v2_migration_report.runtime.json

  Write-Host "[verify-v2-local] 2/3 parity report (all active scopes)"
  python scripts/evaluation_bundle_v2_parity_report.py --all-active-scopes --output artifacts/evaluation_bundle_v2_parity_report.runtime.json

  Write-Host "[verify-v2-local] 3/3 pre-cutover gate"
  python scripts/evaluation_bundle_v2_pre_cutover_gate.py --migration-report artifacts/evaluation_bundle_v2_migration_report.runtime.json --parity-report artifacts/evaluation_bundle_v2_parity_report.runtime.json

  Write-Host "[verify-v2-local] PASS"
}
finally {
  Pop-Location
}
