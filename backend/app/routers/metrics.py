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

    by_set: dict[tuple[str, str, str, str], dict[str, float]] = defaultdict(lambda: {"sum": 0.0, "count": 0.0})
    failed_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    parse_fail_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    fallback_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    total_by_scope: dict[tuple[str, str], float] = defaultdict(float)
    trend_buffer: dict[tuple[str, str], deque[float]] = defaultdict(lambda: deque(maxlen=20))

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

    items = []
    for (set_id, doc_type, level, status), agg in sorted(by_set.items()):
        count = agg["count"]
        avg_latency = (agg["sum"] / count) if count > 0 else 0.0
        scope_total = total_by_scope.get((doc_type, level), 0.0)
        scope_failed = failed_by_scope.get((doc_type, level), 0.0)
        scope_parse_fail = parse_fail_by_scope.get((doc_type, level), 0.0)
        scope_fallback = fallback_by_scope.get((doc_type, level), 0.0)
        failed_rate = (scope_failed / scope_total) if scope_total > 0 else 0.0
        parse_fail_rate = (scope_parse_fail / scope_total) if scope_total > 0 else 0.0
        fallback_rate = (scope_fallback / scope_total) if scope_total > 0 else 0.0
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
                "recent_counts": list(trend_buffer.get((set_id, status.upper()), [])),
            }
        )

    return {
        "items": items,
        "thresholds": {
            "fail_rate": settings.runtime_health_fail_rate_threshold,
            "p95_latency_seconds": settings.runtime_health_p95_latency_threshold_seconds,
            "ai_parse_fail_rate": settings.runtime_health_ai_parse_fail_rate_threshold,
            "ai_fallback_rate": settings.runtime_health_ai_fallback_rate_threshold,
        },
        "resolution_reason_totals": get_resolution_reason_totals(),
    }
