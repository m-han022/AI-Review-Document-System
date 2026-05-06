from __future__ import annotations

import argparse
import json
import tempfile
import time
from pathlib import Path
from typing import Any

import requests


def _require_ok(resp: requests.Response, context: str) -> dict[str, Any]:
    if resp.status_code != 200:
        raise RuntimeError(f"{context} failed: {resp.status_code} {resp.text}")
    try:
        return resp.json()
    except Exception:
        return {}


def _extract_metric_snapshot(metrics_text: str) -> dict[str, float]:
    keys = (
        "api_request_duration_seconds_count",
        "grading_queue_delay_seconds_count",
        "grading_retry_total",
        "grading_run_failed_total",
        "audit_query_duration_seconds_count",
        "export_duration_seconds_count",
        "export_rows_total",
    )
    result: dict[str, float] = {}
    for line in metrics_text.splitlines():
        for key in keys:
            if line.startswith(key):
                try:
                    value = float(line.rsplit(" ", 1)[-1].strip())
                except ValueError:
                    continue
                result[key] = result.get(key, 0.0) + value
    return result


def run_cycle(api_base: str, project_id: str, sample_file: Path) -> dict[str, Any]:
    create = requests.post(
        f"{api_base}/projects",
        json={"project_id": project_id, "project_name": f"Soak {project_id}"},
        timeout=20,
    )
    if create.status_code not in (200, 400):
        raise RuntimeError(f"create project failed: {create.status_code} {create.text}")

    with tempfile.TemporaryDirectory() as tmp:
        file_name = f"{project_id}_soak.pdf"
        copied = Path(tmp) / file_name
        copied.write_bytes(sample_file.read_bytes())
        with copied.open("rb") as fh:
            uploaded = _require_ok(
                requests.post(
                    f"{api_base}/upload",
                    data={
                        "project_id": project_id,
                        "document_type": "project-review",
                        "document_name": "soak-doc",
                        "language": "ja",
                    },
                    files={"file": (file_name, fh, "application/pdf")},
                    timeout=60,
                ),
                "upload",
            )

    version_id = int(uploaded["document_version_id"])

    grade = _require_ok(
        requests.post(
            f"{api_base}/grade",
            json={"document_version_id": version_id, "prompt_level": "medium"},
            timeout=30,
        ),
        "grade",
    )
    run_id = int(grade["run_id"])

    # poll run detail (bounded wait, supports sync and async mode)
    final_status = "PENDING"
    deadline = time.time() + 180
    while time.time() < deadline:
        detail = _require_ok(
            requests.get(f"{api_base}/grading-runs/{run_id}", timeout=20),
            "grading-run-detail",
        )
        final_status = str(detail.get("grading_run", {}).get("status", "PENDING")).upper()
        if final_status in {"COMPLETED", "FAILED"}:
            break
        time.sleep(2)

    _require_ok(
        requests.get(f"{api_base}/audit/runs?project_id={project_id}&limit=20&offset=0", timeout=20),
        "audit-runs",
    )
    exported = requests.get(f"{api_base}/audit/export?project_id={project_id}&format=csv", timeout=60)
    if exported.status_code != 200:
        raise RuntimeError(f"audit-export failed: {exported.status_code} {exported.text}")
    _ = exported.text

    return {"project_id": project_id, "run_id": run_id, "status": final_status}


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 5 soak runtime script")
    parser.add_argument("--api-base", default="http://localhost:8000/api")
    parser.add_argument("--metrics-url", default="http://localhost:8000/metrics")
    parser.add_argument("--sample-file", default="test.pdf")
    parser.add_argument("--cycles", type=int, default=10)
    parser.add_argument("--sleep-seconds", type=float, default=2.0)
    parser.add_argument("--output", default="artifacts/phase5_soak_report.json")
    args = parser.parse_args()

    sample = Path(args.sample_file).resolve()
    if not sample.exists():
        raise RuntimeError(f"sample file not found: {sample}")

    report: dict[str, Any] = {
        "started_at": time.time(),
        "api_base": args.api_base,
        "cycles": [],
        "metrics_samples": [],
    }

    for i in range(args.cycles):
        project_id = f"P5SOAK{int(time.time())}{i}"
        cycle_result = run_cycle(args.api_base, project_id, sample)
        report["cycles"].append(cycle_result)

        metrics_resp = requests.get(args.metrics_url, timeout=20)
        if metrics_resp.status_code == 200:
            report["metrics_samples"].append(
                {
                    "ts": time.time(),
                    "cycle": i + 1,
                    "snapshot": _extract_metric_snapshot(metrics_resp.text),
                }
            )
        time.sleep(args.sleep_seconds)

    report["ended_at"] = time.time()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] soak report written: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

