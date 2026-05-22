import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.models import Submission, SubmissionDocument, SubmissionDocumentVersion, GradingRun
from unittest.mock import patch, MagicMock

@pytest.fixture(autouse=True)
def mock_gemini_local():
    with patch("app.services.grading_engine.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Mocking generate_content response
        mock_response = MagicMock()
        mock_response.text = '{"score": 85, "criteria": {}, "slides": []}'
        mock_client.generate_content.return_value = mock_response
        yield mock_client

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

def test_multiple_documents_same_type_different_name(client: TestClient, session: Session):
    # 1. Create project
    client.post("/api/projects", json={"project_id": "P3001", "project_name": "Multi Doc Project"})
    
    # 2. Upload Document A
    file_content = b"Content A"
    files = {"file": ("P3001_doc_a.pdf", file_content, "application/pdf")}
    data = {
        "project_id": "P3001",
        "document_type": "project-review",
        "document_name": "Document A"
    }
    resp1 = client.post("/api/upload", data=data, files=files)
    assert resp1.status_code == 200
    doc_a_id = resp1.json()["document_id"]
    
    # 3. Upload Document B (Same type, different name)
    files = {"file": ("P3001_doc_b.pdf", file_content, "application/pdf")}
    data["document_name"] = "Document B"
    resp2 = client.post("/api/upload", data=data, files=files)
    assert resp2.status_code == 200
    doc_b_id = resp2.json()["document_id"]
    
    assert doc_a_id != doc_b_id
    
    # 4. Verify project summary shows 2 documents
    resp_sum = client.get("/api/projects")
    data = resp_sum.json()
    projects = data["submissions"] if isinstance(data, dict) and "submissions" in data else data
    project = next(p for p in projects if p["project_id"] == "P3001")
    assert project["total_documents"] == 2

def test_multiple_versions_and_runs(client: TestClient, session: Session):
    # 1. Create project
    client.post("/api/projects", json={"project_id": "P3002", "project_name": "Versions Project"})
    
    # 2. Upload v1
    files = {"file": ("P3002_doc.pdf", b"Content v1", "application/pdf")}
    data = {"project_id": "P3002", "document_type": "project-review", "document_name": "Doc"}
    resp_v1 = client.post("/api/upload", data=data, files=files)
    v1_id = resp_v1.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    
    # 3. Grade v1
    client.post("/api/grade", json={"document_version_id": v1_id})
    
    # 4. Upload v2 (Same document name)
    files = {"file": ("P3002_doc.pdf", b"Content v2", "application/pdf")}
    resp_v2 = client.post("/api/upload", data=data, files=files)
    v2_id = resp_v2.json()["document_version_id"]
    assert v2_id != v1_id
    
    # 5. Grade v2 twice (to check multiple runs for same version)
    client.post("/api/grade", json={"document_version_id": v2_id})
    client.post("/api/grade", json={"document_version_id": v2_id, "force": True})
    
    # 6. Verify version history
    resp_vers = client.get(f"/api/submissions/P3002/versions")
    assert len(resp_vers.json()) == 2
    
    # 7. Verify grading runs for v2
    resp_runs = client.get(f"/api/versions/{v2_id}/gradings")
    assert len(resp_runs.json()) == 2

def test_cache_reuse_audit_trail(client: TestClient, session: Session, mock_gemini_local: MagicMock):
    # 1. Create project
    client.post("/api/projects", json={"project_id": "P3003", "project_name": "Cache Project"})
    
    # 2. Upload v1
    content = b"Identical Content"
    files = {"file": ("P3003_doc.pdf", content, "application/pdf")}
    data = {"project_id": "P3003", "document_type": "project-review", "document_name": "Doc"}
    resp_v1 = client.post("/api/upload", data=data, files=files)
    v1_id = resp_v1.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    
    # 3. Grade v1
    client.post("/api/grade", json={"document_version_id": v1_id})
    assert mock_gemini_local.generate_content.call_count == 1
    
    # 4. Upload v2 (Identical content)
    resp_v2 = client.post("/api/upload", data=data, files=files)
    v2_id = resp_v2.json()["document_version_id"]
    
    # 5. Grade v2 (Should reuse cache)
    client.post("/api/grade", json={"document_version_id": v2_id})
    
    # Gemini should NOT have been called again (call_count should still be 1)
    assert mock_gemini_local.generate_content.call_count == 1
    
    # BUT a NEW grading run should exist for v2
    resp_runs_v2 = client.get(f"/api/versions/{v2_id}/gradings")
    assert len(resp_runs_v2.json()) == 1
    
    # And it should be different from v1 run
    resp_runs_v1 = client.get(f"/api/versions/{v1_id}/gradings")
    assert resp_runs_v1.json()[0]["grading_run_id"] != resp_runs_v2.json()[0]["grading_run_id"]

def test_failed_grading_does_not_affect_version(client: TestClient, session: Session, mock_gemini_local: MagicMock):
    # Mock failure
    mock_gemini_local.generate_content.side_effect = Exception("AI Error")
    
    # 1. Create project & upload
    client.post("/api/projects", json={"project_id": "P3004", "project_name": "Fail Project"})
    files = {"file": ("P3004_doc.pdf", b"Content", "application/pdf")}
    data = {"project_id": "P3004", "document_type": "project-review", "document_name": "Doc"}
    resp = client.post("/api/upload", data=data, files=files)
    v_id = resp.json()["document_version_id"]
    _ensure_manual_eval_set(client)
    
    # 2. Grade (Fails)
    client.post("/api/grade", json={"document_version_id": v_id})
    
    # 3. Verify version still exists
    resp_vers = client.get(f"/api/submissions/P3004/versions")
    assert len(resp_vers.json()) == 1
    
    # 4. Verify run status is FAILED in summary
    resp_proj = client.get("/api/projects")
    data = resp_proj.json()
    projects = data["submissions"] if isinstance(data, dict) and "submissions" in data else data
    project = next(p for p in projects if p["project_id"] == "P3004")
    assert project["latest_status"] == "failed"
    assert "AI Error" in project["latest_error_message"]

def test_legacy_api_parity(client: TestClient, session: Session):
    # Verify the old /submissions endpoints still work
    resp = client.get("/api/submissions")
    assert resp.status_code == 200
    assert "submissions" in resp.json()
