from app.metrics import observe_queue_delay_seconds


def test_api_latency_metric_exposed(client):
    health_res = client.get("/api/health")
    assert health_res.status_code == 200

    metrics_res = client.get("/metrics")
    assert metrics_res.status_code == 200
    body = metrics_res.text
    assert "api_request_duration_seconds" in body
    assert 'route="/api/health"' in body
    assert 'method="GET"' in body


def test_queue_delay_metric_exposed(client):
    observe_queue_delay_seconds(
        0.25,
        document_type="project-review",
        prompt_level="medium",
    )
    metrics_res = client.get("/metrics")
    assert metrics_res.status_code == 200
    body = metrics_res.text
    assert "grading_queue_delay_seconds" in body
    assert 'document_type="project-review"' in body
    assert 'prompt_level="medium"' in body
    assert 'status="QUEUED"' in body


def test_audit_query_and_export_metrics_exposed(client):
    project_id = "P520"
    create_project = client.post("/api/projects", json={"project_id": project_id, "project_name": "Metrics Audit Export"})
    assert create_project.status_code == 200

    upload = client.post(
        "/api/upload",
        files={"file": ("P520_Doc.pdf", b"content", "application/pdf")},
        data={"language": "ja", "project_id": project_id, "document_name": "Doc A", "document_type": "project-review"},
    )
    assert upload.status_code == 200
    version_id = upload.json()["document_version_id"]

    client.post("/api/mgmt/prompts", json={
        "document_type": "project-review",
        "level": "medium",
        "version": "v1",
        "content": "manual prompt v1",
        "activate": True,
    })
    client.post("/api/mgmt/policies", json={
        "level": "medium",
        "version": "v1",
        "content": "manual policy v1",
        "activate": True,
    })
    client.post("/api/mgmt/evaluation-sets/bootstrap", json={
        "document_type": "project-review",
        "level": "medium",
    })
    grade_res = client.post("/api/grade", json={"document_version_id": version_id, "prompt_level": "medium"})
    assert grade_res.status_code == 200

    runs_res = client.get(f"/api/audit/runs?project_id={project_id}&limit=20&offset=0")
    assert runs_res.status_code == 200
    export_res = client.get(f"/api/audit/export?project_id={project_id}&format=csv")
    assert export_res.status_code == 200
    _ = export_res.text

    metrics_res = client.get("/metrics")
    assert metrics_res.status_code == 200
    body = metrics_res.text
    assert "audit_query_duration_seconds" in body
    assert 'audit_query_duration_seconds_count{status="OK"}' in body
    assert "export_duration_seconds" in body
    assert 'export_duration_seconds_count{endpoint="/api/audit/export",status="OK"}' in body
    assert "export_rows_total" in body
    assert 'export_rows_total{endpoint="/api/audit/export"}' in body
