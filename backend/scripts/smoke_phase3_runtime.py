from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests


DEFAULT_API_BASE = "http://localhost:8000/api"
DEFAULT_HEALTH_URL = "http://localhost:8000/health"
BACKEND_CONTAINER = "ai_review_backend"
WORKER_CONTAINER = "ai_review_worker"


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


def _require_docker() -> None:
    p = _run(["docker", "info"])
    if p.returncode != 0:
        raise RuntimeError("Docker daemon is not available. Start Docker Desktop/Engine first.")


def _http_ok(url: str) -> None:
    r = requests.get(url, timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"Health check failed: {url} -> {r.status_code} {r.text}")


def _create_project(api_base: str, project_id: str) -> None:
    r = requests.post(
        f"{api_base}/projects",
        json={
            "project_id": project_id,
            "project_name": "Phase3 Smoke Project",
            "project_description": "runtime smoke test",
        },
        timeout=20,
    )
    if r.status_code not in (200, 400):
        raise RuntimeError(f"Create project failed: {r.status_code} {r.text}")


def _upload(api_base: str, project_id: str, source_file: Path) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        renamed = Path(tmpdir) / f"{project_id}_smoke.pdf"
        shutil.copyfile(source_file, renamed)
        with renamed.open("rb") as fh:
            r = requests.post(
                f"{api_base}/upload",
                data={
                    "project_id": project_id,
                    "project_name": "Phase3 Smoke Project",
                    "document_type": "project-review",
                    "document_name": "smoke-doc",
                    "language": "ja",
                },
                files={"file": (renamed.name, fh, "application/pdf")},
                timeout=60,
            )
    if r.status_code != 200:
        raise RuntimeError(f"Upload failed: {r.status_code} {r.text}")
    return r.json()


def _grade(api_base: str, project_id: str, document_version_id: int) -> int:
    r = requests.post(
        f"{api_base}/grade/{project_id}",
        params={"document_version_id": document_version_id, "prompt_level": "medium"},
        timeout=20,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Grade request failed: {r.status_code} {r.text}")
    data = r.json()
    run_id = int(data["run_id"])
    return run_id


def _poll_run(api_base: str, run_id: int, timeout_sec: int = 180) -> str:
    deadline = time.time() + timeout_sec
    status = "PENDING"
    while time.time() < deadline:
        r = requests.get(f"{api_base}/grading-runs/{run_id}", timeout=20)
        if r.status_code != 200:
            raise RuntimeError(f"Failed to get grading run {run_id}: {r.status_code} {r.text}")
        body = r.json()
        status = str(body.get("grading_run", {}).get("status", "PENDING")).upper()
        if status in {"COMPLETED", "FAILED"}:
            return status
        time.sleep(2)
    raise RuntimeError(f"Timeout waiting grading run {run_id}, latest status={status}")


def _read_recent_logs(container: str, since_minutes: int = 10) -> str:
    p = _run(["docker", "logs", "--since", f"{since_minutes}m", container])
    if p.returncode != 0:
        return ""
    return (p.stdout or "") + (p.stderr or "")


def _contains_metric(log_text: str, metric_name: str) -> bool:
    return metric_name in log_text and "metric_" in log_text


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 3 runtime smoke test")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--health-url", default=DEFAULT_HEALTH_URL)
    parser.add_argument("--sample-file", default="test.pdf")
    args = parser.parse_args()

    sample_file = Path(args.sample_file).resolve()
    if not sample_file.exists():
        print(f"[FAIL] sample file not found: {sample_file}")
        return 2

    project_id = f"P{int(time.time())}"

    try:
        print("[1/6] checking docker daemon")
        _require_docker()

        print("[2/6] checking backend health")
        _http_ok(args.health_url)

        print(f"[3/6] creating project {project_id}")
        _create_project(args.api_base, project_id)

        print("[4/6] uploading sample document")
        uploaded = _upload(args.api_base, project_id, sample_file)
        version_id = int(uploaded["document_version_id"])

        print("[5/6] submitting grading and waiting completion")
        run_id = _grade(args.api_base, project_id, version_id)
        final_status = _poll_run(args.api_base, run_id)
        print(f"      run_id={run_id}, final_status={final_status}")

        print("[6/6] validating metrics logs")
        backend_logs = _read_recent_logs(BACKEND_CONTAINER)
        worker_logs = _read_recent_logs(WORKER_CONTAINER)
        combined = backend_logs + "\n" + worker_logs

        required = [
            "grading_run_created_total",
            "grading_duration_seconds",
        ]
        missing = [m for m in required if not _contains_metric(combined, m)]
        if missing:
            print("[FAIL] missing metric events in logs:", ", ".join(missing))
            return 3

        # Optional metrics may or may not appear in one run depending on behavior.
        optional = [
            "grading_run_reused_total",
            "grading_run_failed_total",
            "grading_retry_total",
        ]
        present_optional = [m for m in optional if _contains_metric(combined, m)]
        print("[PASS] required metrics detected")
        print(f"[INFO] optional metrics detected: {present_optional or 'none in this run'}")
        return 0
    except Exception as exc:
        print(f"[FAIL] {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

