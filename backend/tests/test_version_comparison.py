import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select, delete
from app.main import app
from app.database import engine
from app.models import Submission, GradingRun, SubmissionDocumentVersion, GradingCriteriaResult

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_version_comparison_logic(client):
    # 1. Setup Project and Document
    pid = "P4001"
    client.delete(f"/api/submissions/{pid}")
    client.post("/api/projects", json={"project_id": pid, "project_name": "Compare Test"})
    
    # 2. Upload V1
    files_v1 = {"file": ("P4001_v1.pdf", b"%PDF-1.4\n%V1\n%%EOF", "application/pdf")}
    resp = client.post("/api/upload", data={"project_id": pid, "document_name": "Report", "document_type": "project-review"}, files=files_v1)
    v1_id = resp.json()["document_version_id"]
    doc_id = resp.json()["document_id"]
    
    # 3. Upload V2
    files_v2 = {"file": ("P4001_v2.pdf", b"%PDF-1.4\n%V2\n%%EOF", "application/pdf")}
    resp = client.post("/api/upload", data={"project_id": pid, "document_name": "Report", "document_type": "project-review"}, files=files_v2)
    v2_id = resp.json()["document_version_id"]

    with Session(engine) as session:
        sub = session.exec(select(Submission).where(Submission.project_id == pid)).first()
        
        # Create completed run for V1
        run1 = GradingRun(
            submission_id=sub.id,
            document_version_id=v1_id,
            status="completed",
            score=70,
            total_score=70,
            content_hash="hash1",
            graded_at="2024-01-01T00:00:00Z"
        )
        session.add(run1)
        session.commit()
        session.refresh(run1)
        run1_id = run1.id
        
        # Add criteria for V1
        session.exec(delete(GradingCriteriaResult).where(GradingCriteriaResult.grading_run_id == run1.id))
        c1 = GradingCriteriaResult(grading_run_id=run1.id, criterion_key="crit1", score=15, max_score=20)
        session.add(c1)
        session.commit()
        
        # Create completed run for V2 (Latest)
        run2 = GradingRun(
            submission_id=sub.id,
            document_version_id=v2_id,
            status="completed",
            score=80,
            total_score=80,
            content_hash="hash2",
            graded_at="2024-01-02T00:00:00Z"
        )
        session.add(run2)
        session.commit()
        session.refresh(run2)
        run2_id = run2.id
        
        # Add criteria for V2
        session.exec(delete(GradingCriteriaResult).where(GradingCriteriaResult.grading_run_id == run2.id))
        c2 = GradingCriteriaResult(grading_run_id=run2.id, criterion_key="crit1", score=18, max_score=20)
        session.add(c2)
        session.commit()
        
        # Create a pending run for V2 (should be ignored by latest completed logic)
        run_pending = GradingRun(
            submission_id=sub.id,
            document_version_id=v2_id,
            status="grading",
            content_hash="hash2",
            graded_at="2024-01-03T00:00:00Z"
        )
        session.add(run_pending)
        session.commit()

    # 4. Test Comparison
    resp = client.get(f"/api/documents/{doc_id}/compare?base_version_id={v1_id}&compare_version_id={v2_id}")
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["score_delta"] == 10
    
    # Check structured criteria_deltas
    crit_delta = next(d for d in data["criteria_deltas"] if d["key"] == "crit1")
    assert crit_delta["delta"] == 3.0
    assert crit_delta["status"] == "improved"
    
    assert data["base_run"]["id"] == run1_id
    assert data["compare_run"]["id"] == run2_id
    
    # Check deterministic insights
    assert any("Score improved by 10 points" in msg for msg in data["insights"])
    assert any("Significant improvement in 'crit1'" in msg for msg in data["insights"])
    
def test_version_comparison_missing_data(client):
    pid = "P4002"
    client.delete(f"/api/submissions/{pid}")
    client.post("/api/projects", json={"project_id": pid, "project_name": "Compare Missing"})
    
    # Upload V1 and V2 but no grading
    resp1 = client.post("/api/upload", data={"project_id": pid, "document_name": "Doc", "document_type": "project-review"}, files={"file": ("P4002_v1.pdf", b"v1", "application/pdf")})
    v1_id = resp1.json()["document_version_id"]
    doc_id = resp1.json()["document_id"]
    
    resp2 = client.post("/api/upload", data={"project_id": pid, "document_name": "Doc", "document_type": "project-review"}, files={"file": ("P4002_v2.pdf", b"v2", "application/pdf")})
    v2_id = resp2.json()["document_version_id"]
    
    resp = client.get(f"/api/documents/{doc_id}/compare?base_version_id={v1_id}&compare_version_id={v2_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["base_run"] is None
    assert data["compare_run"] is None
    assert data["score_delta"] is None
