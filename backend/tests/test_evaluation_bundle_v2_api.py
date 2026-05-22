def test_evaluation_bundle_v2_list_and_active(client):
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

    # bootstrap scope first
    res_boot = client.post(
        "/api/mgmt/evaluation-bundles/bootstrap",
        json={"document_type": "project-review", "level": "medium", "name": "bundle-v2-bootstrap"},
    )
    assert res_boot.status_code == 200

    res_list = client.get("/api/mgmt/evaluation-bundles?document_type=project-review&level=medium")
    assert res_list.status_code == 200
    rows = res_list.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    assert "id" in rows[0]
    assert "document_type" in rows[0]
    assert "level" in rows[0]

    res_active = client.get("/api/mgmt/evaluation-bundles/active?document_type=project-review&level=medium")
    assert res_active.status_code == 200
    active = res_active.json()
    assert active["status"] == "active"
    assert active["document_type"] == "project-review"


def test_evaluation_bundle_bootstrap_auto_seeds_rubric_if_missing(client):
    # no rubric/prompt/policy pre-created for project-review scope
    res_boot = client.post(
        "/api/mgmt/evaluation-bundles/bootstrap",
        json={"document_type": "project-review", "level": "medium", "name": "auto-seed-check"},
    )
    assert res_boot.status_code == 200, res_boot.text
    payload = res_boot.json()
    assert payload["document_type"] == "project-review"
    assert payload["level"] == "medium"
    assert payload["status"] == "active"


def test_evaluation_bundle_bootstrap_full_scope_matrix(client):
    document_types = ["project-review", "bug-analysis", "qa-review", "explanation-review"]
    levels = ["low", "medium", "high"]

    for document_type in document_types:
        for level in levels:
            res_boot = client.post(
                "/api/mgmt/evaluation-bundles/bootstrap",
                json={"document_type": document_type, "level": level, "name": f"{document_type}-{level}-auto"},
            )
            assert res_boot.status_code == 200, f"{document_type}/{level}: {res_boot.text}"
            payload = res_boot.json()
            assert payload["document_type"] == document_type
            assert payload["level"] == level
            assert payload["status"] == "active"
