from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Session, select

from app.database import engine
from app.models import EvaluationSet


ALLOWED_STATUSES = {"draft", "validated", "approved", "active", "archived"}
LEGACY_TO_V2_STATUS = {
    "active": "active",
    "archived": "archived",
}


def _normalize_status(raw: str) -> str:
    value = (raw or "").strip().lower()
    if value in ALLOWED_STATUSES:
        return value
    return LEGACY_TO_V2_STATUS.get(value, "draft")


def run(dry_run: bool, fix_statuses: bool, output_path: Path | None) -> dict:
    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "fix_statuses": fix_statuses,
        "summary": {},
        "scope": {},
        "changes_preview": [],
    }

    with Session(engine) as session:
        rows = session.exec(select(EvaluationSet).order_by(EvaluationSet.id.asc())).all()
        status_counter = Counter((r.status or "").lower() for r in rows)
        by_scope = defaultdict(list)
        invalid_rows = []
        changes = []

        for row in rows:
            scope_key = f"{row.document_type}:{row.level}"
            by_scope[scope_key].append(row)
            normalized = _normalize_status(row.status)
            if normalized != (row.status or "").lower():
                invalid_rows.append({"id": row.id, "status": row.status, "normalized": normalized})
                if fix_statuses:
                    changes.append((row, normalized))

        active_scope_violations = []
        for scope_key, items in by_scope.items():
            active_ids = [i.id for i in items if (i.status or "").lower() == "active"]
            if len(active_ids) > 1:
                active_scope_violations.append({"scope": scope_key, "active_ids": active_ids})

        if changes and not dry_run:
            for row, normalized in changes:
                row.status = normalized
                session.add(row)
            session.commit()

        report["summary"] = {
            "total_sets": len(rows),
            "status_distribution": dict(status_counter),
            "invalid_status_count": len(invalid_rows),
            "active_scope_violations": len(active_scope_violations),
        }
        report["scope"] = {
            "violations": active_scope_violations,
        }
        report["changes_preview"] = invalid_rows[:200]

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluation Bundle V2 migration hardening audit/fix script.")
    parser.add_argument("--apply", action="store_true", help="Apply DB updates (default is dry-run).")
    parser.add_argument("--fix-statuses", action="store_true", help="Normalize unexpected statuses into V2 statuses.")
    parser.add_argument("--output", type=str, default="", help="Optional path to save JSON report.")
    args = parser.parse_args()

    output_path = Path(args.output) if args.output else None
    report = run(dry_run=not args.apply, fix_statuses=args.fix_statuses, output_path=output_path)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

