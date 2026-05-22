from app.services.prompt_composer import REQUIRED_RULES, stable_hash
from app.services.grading_engine import build_grading_signature
from app.models import RequiredRuleSet
import json
from sqlmodel import select


def test_create_rubric_active_archives_old_active(client):
    doc_type = "mgmt-rubric-test"
    seed_v1 = {
        "document_type": doc_type,
        "version": "v1",
        "prompt": {"vi": "rubric v1"},
        "criteria": [{"key": "review_tong_the", "max_score": 100, "labels": {"vi": "A", "ja": "A"}}],
        "activate": True,
    }
    seed_v2 = {
        "document_type": doc_type,
        "version": "v2",
        "prompt": {"vi": "rubric v2"},
        "criteria": [{"key": "review_tong_the", "max_score": 100, "labels": {"vi": "B", "ja": "B"}}],
        "activate": True,
    }
    assert client.post("/api/mgmt/rubrics", json=seed_v1).status_code == 200
    assert client.post("/api/mgmt/rubrics", json=seed_v2).status_code == 200

    rubrics = client.get("/api/mgmt/rubrics", params={"document_type": doc_type}).json()
    active = [item for item in rubrics if item["status"] == "active"]
    assert len(active) == 1
    assert active[0]["version"] == "v2"


def test_create_prompt_active_archives_old_active(client):
    p1 = {
        "document_type": "project-review",
        "level": "medium",
        "version": "v1",
        "content": "prompt v1",
        "activate": True,
    }
    p2 = {
        "document_type": "project-review",
        "level": "medium",
        "version": "v2",
        "content": "prompt v2",
        "activate": True,
    }
    assert client.post("/api/mgmt/prompts", json=p1).status_code == 200
    assert client.post("/api/mgmt/prompts", json=p2).status_code == 200

    prompts = client.get("/api/mgmt/prompts", params={"document_type": "project-review", "level": "medium"}).json()
    active = [item for item in prompts if item["status"] == "active"]
    assert len(active) == 1
    assert active[0]["version"] == "v2"


def test_create_policy_active_archives_old_active(client):
    p1 = {"level": "medium", "version": "v1", "content": "policy v1", "activate": True}
    p2 = {"level": "medium", "version": "v2", "content": "policy v2", "activate": True}
    assert client.post("/api/mgmt/policies", json=p1).status_code == 200
    assert client.post("/api/mgmt/policies", json=p2).status_code == 200

    policies = client.get("/api/mgmt/policies", params={"level": "medium"}).json()
    active = [item for item in policies if item["status"] == "active"]
    assert len(active) == 1
    assert active[0]["version"] == "v2"


def test_final_prompt_preview_compose_order(client):
    rubric_res = client.post(
        "/api/mgmt/rubrics",
        json={
            "document_type": "bug-analysis",
            "version": "v1",
            "prompt": {"vi": "RUBRIC_TEXT"},
            "criteria": [{"key": "c1", "max_score": 100, "labels": {"vi": "c1", "ja": "c1"}}],
            "activate": True,
        },
    )
    client.post(
        "/api/mgmt/prompts",
        json={
            "document_type": "bug-analysis",
            "level": "medium",
            "version": "v1",
            "content": "PROMPT_TEXT",
            "activate": True,
        },
    )
    client.post(
        "/api/mgmt/policies",
        json={"level": "medium", "version": "v1", "content": "POLICY_TEXT", "activate": True},
    )

    res = client.get("/api/mgmt/final-prompt/preview", params={"document_type": "bug-analysis", "level": "medium"})
    assert res.status_code == 200
    body = res.json()
    preview = body["full_prompt_preview"]
    assert "Required Rules" in preview or "IMPORTANT RULES" in preview
    if rubric_res.status_code == 200:
        assert "RUBRIC" in preview


def test_required_rules_hash_stable(client):
    res = client.get("/api/mgmt/required-rules")
    assert res.status_code == 200
    body = res.json()
    assert body["hash"] == stable_hash(REQUIRED_RULES)
    assert body["required_rule_set_id"] is not None


def test_required_rules_versions_endpoint(client):
    res = client.get("/api/mgmt/required-rules/versions")
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) >= 1
    assert rows[0]["hash"] == stable_hash(REQUIRED_RULES)


