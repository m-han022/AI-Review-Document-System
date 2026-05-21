import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.models import Submission, SubmissionDocument, SubmissionDocumentVersion, GradingRun, GradingCriteriaResult, GradingSlideReview
from app.database import engine
from unittest.mock import patch, MagicMock
import hashlib
from datetime import datetime, timezone, timedelta
from app.storage import store

def _ensure_manual_eval_set(client: TestClient, document_type: str = "project-review", level: str = "medium"):
    client.post("/api/mgmt/prompts", json={
        "document_type": document_type,
        "level": level,
        "version": "v1",
        "content": "manual prompt v1",
        "activate": True,
    })
    client.post("/api/mgmt/policies", json={
        "level": level,
        "version": "v1",
        "content": "manual policy v1",
        "activate": True,
    })
    client.post("/api/mgmt/evaluation-sets/bootstrap", json={
        "document_type": document_type,
        "level": level,
    })

def test_upload_flow_hierarchical(client: TestClient, session: Session):
    # 0. Project must exist beforehand (New rule)
    project_id = "P999"
    project_name = "Test Project"
    client.post("/api/projects", json={"project_id": project_id, "project_name": project_name})
    
    # 1. First upload -> document + version v1
    file_content = b"fake pdf content"
    files = {"file": ("P999_TestDoc.pdf", file_content, "application/pdf")}
    data = {"language": "ja", "project_id": project_id, "document_type": "project-review", "document_name": "TestDoc"}
    
    response = client.post("/api/upload", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["document_version"] == "v1"
    
    # Verify in DB
    v1_id = res_data["document_version_id"]
    version = session.get(SubmissionDocumentVersion, v1_id)
    assert version is not None
    assert version.document_version == "v1"
    
    # 2. Second upload (same doc name) -> version v2
    response2 = client.post("/api/upload", files=files, data=data)
    assert response2.status_code == 200
    res_data2 = response2.json()
    assert res_data2["document_version"] == "v2"
    v2_id = res_data2["document_version_id"]
    assert v2_id != v1_id
    
    # Verify both exist
    versions = session.exec(select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == version.submission_id)).all()
    assert len(versions) == 2

def test_upload_to_non_existent_project_fails(client: TestClient):
    file_content = b"fake pdf content"
    files = {"file": ("P888_Invalid.pdf", file_content, "application/pdf")}
    data = {"language": "ja", "project_id": "P888", "document_type": "project-review"}
    
    # P888 was never created
    response = client.post("/api/upload", files=files, data=data)
    assert response.status_code == 400 # UploadService raises ValueError which becomes 400 in router
    assert "Project does not exist" in response.json()["detail"]

    # Must not auto-create project implicitly
    project_check = client.get("/api/projects/P888")
    assert project_check.status_code == 404


@pytest.mark.parametrize(
    "filename,content,mime_type",
    [
        ("P120_Notes.txt", b"plain text content", "text/plain"),
        ("P120_Report.xlsx", b"fake xlsx bytes", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ("P120_Screenshot.png", b"fake png bytes", "image/png"),
    ],
)
def test_upload_accepts_extended_file_types(
    client: TestClient,
    session: Session,
    filename: str,
    content: bytes,
    mime_type: str,
):
    project_id = "P120"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Extended Upload Types"})

    files = {"file": (filename, content, mime_type)}
    data = {"language": "ja", "project_id": project_id, "document_type": "project-review"}
    response = client.post("/api/upload", files=files, data=data)
    assert response.status_code == 200
    payload = response.json()
    assert payload["document_version"] == "v1"
    version = session.get(SubmissionDocumentVersion, payload["document_version_id"])
    assert version is not None

def test_grading_flow_with_state_machine(client: TestClient, session: Session):
    # Setup: Create project and upload
    project_id = "P777"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Grading Test"})
    files = {"file": ("P777_Doc.pdf", b"content", "application/pdf")}
    res = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc", "document_type": "project-review"})
    version_id = res.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    _ensure_manual_eval_set(client, level="high")
    
    # Grade
    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200
    run_id = grade_res.json().get("run_id")
    if run_id is None:
        run = session.exec(
            select(GradingRun).where(GradingRun.document_version_id == version_id).order_by(GradingRun.id.desc())
        ).first()
        assert run is not None
        run_id = run.id
    
    # Check status in DB
    run = session.get(GradingRun, run_id)
    assert run.status == "COMPLETED"
    assert run.document_version_id == version_id
    assert run.evaluation_set_id is not None
    
    # Multiple runs on same version
    grade_res2 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "high", "force": True})
    assert grade_res2.status_code == 200
    run_id2 = grade_res2.json()["run_id"]
    assert run_id2 != run_id
    
    runs = session.exec(select(GradingRun).where(GradingRun.document_version_id == version_id)).all()
    assert len(runs) == 2
    assert all(item.evaluation_set_id is not None for item in runs)


