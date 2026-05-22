def _seed_bundle_scope(client):
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
    boot = client.post(
        "/api/mgmt/evaluation-bundles/bootstrap",
        json={"document_type": "project-review", "level": "medium", "name": "bundle-v2-lifecycle"},
    )
    assert boot.status_code == 200
    return boot.json()["id"]


def test_evaluation_bundle_v2_lifecycle_transitions(client):
    bundle_id = _seed_bundle_scope(client)

    res_validate = client.post(f"/api/mgmt/evaluation-bundles/{bundle_id}/validate")
    assert res_validate.status_code == 200
    assert res_validate.json()["status"] == "validated"

    res_approve = client.post(f"/api/mgmt/evaluation-bundles/{bundle_id}/approve")
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "approved"

    res_activate = client.post(f"/api/mgmt/evaluation-bundles/{bundle_id}/activate")
    assert res_activate.status_code == 200
    assert res_activate.json()["status"] == "active"

    res_archive = client.post(f"/api/mgmt/evaluation-bundles/{bundle_id}/archive")
    assert res_archive.status_code == 200
    assert res_archive.json()["status"] == "archived"

