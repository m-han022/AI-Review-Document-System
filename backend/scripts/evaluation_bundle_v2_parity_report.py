from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def _discover_active_scopes(client: TestClient) -> list[tuple[str, str]]:
    res = client.get("/api/mgmt/evaluation-bundles")
    if res.status_code >= 400:
        return [("project-review", "medium")]
    rows = res.json() or []
    pairs = {
        (str(r.get("document_type", "")).strip(), str(r.get("level", "")).strip())
        for r in rows
        if str(r.get("status", "")).lower() == "active"
    }
    cleaned = [(d, l) for d, l in pairs if d and l]
    return sorted(cleaned) if cleaned else [("project-review", "medium")]


def _fetch_json(client: TestClient, path: str) -> tuple[int, object]:
    res = client.get(path)
    try:
        body = res.json()
    except Exception:
        body = res.text
    return res.status_code, body


def run(scopes: list[tuple[str, str]], output_path: Path | None = None) -> dict:
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scopes": [],
        "summary": {"checked": 0, "matched": 0, "mismatched": 0},
    }
    original_flag = os.getenv("USE_EVALUATION_BUNDLE_V2_READ")

    with TestClient(app) as client:
        for document_type, level in scopes:
            query = f"document_type={document_type}&level={level}"
            path = f"/api/mgmt/evaluation-sets?{query}"

            os.environ["USE_EVALUATION_BUNDLE_V2_READ"] = "false"
            old_status, old_body = _fetch_json(client, path)
            os.environ["USE_EVALUATION_BUNDLE_V2_READ"] = "true"
            new_status, new_body = _fetch_json(client, path)

            matched = old_status == new_status and old_body == new_body
            report["summary"]["checked"] += 1
            report["summary"]["matched" if matched else "mismatched"] += 1
            report["scopes"].append(
                {
                    "document_type": document_type,
                    "level": level,
                    "old_status_code": old_status,
                    "new_status_code": new_status,
                    "matched": matched,
                    "old_count": len(old_body) if isinstance(old_body, list) else None,
                    "new_count": len(new_body) if isinstance(new_body, list) else None,
                    "diff_preview": None if matched else {"old": old_body, "new": new_body},
                }
            )

    if original_flag is None:
        os.environ.pop("USE_EVALUATION_BUNDLE_V2_READ", None)
    else:
        os.environ["USE_EVALUATION_BUNDLE_V2_READ"] = original_flag

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Parity report for evaluation-sets legacy read vs V2 read flag.")
    parser.add_argument(
        "--scope",
        action="append",
        default=[],
        help="Scope format: document_type:level (can pass multiple times).",
    )
    parser.add_argument("--output", type=str, default="", help="Optional path to save JSON report.")
    parser.add_argument(
        "--all-active-scopes",
        action="store_true",
        help="Discover and check all active scopes from /api/mgmt/evaluation-bundles.",
    )
    args = parser.parse_args()

    scopes = []
    for raw in args.scope:
        if ":" not in raw:
            raise ValueError(f"Invalid --scope '{raw}', expected document_type:level")
        document_type, level = raw.split(":", 1)
        scopes.append((document_type.strip(), level.strip()))
    if args.all_active_scopes:
        with TestClient(app) as client:
            scopes = _discover_active_scopes(client)
    elif not scopes:
        scopes = [("project-review", "medium")]

    report = run(scopes=scopes, output_path=Path(args.output) if args.output else None)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