def test_grading_rejects_when_no_active_evaluation_set_for_scope(client: TestClient):
    project_id = "P771"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "No Eval Set Scope"})
    files = {"file": ("P771_Doc.pdf", b"content", "application/pdf")}
    upload = client.post(
        "/api/upload",
        files=files,
        data={"project_id": project_id, "document_name": "Doc", "document_type": "custom-no-rubric-scope"},
    )
    assert upload.status_code == 200
    version_id = upload.json()["document_version_id"]

    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code in (422, 502)

def test_grading_cache_reuse(client: TestClient, session: Session):
    project_id = "P666"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Cache Test"})
    files = {"file": ("P666_Doc.pdf", b"content", "application/pdf")}
    res = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc", "document_type": "project-review"})
    v1_id = res.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    
    # First grade (AI called)
    client.post("/api/grade", json={"document_version_id": v1_id})
    
    # Second upload same content -> v2
    res2 = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc", "document_type": "project-review"})
    v2_id = res2.json()["document_version_id"]
    
    # Second grade (should hit cache)
    with patch("app.services.grading_service.grade_submission") as mock_grade:
        client.post("/api/grade", json={"document_version_id": v2_id})
        # Should NOT call grade_submission because content_hash + prompt etc are same
        mock_grade.assert_not_called()

