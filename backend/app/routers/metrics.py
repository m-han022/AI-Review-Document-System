import re
from collections import defaultdict, deque

from fastapi import APIRouter, Response

from app.metrics import get_evalset_latency_samples, get_resolution_reason_totals, render_prometheus_metrics
from app.config import settings

router = APIRouter()


@router.get("/metrics")
async def get_metrics() -> Response:
    payload = render_prometheus_metrics()
    latency_samples = get_evalset_latency_samples()
    return Response(content=payload, media_type="text/plain; version=0.0.4; charset=utf-8")


@router.get("/api/metrics/evaluation-sets/health")
async def get_evaluation_set_runtime_health() -> dict:
    payload = render_prometheus_metrics()
    latency_samples = get_evalset_latency_samples()
    sum_re = re.compile(
        r'^grading_evalset_duration_seconds_sum\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)",evaluation_set_id="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    count_re = re.compile(
        r'^grading_evalset_duration_seconds_count\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)",evaluation_set_id="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    failed_re = re.compile(
        r'^grading_run_failed_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    parse_fail_re = re.compile(
        r'^grading_ai_parse_failed_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    fallback_re = re.compile(
        r'^grading_ai_fallback_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    normalize_fallback_re = re.compile(
        r'^grading_ai_normalize_fallback_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    persist_fail_re = re.compile(
        r'^grading_persist_criteria_failed_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    ingest_ocr_unavailable_re = re.compile(
        r'^ingest_ocr_unavailable_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    ingest_ocr_failed_re = re.compile(
        r'^ingest_ocr_failed_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    ingest_ocr_success_re = re.compile(
        r'^ingest_ocr_success_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )
    ingest_timeout_re = re.compile(
        r'^ingest_extract_timeout_total\{document_type="([^"]+)",prompt_level="([^"]+)",status="([^"]+)"\}\s+([0-9.eE+-]+)$'
    )

    by_set: dict[tuple[str, str, str, str], dict[str, float]] = defaultdict(lambda: {"sum": 0.0, "count": 0.0})
    failed_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    parse_fail_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    fallback_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    normalize_fallback_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    persist_fail_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    total_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    trend_buffer: dict[tuple[str, str], deque[float]] = defaultdict(lambda: deque(maxlen=20))
    ingest_ocr_unavailable_total = 0.0
    ingest_ocr_failed_total = 0.0
    ingest_ocr_success_total = 0.0
    ingest_timeout_total = 0.0

    for line in payload.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m_sum = sum_re.match(line)
        if m_sum:
            doc_type, level, status, set_id, value = m_sum.groups()
            by_set[(set_id, doc_type, level, status)]["sum"] += float(value)
            continue
        m_count = count_re.match(line)
        if m_count:
            doc_type, level, status, set_id, value = m_count.groups()
            count = float(value)
            by_set[(set_id, doc_type, level, status)]["count"] += count
            total_by_scope[(doc_type, level)] += count
            if count > 0:
                trend_buffer[(set_id, status.upper())].append(count)
            continue
        m_failed = failed_re.match(line)
        if m_failed:
            doc_type, level, status, value = m_failed.groups()
            if status.upper() == "FAILED":
                failed_by_scope[(doc_type, level)] += float(value)
            continue
        m_parse = parse_fail_re.match(line)
        if m_parse:
            doc_type, level, _status, value = m_parse.groups()
            parse_fail_by_scope[(doc_type, level)] += float(value)
            continue
        m_fallback = fallback_re.match(line)
        if m_fallback:
            doc_type, level, _status, value = m_fallback.groups()
            fallback_by_scope[(doc_type, level)] += float(value)
            continue
        m_norm = normalize_fallback_re.match(line)
        if m_norm:
            doc_type, level, _status, value = m_norm.groups()
            normalize_fallback_by_scope[(doc_type, level)] += float(value)
            continue
        m_persist = persist_fail_re.match(line)
        if m_persist:
            doc_type, level, _status, value = m_persist.groups()
            persist_fail_by_scope[(doc_type, level)] += float(value)
            continue
        m_ocr_un = ingest_ocr_unavailable_re.match(line)
        if m_ocr_un:
            _doc, _level, _status, value = m_ocr_un.groups()
            ingest_ocr_unavailable_total += float(value)
            continue
        m_ocr_fail = ingest_ocr_failed_re.match(line)
        if m_ocr_fail:
            _doc, _level, _status, value = m_ocr_fail.groups()
            ingest_ocr_failed_total += float(value)
            continue
        m_ocr_ok = ingest_ocr_success_re.match(line)
        if m_ocr_ok:
            _doc, _level, _status, value = m_ocr_ok.groups()
            ingest_ocr_success_total += float(value)
            continue
        m_timeout = ingest_timeout_re.match(line)
        if m_timeout:
            _doc, _level, _status, value = m_timeout.groups()
            ingest_timeout_total += float(value)

    items = []
    for (set_id, doc_type, level, status), agg in sorted(by_set.items()):
        count = agg["count"]
        avg_latency = (agg["sum"] / count) if count > 0 else 0.0
        scope_total = total_by_scope.get((doc_type, level), 0.0)
        scope_failed = failed_by_scope.get((doc_type, level), 0.0)
        scope_parse_fail = parse_fail_by_scope.get((doc_type, level), 0.0)
        scope_fallback = fallback_by_scope.get((doc_type, level), 0.0)
        scope_normalize_fallback = normalize_fallback_by_scope.get((doc_type, level), 0.0)
        scope_persist_fail = persist_fail_by_scope.get((doc_type, level), 0.0)
        failed_rate = (scope_failed / scope_total) if scope_total > 0 else 0.0
        parse_fail_rate = (scope_parse_fail / scope_total) if scope_total > 0 else 0.0
        fallback_rate = (scope_fallback / scope_total) if scope_total > 0 else 0.0
        normalize_fallback_rate = (scope_normalize_fallback / scope_total) if scope_total > 0 else 0.0
        persist_fail_rate = (scope_persist_fail / scope_total) if scope_total > 0 else 0.0
        latencies = sorted(latency_samples.get((doc_type, level, status.upper(), set_id), []))
        p95_latency = 0.0
        if latencies:
            idx = int(0.95 * (len(latencies) - 1))
            p95_latency = latencies[idx]
        items.append(
            {
                "evaluation_set_id": None if set_id == "none" else int(set_id),
                "document_type": doc_type,
                "prompt_level": level,
                "status": status.upper(),
                "run_count": int(count),
                "avg_latency_seconds": round(avg_latency, 3),
                "p95_latency_seconds": round(p95_latency, 3),
                "failed_rate_scope": round(failed_rate, 4),
                "ai_parse_fail_rate_scope": round(parse_fail_rate, 4),
                "ai_fallback_rate_scope": round(fallback_rate, 4),
                "ai_normalize_fallback_rate_scope": round(normalize_fallback_rate, 4),
                "persist_criteria_fail_rate_scope": round(persist_fail_rate, 4),
                "recent_counts": list(trend_buffer.get((set_id, status.upper()), [])),
            }
        )

    alerts: list[dict] = []
    for item in items:
        if item["status"] != "COMPLETED":
            continue
        if item["failed_rate_scope"] > settings.runtime_health_fail_rate_threshold:
            alerts.append({"severity": "high", "code": "ALERT_FAIL_RATE_HIGH", "scope": item})
        if item["ai_parse_fail_rate_scope"] > settings.runtime_health_ai_parse_fail_rate_threshold:
            alerts.append({"severity": "medium", "code": "ALERT_AI_PARSE_FAIL_RATE_HIGH", "scope": item})
        if item["persist_criteria_fail_rate_scope"] > 0:
            alerts.append({"severity": "high", "code": "ALERT_PERSIST_CRITERIA_FAIL", "scope": item})

    ingest_ocr_total = ingest_ocr_unavailable_total + ingest_ocr_failed_total + ingest_ocr_success_total
    ingest_ocr_unavailable_rate = (ingest_ocr_unavailable_total / ingest_ocr_total) if ingest_ocr_total > 0 else 0.0
    ingest_ocr_failed_rate = (ingest_ocr_failed_total / ingest_ocr_total) if ingest_ocr_total > 0 else 0.0
    ingest_timeout_rate = (ingest_timeout_total / ingest_ocr_total) if ingest_ocr_total > 0 else 0.0
    if ingest_ocr_unavailable_rate > settings.runtime_health_ingest_ocr_unavailable_rate_threshold:
        alerts.append(
            {"severity": "medium", "code": "ALERT_OCR_UNAVAILABLE_RATE_HIGH", "scope": {"rate": round(ingest_ocr_unavailable_rate, 4)}}
        )
    if ingest_ocr_failed_rate > settings.runtime_health_ingest_ocr_failed_rate_threshold:
        alerts.append(
            {"severity": "high", "code": "ALERT_OCR_FAILED_RATE_HIGH", "scope": {"rate": round(ingest_ocr_failed_rate, 4)}}
        )
    if ingest_timeout_rate > settings.runtime_health_ingest_timeout_rate_threshold:
        alerts.append(
            {"severity": "high", "code": "ALERT_INGEST_TIMEOUT_RATE_HIGH", "scope": {"rate": round(ingest_timeout_rate, 4)}}
        )

    return {
        "items": items,
        "alerts": alerts,
        "thresholds": {
            "fail_rate": settings.runtime_health_fail_rate_threshold,
            "p95_latency_seconds": settings.runtime_health_p95_latency_threshold_seconds,
            "ai_parse_fail_rate": settings.runtime_health_ai_parse_fail_rate_threshold,
            "ai_fallback_rate": settings.runtime_health_ai_fallback_rate_threshold,
            "ingest_ocr_unavailable_rate": settings.runtime_health_ingest_ocr_unavailable_rate_threshold,
            "ingest_ocr_failed_rate": settings.runtime_health_ingest_ocr_failed_rate_threshold,
            "ingest_timeout_rate": settings.runtime_health_ingest_timeout_rate_threshold,
        },
        "ingest_health": {
            "ocr_total": int(ingest_ocr_total),
            "ocr_unavailable_total": int(ingest_ocr_unavailable_total),
            "ocr_failed_total": int(ingest_ocr_failed_total),
            "ocr_success_total": int(ingest_ocr_success_total),
            "extract_timeout_total": int(ingest_timeout_total),
            "ocr_unavailable_rate": round(ingest_ocr_unavailable_rate, 4),
            "ocr_failed_rate": round(ingest_ocr_failed_rate, 4),
            "timeout_rate": round(ingest_timeout_rate, 4),
        },
        "resolution_reason_totals": get_resolution_reason_totals(),
    }
