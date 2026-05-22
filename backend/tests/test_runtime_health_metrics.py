from app.metrics import observe_evalset_duration_seconds
from app.config import settings


def test_runtime_health_metrics_endpoint_contract(client):
    observe_evalset_duration_seconds(
        10.5,
        document_type="project-review",
        prompt_level="medium",
        status="COMPLETED",
        evaluation_set_id=101,
    )
    observe_evalset_duration_seconds(
        18.0,
        document_type="project-review",
        prompt_level="medium",
        status="COMPLETED",
        evaluation_set_id=101,
    )
    observe_evalset_duration_seconds(
        35.0,
        document_type="project-review",
        prompt_level="medium",
        status="FAILED",
        evaluation_set_id=101,
    )

    res = client.get("/api/metrics/evaluation-sets/health")
    assert res.status_code == 200
    payload = res.json()
    assert "items" in payload
    assert isinstance(payload["items"], list)
    assert payload["items"], "Expected at least one runtime health item"

    row = next((item for item in payload["items"] if item.get("evaluation_set_id") == 101), None)
    assert row is not None
    assert "avg_latency_seconds" in row
    assert "p95_latency_seconds" in row
    assert "failed_rate_scope" in row
    assert "recent_counts" in row


def test_runtime_health_metrics_exposes_configured_thresholds(client):
    res = client.get("/api/metrics/evaluation-sets/health")
    assert res.status_code == 200
    payload = res.json()
    assert "thresholds" in payload
    assert payload["thresholds"]["fail_rate"] == settings.runtime_health_fail_rate_threshold
    assert payload["thresholds"]["p95_latency_seconds"] == settings.runtime_health_p95_latency_threshold_seconds
