from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


DOCUMENT_TYPES = ["project-review", "bug-analysis", "qa-review", "explanation-review"]
LEVELS = ["low", "medium", "high"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    results: list[dict[str, object]] = []
    with TestClient(app) as client:
        for document_type in DOCUMENT_TYPES:
            for level in LEVELS:
                response = client.post(
                    "/api/mgmt/evaluation-bundles/bootstrap",
                    json={
                        "document_type": document_type,
                        "level": level,
                        "name": f"{document_type}-{level}-auto-verify",
                    },
                )
                ok = response.status_code == 200
                detail = None
                if not ok:
                    try:
                        detail = response.json()
                    except Exception:
                        detail = response.text
                results.append(
                    {
                        "document_type": document_type,
                        "level": level,
                        "status_code": response.status_code,
                        "ok": ok,
                        "detail": detail,
                    }
                )

    failed = [item for item in results if not item["ok"]]
    report = {
        "generated_at": now_iso(),
        "checked": len(results),
        "failed": len(failed),
        "pass": len(failed) == 0,
        "results": results,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
