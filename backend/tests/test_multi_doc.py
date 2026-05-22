import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, select
from app.main import app
from app.database import engine
from app.models import Submission, GradingRun, SubmissionDocumentVersion

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_multi_document_status_persistence(client):
    # 1. Create project
    pid = "P2002"
    client.post("/api/projects", json={"project_id": pid, "project_name": "Multi Doc Status"})
    
    # 2. Upload Document A
    files_a = {"file": ("P2002_doc_a.pdf", b"%PDF-1.4\n%Hello World\n%%EOF", "application/pdf")}
    data_a = {"project_id": pid, "document_name": "Doc A", "document_type": "project-review"}
    resp = client.post("/api/upload", data=data_a, files=files_a)
    assert resp.status_code == 200
    
    # Manually create a COMPLETED grading run for A
    with Session(engine) as session:
        sub = session.exec(select(Submission).where(Submission.project_id == pid)).first()
        assert sub is not None, f"Project {pid} not found"
        
        # Check all versions
        versions = session.exec(select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == sub.id)).all()
        assert len(versions) > 0, f"No versions found for submission {sub.id}"
        v_a = versions[0]
        
        run = GradingRun(
            submission_id=sub.id,
            document_version_id=v_a.id,
            status="completed",
            score=85,
            content_hash=v_a.content_hash
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        
        sub.latest_grading_run_id = run.id
        session.add(sub)
        session.commit()

    # Verify project summary is COMPLETED
    resp_sum = client.get("/api/projects")
    project = next(p for p in resp_sum.json() if p["project_id"] == pid)
    assert project["latest_status"] == "completed"
    
    # 3. Upload Document B (Different document)
    files_b = {"file": ("P2002_doc_b.pdf", b"%PDF-1.4\n%Hello World\n%%EOF", "application/pdf")}
    client.post("/api/upload", data={"project_id": pid, "document_name": "Doc B", "document_type": "project-review"}, files=files_b)
    
    # Verify project summary STILL shows COMPLETED
    resp_sum2 = client.get("/api/projects")
    project2 = next(p for p in resp_sum2.json() if p["project_id"] == pid)
    assert project2["latest_status"] == "completed"
    
    # 4. Upload Version 2 of Document A
    client.post("/api/upload", data={"project_id": pid, "document_name": "Doc A", "document_type": "project-review"}, files=files_a)
    
    # With current summary logic, latest_status remains from latest completed run.
    resp_sum3 = client.get("/api/projects")
    project3 = next(p for p in resp_sum3.json() if p["project_id"] == pid)
    assert project3["latest_status"] == "completed"