def test_grading_signature_uses_required_rules_content_from_db(client, session):
    custom_rules = [
        "IMPORTANT RULES:",
        "1. CUSTOM RULE FROM DB",
        "2. JSON ONLY",
    ]
    active = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.status == "active")).first()
    if active is None:
        active = RequiredRuleSet(
            version="system-rules-v1",
            hash=stable_hash(custom_rules),
            content=json.dumps(custom_rules, ensure_ascii=False),
            status="active",
            created_at="2026-01-01T00:00:00Z",
        )
        session.add(active)
    else:
        active.content = json.dumps(custom_rules, ensure_ascii=False)
        active.hash = stable_hash(custom_rules)
    session.commit()

    _seed_eval_scope(client, "eval-doc-rules")
    sig = build_grading_signature("abc", "ja", "eval-doc-rules", prompt_level="medium")
    assert "CUSTOM RULE FROM DB" in sig["final_system_instruction"]
    assert sig["required_rule_hash"] == stable_hash(custom_rules)


def test_create_evaluation_set_prompt_only_change(client):
    r = client.post("/api/mgmt/rubrics", json={
        "document_type": "eval-doc",
        "version": "v1",
        "prompt": {"vi": "rubric_v1"},
        "criteria": [{"key": "c1", "max_score": 100, "labels": {"vi": "c1", "ja": "c1"}}],
        "activate": True,
    }).json()
    p = client.post("/api/mgmt/prompts", json={
        "document_type": "eval-doc", "level": "medium", "version": "v1", "content": "prompt_v1", "activate": True
    }).json()
    pol = client.post("/api/mgmt/policies", json={
        "level": "medium", "version": "v1", "content": "policy_v1", "activate": True
    }).json()
    boot = client.post("/api/mgmt/evaluation-bundles/bootstrap", json={"document_type": "eval-doc", "level": "medium"})
    assert boot.status_code == 200
    base_id = boot.json()["id"]
    res = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": base_id,
        "name": "eval-doc medium set v2",
        "changes": {"prompt_content": "prompt_v2"},
        "activate": True,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["prompt_version_id"] != p["id"]
    assert body["rubric_version_id"] == r["id"]
    assert body["policy_version_id"] == pol["id"]
    assert body["required_rule_set_id"] is not None
    assert str(body["version_label"]).endswith("v1")
    prompts = client.get("/api/mgmt/prompts", params={"document_type": "eval-doc", "level": "medium"}).json()
    newest = max(prompts, key=lambda item: item["id"])
    assert newest["version"] == "v2"


def _seed_eval_scope(client, doc_type="eval-doc2", level="medium"):
    r = client.post("/api/mgmt/rubrics", json={
        "document_type": doc_type,
        "version": "v1",
        "prompt": {"vi": "rubric_v1"},
        "criteria": [{"key": "c1", "max_score": 100, "labels": {"vi": "c1", "ja": "c1"}}],
        "activate": True,
    }).json()
    p = client.post("/api/mgmt/prompts", json={
        "document_type": doc_type, "level": level, "version": "v1", "content": "prompt_v1", "activate": True
    }).json()
    pol = client.post("/api/mgmt/policies", json={
        "level": level, "version": "v1", "content": "policy_v1", "activate": True
    }).json()
    boot = client.post("/api/mgmt/evaluation-bundles/bootstrap", json={"document_type": doc_type, "level": level})
    assert boot.status_code == 200
    return r, p, pol, boot.json()


def test_create_evaluation_set_rubric_change_only(client):
    r, p, pol, base = _seed_eval_scope(client, "eval-doc3")
    res = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": base["id"],
        "name": "rubric-only",
        "changes": {"rubric_content": "rubric_v2"},
        "activate": True,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["rubric_version_id"] != r["id"]
    assert body["prompt_version_id"] == p["id"]
    assert body["policy_version_id"] == pol["id"]
    rubrics = client.get("/api/mgmt/rubrics", params={"document_type": "eval-doc3"}).json()
    newest = max(rubrics, key=lambda item: item["id"])
    assert newest["version"] == "v2"


def test_create_evaluation_set_policy_change_only(client):
    r, p, pol, base = _seed_eval_scope(client, "eval-doc4")
    res = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": base["id"],
        "name": "policy-only",
        "changes": {"policy_content": "policy_v2"},
        "activate": True,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["policy_version_id"] != pol["id"]
    assert body["rubric_version_id"] == r["id"]
    assert body["prompt_version_id"] == p["id"]
    policies = client.get("/api/mgmt/policies", params={"level": "medium"}).json()
    newest = max(policies, key=lambda item: item["id"])
    assert newest["version"] == "v2"