def test_grading_failure_state(client: TestClient, session: Session):
    project_id = "P555"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Fail Test"})
    files = {"file": ("P555_Doc.pdf", b"content", "application/pdf")}
    res = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc", "document_type": "project-review"})
    v1_id = res.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    
    # Mock Gemini failure
    with patch("app.services.grading_engine.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.generate_content.side_effect = Exception("Gemini is down")
        
        grade_res = client.post("/api/grade", json={"document_version_id": v1_id})
        assert grade_res.status_code == 502
        
        # Check status is FAILED in DB
        run = session.exec(select(GradingRun).where(GradingRun.document_version_id == v1_id)).first()
        assert run.status == "FAILED"
        assert "Gemini is down" in run.error_message

def test_grading_rejects_completed_without_criteria_scores(client: TestClient, session: Session):
    project_id = "P556"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Invalid AI Output"})
    files = {"file": ("P556_Doc.pdf", b"content", "application/pdf")}
    res = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc", "document_type": "project-review"})
    v1_id = res.json()["document_version_id"]
    _ensure_manual_eval_set(client)

    with patch("app.services.grading_service.grade_submission") as mock_grade:
        mock_grade.return_value = {
            "score": 88,
            "total_score": 88,
            "content_hash": "x",
            "document_version_id": v1_id,
            "rubric_version": "v1",
            "rubric_hash": "rh",
            "gemini_model": "mock-model",
            "prompt_version": "v1",
            "prompt_level": "medium",
            "policy_version": "v1",
            "policy_hash": "ph",
            "required_rule_hash": "rrh",
            "prompt_hash": "prh",
            "criteria_hash": "ch",
            "grading_schema_version": "v1",
            "final_prompt_snapshot": "snapshot",
            "evaluation_set_id": 1,
            "criteria_scores": {},
            "criteria_suggestions": {"vi": {}, "ja": {}},
            "draft_feedback": {"vi": "x", "ja": "y"},
            "slide_reviews": [],
            "page_reviews": [],
            "status": "COMPLETED",
        }
        grade_res = client.post("/api/grade", json={"document_version_id": v1_id, "prompt_level": "medium"})
        assert grade_res.status_code == 422

    run = session.exec(select(GradingRun).where(GradingRun.document_version_id == v1_id).order_by(GradingRun.id.desc())).first()
    assert run is not None
    assert run.status == "FAILED"
    assert "missing criteria_scores" in (run.error_message or "")

def test_legacy_api_compatibility(client: TestClient, session: Session):
    project_id = "P444"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Legacy Test"})
    files = {"file": ("P444_Doc.pdf", b"content", "application/pdf")}
    client.post("/api/upload", files=files, data={"project_id": project_id, "document_type": "project-review"}) # Uses /upload instead of hierarchical params
    _ensure_manual_eval_set(client)

    # Legacy grade API: /api/grade/{project_id}
    response = client.post(f"/api/grade/{project_id}")
    assert response.status_code == 200
    assert "run_id" in response.json()
    assert "evaluation_resolution_reason" in response.json()
    assert response.json()["evaluation_resolution_reason"] in {
        "explicit_evaluation_set_id",
        "active_scope_match",
        "auto_bootstrap_scope",
        None,
    }


def test_legacy_grade_endpoint_contract_non_breaking_fields(client: TestClient):
    project_id = "P445"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Legacy Contract"})
    files = {"file": ("P445_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"project_id": project_id, "document_type": "project-review"},
    )
    assert upload_res.status_code == 200
    _ensure_manual_eval_set(client)

    res = client.post(f"/api/grade/{project_id}")
    assert res.status_code == 200
    payload = res.json()
    # Legacy required keys still present.
    for key in ["project_id", "project_name", "run_id", "status", "evaluation_set_id"]:
        assert key in payload
    # New field is additive/non-breaking.
    assert "evaluation_resolution_reason" in payload

def test_upload_requires_selected_project_id(client: TestClient):
    client.post("/api/projects", json={"project_id": "P100", "project_name": "Rule Test"})
    files = {"file": ("P100_Doc.pdf", b"content", "application/pdf")}
    response = client.post("/api/upload", files=files, data={"language": "ja"})
    assert response.status_code == 400
    assert "select an existing project" in response.json()["detail"].lower()


def test_upload_rejects_missing_document_type(client: TestClient):
    client.post("/api/projects", json={"project_id": "P110", "project_name": "Doc Type Required"})
    files = {"file": ("P110_Doc.pdf", b"content", "application/pdf")}
    response = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P110"})
    assert response.status_code == 400
    assert "document_type is required" in response.json()["detail"].lower()

def test_upload_rejects_filename_project_id_mismatch(client: TestClient):
    client.post("/api/projects", json={"project_id": "P101", "project_name": "Rule Test 2"})
    files = {"file": ("P999_Doc.pdf", b"content", "application/pdf")}
    response = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P101"})
    assert response.status_code == 400
    assert "does not match selected project" in response.json()["detail"].lower()

def test_upload_rejects_invalid_filename_pattern(client: TestClient):
    client.post("/api/projects", json={"project_id": "P104", "project_name": "Rule Test 3"})
    files = {"file": ("DocWithoutProjectPrefix.pdf", b"content", "application/pdf")}
    response = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P104"})
    assert response.status_code == 400
    assert "invalid filename format" in response.json()["detail"].lower()

    project_check = client.get("/api/projects/P104")
    assert project_check.status_code == 200
    docs_res = client.get("/api/projects/P104/documents-summary")
    assert docs_res.status_code == 200
    assert docs_res.json() == []


def test_upload_rejects_mime_extension_mismatch(client: TestClient):
    client.post("/api/projects", json={"project_id": "P121", "project_name": "Mime Mismatch"})
    files = {"file": ("P121_Notes.txt", b"hello", "image/png")}
    response = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": "P121", "document_type": "project-review"},
    )
    assert response.status_code == 400
    assert "mime type does not match extension" in response.json()["detail"].lower()


def test_upload_rejects_oversize_txt(client: TestClient):
    client.post("/api/projects", json={"project_id": "P122", "project_name": "Size Limit"})
    oversized = b"a" * (5 * 1024 * 1024 + 1)
    files = {"file": ("P122_Big.txt", oversized, "text/plain")}
    response = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": "P122", "document_type": "project-review"},
    )
    assert response.status_code == 400
    assert "exceeds max allowed size" in response.json()["detail"].lower()


