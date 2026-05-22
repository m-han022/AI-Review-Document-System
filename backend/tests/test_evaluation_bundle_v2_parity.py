def _seed_scope(client):
    client.post("/api/mgmt/rubrics", json={
        "document_type": "project-review",
        "version": "v1",
        "prompt": {"vi": "rubric", "ja": "rubric"},
        "criteria": [
            {"key": "review_tong_the", "max_score": 25, "labels": {"vi": "A", "ja": "A"}},
            {"key": "diem_tot", "max_score": 25, "labels": {"vi": "B", "ja": "B"}},
            {"key": "diem_xau", "max_score": 30, "labels": {"vi": "C", "ja": "C"}},
            {"key": "chinh_sach", "max_score": 20, "labels": {"vi": "D", "ja": "D"}},
        ],
        "activate": True,
    })
    client.post("/api/mgmt/prompts", json={
        "document_type": "project-review",
        "level": "medium",
        "version": "v1",
        "content": "prompt",
        "activate": True,
    })
    client.post("/api/mgmt/policies", json={
        "level": "medium",
        "version": "v1",
        "content": "policy",
        "activate": True,
    })
    boot = client.post("/api/mgmt/evaluation-bundles/bootstrap", json={"document_type": "project-review", "level": "medium"})
    assert boot.status_code == 200


def test_evaluation_bundles_list_available(client):
    _seed_scope(client)
    res = client.get("/api/mgmt/evaluation-bundles?document_type=project-review&level=medium")
    assert res.status_code == 200
    rows = res.json()
    assert rows