def test_create_evaluation_set_required_rules_change_only(client):
    r, p, pol, base = _seed_eval_scope(client, "eval-doc-rules-change")
    res = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": base["id"],
        "name": "rules-change-only",
        "changes": {"required_rules_content": "IMPORTANT RULES:\n1. CUSTOM NEW RULE\n2. JSON ONLY"},
        "activate": True,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["rubric_version_id"] == r["id"]
    assert body["prompt_version_id"] == p["id"]
    assert body["policy_version_id"] == pol["id"]
    assert body["required_rule_set_id"] != base["required_rule_set_id"]


def test_create_evaluation_set_multiple_change(client):
    r, p, pol, base = _seed_eval_scope(client, "eval-doc5")
    res = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": base["id"],
        "name": "multi-change",
        "changes": {"prompt_content": "prompt_v2", "rubric_content": "rubric_v2"},
        "activate": True,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["prompt_version_id"] != p["id"]
    assert body["rubric_version_id"] != r["id"]
    assert body["policy_version_id"] == pol["id"]


def test_create_evaluation_set_no_change_reuses_versions(client):
    r, p, pol, base = _seed_eval_scope(client, "eval-doc6")
    res = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": base["id"],
        "name": "clone-no-change",
        "changes": {"prompt_content": "prompt_v1", "rubric_content": "rubric_v1", "policy_content": "policy_v1"},
        "activate": False,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["prompt_version_id"] == p["id"]
    assert body["rubric_version_id"] == r["id"]
    assert body["policy_version_id"] == pol["id"]
    prompts = client.get("/api/mgmt/prompts", params={"document_type": "eval-doc6", "level": "medium"}).json()
    rubrics = client.get("/api/mgmt/rubrics", params={"document_type": "eval-doc6"}).json()
    policies = client.get("/api/mgmt/policies", params={"level": "medium"}).json()
    assert len([item for item in prompts if item["document_type"] == "eval-doc6" and item["level"] == "medium"]) == 1
    assert len(rubrics) == 1
    assert len([item for item in policies if item["level"] == "medium"]) >= 1


def test_activate_set_archives_old_active(client):
    _, _, _, base = _seed_eval_scope(client, "eval-doc7")
    res = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": base["id"],
        "name": "new-active",
        "changes": {"prompt_content": "prompt_v2"},
        "activate": True,
    })
    assert res.status_code == 200
    new_set = res.json()
    listing = client.get("/api/mgmt/evaluation-bundles", params={"document_type": "eval-doc7", "level": "medium"}).json()
    old = next(item for item in listing if item["id"] == base["id"])
    assert old["status"] == "archived"
    assert next(item for item in listing if item["id"] == new_set["id"])["status"] == "active"


def test_cache_signature_behavior_prompt_change_and_no_change(client):
    _seed_eval_scope(client, "eval-doc8")
    sig1 = build_grading_signature("abc", "ja", "eval-doc8", prompt_level="medium")
    active = client.get("/api/mgmt/evaluation-bundles/active", params={"document_type": "eval-doc8", "level": "medium"}).json()
    no_change = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": active["id"],
        "name": "no-change",
        "changes": {"prompt_content": "prompt_v1"},
        "activate": True,
    })
    assert no_change.status_code == 200
    sig2 = build_grading_signature("abc", "ja", "eval-doc8", prompt_level="medium")
    assert sig1["prompt_hash"] == sig2["prompt_hash"]

    active2 = client.get("/api/mgmt/evaluation-bundles/active", params={"document_type": "eval-doc8", "level": "medium"}).json()
    changed = client.post("/api/mgmt/evaluation-bundles", json={
        "base_set_id": active2["id"],
        "name": "prompt-change",
        "changes": {"prompt_content": "prompt_v2"},
        "activate": True,
    })
    assert changed.status_code == 200
    sig3 = build_grading_signature("abc", "ja", "eval-doc8", prompt_level="medium")
    assert sig2["prompt_hash"] != sig3["prompt_hash"]


def test_bootstrap_evaluation_set_requires_active_components(client):
    res = client.post("/api/mgmt/evaluation-bundles/bootstrap", json={"document_type": "missing-doc", "level": "medium"})
    assert res.status_code == 400
    assert "No active rubric" in res.json()["detail"]


def test_bootstrap_evaluation_set_assigns_v1_version_label(client):
    _seed_eval_scope(client, "eval-doc9")
    listing = client.get("/api/mgmt/evaluation-bundles", params={"document_type": "eval-doc9", "level": "medium"}).json()
    assert len(listing) == 1
    assert str(listing[0]["version_label"]).endswith("v1")