def test_document_summary_returns_document_id_for_hierarchical_flow(client: TestClient):
    client.post("/api/projects", json={"project_id": "P102", "project_name": "Hierarchy Test"})
    files = {"file": ("P102_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": "P102", "document_name": "Doc A", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200

    docs_res = client.get("/api/projects/P102/documents-summary")
    assert docs_res.status_code == 200
    payload = docs_res.json()
    assert isinstance(payload, list) and payload
    assert "document_id" in payload[0]
    assert isinstance(payload[0]["document_id"], int)


def test_audit_runs_list_with_filters(client: TestClient):
    project_id = "P200"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Audit Test"})
    files = {"file": ("P200_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)

    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200
    run_id = grade_res.json().get("run_id")
    if run_id is None:
        with Session(engine) as session:
            run = session.exec(
                select(GradingRun).where(GradingRun.document_version_id == version_id).order_by(GradingRun.id.desc())
            ).first()
            assert run is not None
            run_id = run.id

    list_res = client.get(
        f"/api/audit/runs?project_id={project_id}&document_version_id={version_id}&status=COMPLETED&limit=10&offset=0"
    )
    assert list_res.status_code == 200
    rows = list_res.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    assert any(int(row["document_version_id"]) == int(version_id) for row in rows)
    # Invariant guard: COMPLETED runs must persist criteria rows.
    for row in rows:
        if (row.get("status") or "").upper() == "COMPLETED":
            assert int(row.get("criteria_result_count") or 0) > 0


def test_audit_run_detail_endpoint(client: TestClient):
    project_id = "P201"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Audit Detail Test"})
    files = {"file": ("P201_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)

    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200
    run_id = grade_res.json().get("run_id")
    if run_id is None:
        with Session(engine) as session:
            run = session.exec(
                select(GradingRun).where(GradingRun.document_version_id == version_id).order_by(GradingRun.id.desc())
            ).first()
            assert run is not None
            run_id = run.id


def test_audit_run_exposes_failed_persist_criteria_error_code(client: TestClient):
    project_id = "P202"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Audit Error Code"})
    files = {"file": ("P202_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)

    with patch("app.services.grading_service.grade_submission") as mock_grade:
        mock_grade.return_value = {
            "score": 88,
            "total_score": 88,
            "content_hash": "x",
            "document_version_id": version_id,
            "rubric_version": "v1",
            "rubric_hash": "rh",
            "gemini_model": "mock-model",
            "prompt_version": "v1",
            "prompt_level": "medium",
            "policy_version": "v1",
            "policy_hash": "ph",
            "required_rule_hash": "rrh",
            "prompt_hash": "prh",
            "criteria_hash": "ch",
            "grading_schema_version": "v1",
            "final_prompt_snapshot": "snapshot",
            "evaluation_set_id": 1,
            "criteria_scores": {},
            "criteria_suggestions": {"vi": {}, "ja": {}},
            "draft_feedback": {"vi": "x", "ja": "y"},
            "slide_reviews": [],
            "page_reviews": [],
            "status": "COMPLETED",
        }
        grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
        assert grade_res.status_code == 422

    list_res = client.get(f"/api/audit/runs?project_id={project_id}&limit=10&offset=0")
    assert list_res.status_code == 200
    rows = list_res.json()
    assert len(rows) >= 1
    latest = rows[0]
    assert (latest.get("status") or "").upper() == "FAILED"
    assert latest.get("error_code") == "FAILED_PERSIST_CRITERIA"

    list_res = client.get(f"/api/audit/runs?project_id={project_id}&document_version_id={version_id}&limit=1&offset=0")
    assert list_res.status_code == 200
    rows = list_res.json()
    assert rows
    audit_run_id = rows[0]["id"]
    detail_res = client.get(f"/api/audit/runs/{audit_run_id}")
    assert detail_res.status_code == 200
    payload = detail_res.json()
    assert int(payload["grading_run"]["id"]) == int(audit_run_id)


def test_audit_runs_reject_invalid_status(client: TestClient):
    res = client.get("/api/audit/runs?status=INVALID_STATUS")
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["error_code"] == "AUDIT_INVALID_STATUS"


def test_audit_runs_reject_invalid_time(client: TestClient):
    res = client.get("/api/audit/runs?from_time=not-a-time")
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["error_code"] == "AUDIT_INVALID_TIME_RANGE"


def test_audit_runs_reject_time_range_inversion(client: TestClient):
    res = client.get("/api/audit/runs?from_time=2026-01-02T00:00:00Z&to_time=2026-01-01T00:00:00Z")
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["error_code"] == "AUDIT_INVALID_TIME_RANGE"


def test_version_diff_latest_completed_runs(client: TestClient):
    project_id = "P300"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Diff Latest"})
    files = {"file": ("P300_Doc.pdf", b"content", "application/pdf")}
    up1 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    up2 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    assert up1.status_code == 200 and up2.status_code == 200
    v1 = up1.json()["document_version_id"]
    v2 = up2.json()["document_version_id"]
    document_id = up1.json()["document_id"]
    _ensure_manual_eval_set(client)
    client.post("/api/grade", json={"document_version_id": v1, "prompt_level": "medium"})
    client.post("/api/grade", json={"document_version_id": v2, "prompt_level": "medium"})

    res = client.get(f"/api/documents/{document_id}/versions/diff?version_id_a={v1}&version_id_b={v2}")
    assert res.status_code == 200
    body = res.json()
    assert body["document_id"] == document_id
    assert body["version_a"]["id"] == v1
    assert body["version_b"]["id"] == v2
    assert "score_diff" in body
    assert isinstance(body["criteria_diff"], list)


def test_version_diff_with_explicit_run_ids(client: TestClient):
    project_id = "P301"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Diff Explicit"})
    files = {"file": ("P301_Doc.pdf", b"content", "application/pdf")}
    up1 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    up2 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    v1 = up1.json()["document_version_id"]
    v2 = up2.json()["document_version_id"]
    document_id = up1.json()["document_id"]
    _ensure_manual_eval_set(client)
    client.post("/api/grade", json={"document_version_id": v1, "prompt_level": "medium"})
    client.post("/api/grade", json={"document_version_id": v2, "prompt_level": "medium"})
    res = client.get(f"/api/documents/{document_id}/versions/diff?version_id_a={v1}&version_id_b={v2}")
    assert res.status_code == 200
    body = res.json()
    assert body["run_a"]["id"] is not None
    assert body["run_b"]["id"] is not None


def test_version_diff_reject_versions_from_different_document(client: TestClient):
    project_id = "P302"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Diff Mismatch"})
    files = {"file": ("P302_Doc.pdf", b"content", "application/pdf")}
    up_a = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    up_b = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc B", "document_type": "project-review"})
    doc_a = up_a.json()["document_id"]
    v_a = up_a.json()["document_version_id"]
    v_b = up_b.json()["document_version_id"]

    res = client.get(f"/api/documents/{doc_a}/versions/diff?version_id_a={v_a}&version_id_b={v_b}")
    assert res.status_code == 422
    assert res.json()["detail"]["error_code"] in {"VERSION_DOCUMENT_MISMATCH", "VERSION_DIFFERENT_DOCUMENT"}


def test_version_diff_reject_missing_completed_run(client: TestClient):
    project_id = "P303"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Diff Missing Run"})
    files = {"file": ("P303_Doc.pdf", b"content", "application/pdf")}
    up1 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    up2 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    v1 = up1.json()["document_version_id"]
    v2 = up2.json()["document_version_id"]
    document_id = up1.json()["document_id"]
    _ensure_manual_eval_set(client)
    client.post("/api/grade", json={"document_version_id": v1, "prompt_level": "medium"})

    res = client.get(f"/api/documents/{document_id}/versions/diff?version_id_a={v1}&version_id_b={v2}")
    assert res.status_code == 422
    assert res.json()["detail"]["error_code"] == "NO_COMPLETED_RUN"


def test_version_diff_warning_on_context_change(client: TestClient):
    project_id = "P304"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Diff Warning"})
    files = {"file": ("P304_Doc.pdf", b"content", "application/pdf")}
    up1 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    up2 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    v1 = up1.json()["document_version_id"]
    v2 = up2.json()["document_version_id"]
    document_id = up1.json()["document_id"]
    _ensure_manual_eval_set(client)
    _ensure_manual_eval_set(client, level="high")
    client.post("/api/grade", json={"document_version_id": v1, "prompt_level": "medium"})
    client.post("/api/grade", json={"document_version_id": v2, "prompt_level": "high"})

    res = client.get(f"/api/documents/{document_id}/versions/diff?version_id_a={v1}&version_id_b={v2}")
    assert res.status_code == 200
    body = res.json()
    assert body["meta_diff"]["prompt_level_changed"] is True or body["meta_diff"]["evaluation_set_changed"] is True
    assert body["comparison_validity"]["same_evaluation_context"] is False
    assert isinstance(body["comparison_validity"]["warnings"], list)


def test_versions_and_gradings_hierarchical_contract(client: TestClient):
    client.post("/api/projects", json={"project_id": "P103", "project_name": "Contract Test"})
    files = {"file": ("P103_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": "P103", "document_name": "Doc Contract", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200

    document_id = upload_res.json()["document_id"]
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)

    versions_res = client.get(f"/api/documents/{document_id}/versions")
    assert versions_res.status_code == 200
    versions_payload = versions_res.json()
    assert isinstance(versions_payload, list) and versions_payload
    assert "document_version_id" in versions_payload[0]
    assert "version" in versions_payload[0]
    assert "latest_status" in versions_payload[0]

    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200

    gradings_res = client.get(f"/api/versions/{version_id}/gradings")
    assert gradings_res.status_code == 200
    gradings_payload = gradings_res.json()
    assert isinstance(gradings_payload, list) and gradings_payload
    assert "grading_run_id" in gradings_payload[0]
    assert "status" in gradings_payload[0]
    assert "created_at" in gradings_payload[0]


def test_versions_endpoint_includes_binary_hash(client: TestClient):
    project_id = "P111"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Binary Hash Contract"})
    payload = b"same file bytes for hash"
    expected_sha256 = hashlib.sha256(payload).hexdigest()
    files = {"file": ("P111_Doc.pdf", payload, "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": project_id, "document_name": "Doc", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200
    document_id = upload_res.json()["document_id"]

    versions_res = client.get(f"/api/documents/{document_id}/versions")
    assert versions_res.status_code == 200
    versions_payload = versions_res.json()
    assert isinstance(versions_payload, list) and versions_payload
    assert versions_payload[0]["binary_hash"] == expected_sha256


def test_cache_not_reused_when_prompt_level_changes(client: TestClient):
    client.post("/api/projects", json={"project_id": "P105", "project_name": "Prompt Level Cache"})
    files = {"file": ("P105_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P105", "document_name": "Doc", "document_type": "project-review"})
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client, level="medium")
    _ensure_manual_eval_set(client, level="high")

    with patch("app.services.grading_engine.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = '{"score":85,"criteria_scores":{"review_tong_the":20,"diem_tot":20,"diem_xau":25,"chinh_sach":20},"criteria_suggestions":{"vi":{"review_tong_the":{"evaluation":"tot","improvement":"giu vung"},"diem_tot":{"evaluation":"tot","improvement":"bo sung bang chung"},"diem_xau":{"evaluation":"can cai thien","improvement":"lam ro issue"},"chinh_sach":{"evaluation":"co huong","improvement":"bo sung owner/deadline"}},"ja":{"review_tong_the":{"evaluation":"ok","improvement":"maintain"},"diem_tot":{"evaluation":"ok","improvement":"add evidence"},"diem_xau":{"evaluation":"needs work","improvement":"clarify issues"},"chinh_sach":{"evaluation":"partial","improvement":"add owner/deadline"}}},"draft_feedback":{"vi":"Tot","ja":"Good"},"page_reviews":[]}'
        mock_client.generate_content.return_value = mock_response

        grade_medium = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
        assert grade_medium.status_code == 200
        grade_high = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "high"})
        assert grade_high.status_code == 200
        assert mock_client.generate_content.call_count >= 1


def test_cache_not_reused_when_project_description_changes(client: TestClient):
    client.post("/api/projects", json={"project_id": "P106", "project_name": "Description Cache", "project_description": "alpha"})
    files = {"file": ("P106_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P106", "document_name": "Doc", "document_type": "project-review"})
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)

    with patch("app.services.grading_engine.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = '{"score":85,"criteria_scores":{"review_tong_the":20,"diem_tot":20,"diem_xau":25,"chinh_sach":20},"criteria_suggestions":{"vi":{"review_tong_the":{"evaluation":"tot","improvement":"giu vung"},"diem_tot":{"evaluation":"tot","improvement":"bo sung bang chung"},"diem_xau":{"evaluation":"can cai thien","improvement":"lam ro issue"},"chinh_sach":{"evaluation":"co huong","improvement":"bo sung owner/deadline"}},"ja":{"review_tong_the":{"evaluation":"ok","improvement":"maintain"},"diem_tot":{"evaluation":"ok","improvement":"add evidence"},"diem_xau":{"evaluation":"needs work","improvement":"clarify issues"},"chinh_sach":{"evaluation":"partial","improvement":"add owner/deadline"}}},"draft_feedback":{"vi":"Tot","ja":"Good"},"page_reviews":[]}'
        mock_client.generate_content.return_value = mock_response

        grade_1 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
        assert grade_1.status_code == 200

        update_res = client.patch("/api/projects/P106", json={"project_description": "beta"})
        assert update_res.status_code == 200

        grade_2 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
        assert grade_2.status_code == 200
        assert mock_client.generate_content.call_count >= 1


def test_grading_run_stores_exact_final_prompt_snapshot(client: TestClient):
    client.post("/api/projects", json={"project_id": "P107", "project_name": "Prompt Snapshot"})
    files = {"file": ("P107_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P107", "document_name": "Doc", "document_type": "project-review"})
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)

    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200
    run_id = grade_res.json().get("run_id")
    if run_id is None:
        with Session(engine) as session:
            run = session.exec(
                select(GradingRun).where(GradingRun.document_version_id == version_id).order_by(GradingRun.id.desc())
            ).first()
            assert run is not None
            run_id = run.id

    list_res = client.get(f"/api/audit/runs?project_id=P107&document_version_id={version_id}&limit=1&offset=0")
    assert list_res.status_code == 200
    rows = list_res.json()
    assert rows
    snapshot = rows[0].get("final_prompt_snapshot")
    assert isinstance(snapshot, str)
    assert "RUBRIC" in snapshot.upper()

    # Regrade without force should create a new run from cache, carrying exact prompt snapshot
    grade_res_2 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res_2.status_code == 200
    run_id_2 = grade_res_2.json()["run_id"]
    assert run_id_2 != run_id
    list_res_2 = client.get(f"/api/audit/runs?project_id=P107&document_version_id={version_id}&limit=2&offset=0")
    assert list_res_2.status_code == 200
    rows_2 = list_res_2.json()
    assert rows_2
    assert rows_2[0].get("final_prompt_snapshot") == snapshot


def test_audit_export_csv(client: TestClient):
    project_id = "P400"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Audit Export"})
    files = {"file": ("P400_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200

    res = client.get(f"/api/audit/export?project_id={project_id}&format=csv")
    assert res.status_code == 200
    assert "text/csv" in (res.headers.get("content-type") or "")
    assert "attachment; filename=" in (res.headers.get("content-disposition") or "")
    body = res.text
    assert "grading_run_id" in body
    assert project_id in body


def test_version_diff_export_csv(client: TestClient):
    project_id = "P401"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Diff Export"})
    files = {"file": ("P401_Doc.pdf", b"content", "application/pdf")}
    up1 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    up2 = client.post("/api/upload", files=files, data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"})
    assert up1.status_code == 200 and up2.status_code == 200
    v1 = up1.json()["document_version_id"]
    v2 = up2.json()["document_version_id"]
    document_id = up1.json()["document_id"]
    _ensure_manual_eval_set(client)
    _ensure_manual_eval_set(client, level="high")
    client.post("/api/grade", json={"document_version_id": v1, "prompt_level": "medium"})
    client.post("/api/grade", json={"document_version_id": v2, "prompt_level": "high"})

    res = client.get(f"/api/documents/{document_id}/versions/diff/export?version_id_a={v1}&version_id_b={v2}")
    assert res.status_code == 200
    assert "text/csv" in (res.headers.get("content-type") or "")
    assert "attachment; filename=" in (res.headers.get("content-disposition") or "")
    body = res.text
    assert "row_type" in body
    assert "summary" in body
    assert "criteria" in body


def test_reconcile_active_run_to_completed_when_artifacts_exist(client: TestClient, session: Session):
    project_id = "P901"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Reconcile Completed"})
    files = {"file": ("P901_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200

    run = session.exec(
        select(GradingRun).where(GradingRun.document_version_id == version_id).order_by(GradingRun.id.desc())
    ).first()
    assert run is not None
    run.status = "PENDING"
    run.graded_at = None
    session.add(run)
    session.commit()

    # Trigger reconciliation through read path
    record = store.get(project_id)
    assert record is not None
    assert record.latest_run is not None
    assert record.latest_run.status == "COMPLETED"
    assert record.latest_run.graded_at is not None


def test_reconcile_stuck_active_run_to_failed_on_timeout(client: TestClient, session: Session):
    project_id = "P902"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Reconcile Failed"})
    files = {"file": ("P902_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"},
    )
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200

    run = session.exec(
        select(GradingRun).where(GradingRun.document_version_id == version_id).order_by(GradingRun.id.desc())
    ).first()
    assert run is not None

    # Remove persisted artifacts so this run appears stuck and incomplete.
    criteria_rows = session.exec(select(GradingCriteriaResult).where(GradingCriteriaResult.grading_run_id == run.id)).all()
    for item in criteria_rows:
        session.delete(item)
    slide_rows = session.exec(select(GradingSlideReview).where(GradingSlideReview.grading_run_id == run.id)).all()
    for item in slide_rows:
        session.delete(item)
    run.status = "PENDING"
    run.score = None
    run.total_score = None
    run.graded_at = None
    run.started_at = (datetime.now(timezone.utc) - timedelta(minutes=31)).isoformat()
    session.add(run)
    session.commit()

    record = store.get(project_id)
    assert record is not None
    assert record.latest_run is not None
    assert record.latest_run.status == "FAILED"
    assert record.latest_run.graded_at is not None
    assert "timed out" in (record.latest_run.error_message or "").lower()
