import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.models import Submission, SubmissionDocument, SubmissionDocumentVersion, GradingRun
from unittest.mock import patch, MagicMock

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
    data = {"language": "ja", "project_id": "P888"}
    
    # P888 was never created
    response = client.post("/api/upload", files=files, data=data)
    assert response.status_code == 400 # UploadService raises ValueError which becomes 400 in router
    assert "Project does not exist" in response.json()["detail"]

    # Must not auto-create project implicitly
    project_check = client.get("/api/projects/P888")
    assert project_check.status_code == 404

def test_grading_flow_with_state_machine(client: TestClient, session: Session):
    # Setup: Create project and upload
    project_id = "P777"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Grading Test"})
    files = {"file": ("P777_Doc.pdf", b"content", "application/pdf")}
    res = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc"})
    version_id = res.json()["document_version_id"]
    
    # Grade
    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200
    run_id = grade_res.json()["run_id"]
    
    # Check status in DB
    run = session.get(GradingRun, run_id)
    assert run.status == "COMPLETED"
    assert run.document_version_id == version_id
    
    # Multiple runs on same version
    grade_res2 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "high", "force": True})
    assert grade_res2.status_code == 200
    run_id2 = grade_res2.json()["run_id"]
    assert run_id2 != run_id
    
    runs = session.exec(select(GradingRun).where(GradingRun.document_version_id == version_id)).all()
    assert len(runs) == 2

def test_grading_cache_reuse(client: TestClient, session: Session):
    project_id = "P666"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Cache Test"})
    files = {"file": ("P666_Doc.pdf", b"content", "application/pdf")}
    res = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc"})
    v1_id = res.json()["document_version_id"]
    
    # First grade (AI called)
    client.post("/api/grade", json={"document_version_id": v1_id})
    
    # Second upload same content -> v2
    res2 = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc"})
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
    res = client.post("/api/upload", files=files, data={"project_id": project_id, "document_name": "Doc"})
    v1_id = res.json()["document_version_id"]
    
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

def test_legacy_api_compatibility(client: TestClient, session: Session):
    project_id = "P444"
    client.post("/api/projects", json={"project_id": project_id, "project_name": "Legacy Test"})
    files = {"file": ("P444_Doc.pdf", b"content", "application/pdf")}
    client.post("/api/upload", files=files, data={"project_id": project_id}) # Uses /upload instead of hierarchical params

    # Legacy grade API: /api/grade/{project_id}
    response = client.post(f"/api/grade/{project_id}")
    assert response.status_code == 200
    assert "run_id" in response.json()

def test_upload_requires_selected_project_id(client: TestClient):
    client.post("/api/projects", json={"project_id": "P100", "project_name": "Rule Test"})
    files = {"file": ("P100_Doc.pdf", b"content", "application/pdf")}
    response = client.post("/api/upload", files=files, data={"language": "ja"})
    assert response.status_code == 400
    assert "select an existing project" in response.json()["detail"].lower()

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


def test_document_summary_returns_document_id_for_hierarchical_flow(client: TestClient):
    client.post("/api/projects", json={"project_id": "P102", "project_name": "Hierarchy Test"})
    files = {"file": ("P102_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": "P102", "document_name": "Doc A"},
    )
    assert upload_res.status_code == 200

    docs_res = client.get("/api/projects/P102/documents-summary")
    assert docs_res.status_code == 200
    payload = docs_res.json()
    assert isinstance(payload, list) and payload
    assert "document_id" in payload[0]
    assert isinstance(payload[0]["document_id"], int)


def test_versions_and_gradings_hierarchical_contract(client: TestClient):
    client.post("/api/projects", json={"project_id": "P103", "project_name": "Contract Test"})
    files = {"file": ("P103_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post(
        "/api/upload",
        files=files,
        data={"language": "ja", "project_id": "P103", "document_name": "Doc Contract"},
    )
    assert upload_res.status_code == 200

    document_id = upload_res.json()["document_id"]
    version_id = upload_res.json()["document_version_id"]

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


def test_cache_not_reused_when_prompt_level_changes(client: TestClient):
    client.post("/api/projects", json={"project_id": "P105", "project_name": "Prompt Level Cache"})
    files = {"file": ("P105_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P105", "document_name": "Doc"})
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]

    with patch("app.services.grading_engine.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = '{"score": 85, "criteria_scores": {"review_tong_the": 20, "diem_tot": 20, "diem_xau": 25, "chinh_sach": 20}, "criteria_suggestions": {"vi": {}, "ja": {}}, "draft_feedback": {"vi": "Tot", "ja": "Good"}, "slide_reviews": []}'
        mock_client.generate_content.return_value = mock_response

        grade_medium = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
        assert grade_medium.status_code == 200
        grade_high = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "high"})
        assert grade_high.status_code == 200
        assert mock_client.generate_content.call_count == 2


def test_cache_not_reused_when_project_description_changes(client: TestClient):
    client.post("/api/projects", json={"project_id": "P106", "project_name": "Description Cache", "project_description": "alpha"})
    files = {"file": ("P106_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P106", "document_name": "Doc"})
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]

    with patch("app.services.grading_engine.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = '{"score": 85, "criteria_scores": {"review_tong_the": 20, "diem_tot": 20, "diem_xau": 25, "chinh_sach": 20}, "criteria_suggestions": {"vi": {}, "ja": {}}, "draft_feedback": {"vi": "Tot", "ja": "Good"}, "slide_reviews": []}'
        mock_client.generate_content.return_value = mock_response

        grade_1 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
        assert grade_1.status_code == 200

        update_res = client.patch("/api/projects/P106", json={"project_description": "beta"})
        assert update_res.status_code == 200

        grade_2 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
        assert grade_2.status_code == 200
        assert mock_client.generate_content.call_count == 2


def test_grading_run_stores_exact_final_prompt_snapshot(client: TestClient):
    client.post("/api/projects", json={"project_id": "P107", "project_name": "Prompt Snapshot"})
    files = {"file": ("P107_Doc.pdf", b"content", "application/pdf")}
    upload_res = client.post("/api/upload", files=files, data={"language": "ja", "project_id": "P107", "document_name": "Doc"})
    assert upload_res.status_code == 200
    version_id = upload_res.json()["document_version_id"]

    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200
    run_id = grade_res.json()["run_id"]

    detail = client.get(f"/api/grading-runs/{run_id}")
    assert detail.status_code == 200
    snapshot = detail.json()["grading_run"].get("final_prompt_snapshot")
    assert isinstance(snapshot, str)
    assert "IMPORTANT RULES" in snapshot

    # Regrade without force should create a new run from cache, carrying exact prompt snapshot
    grade_res_2 = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res_2.status_code == 200
    run_id_2 = grade_res_2.json()["run_id"]
    assert run_id_2 != run_id
    detail_2 = client.get(f"/api/grading-runs/{run_id_2}")
    assert detail_2.status_code == 200
    assert detail_2.json()["grading_run"].get("final_prompt_snapshot") == snapshot
