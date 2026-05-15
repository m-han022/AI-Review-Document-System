from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Missing required report: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def evaluate_gate(migration_report: dict, parity_report: dict) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    migration_summary = migration_report.get("summary") or {}
    parity_summary = parity_report.get("summary") or {}

    if int(parity_summary.get("mismatched", 0)) > 0:
        reasons.append("Parity mismatch > 0")
    if int(migration_summary.get("active_scope_violations", 0)) > 0:
        reasons.append("Active scope violations > 0")
    if int(migration_summary.get("invalid_status_count", 0)) > 0:
        reasons.append("Invalid status count > 0")
    if int(parity_summary.get("checked", 0)) <= 0:
        reasons.append("No parity scope checked")

    return len(reasons) == 0, reasons


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-cutover gate for Evaluation Bundle V2 rollout.")
    parser.add_argument(
        "--migration-report",
        default="artifacts/evaluation_bundle_v2_migration_report.json",
        help="Path to migration hardening JSON report.",
    )
    parser.add_argument(
        "--parity-report",
        default="artifacts/evaluation_bundle_v2_parity_report.json",
        help="Path to parity JSON report.",
    )
    args = parser.parse_args()

    migration = _load_json(Path(args.migration_report))
    parity = _load_json(Path(args.parity_report))
    ok, reasons = evaluate_gate(migration, parity)

    result = {
        "gate": "PASS" if ok else "FAIL",
        "reasons": reasons,
        "inputs": {
            "migration_report": args.migration_report,
            "parity_report": args.parity_report,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()

