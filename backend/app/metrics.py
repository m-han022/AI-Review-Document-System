from __future__ import annotations

from collections import Counter as InMemoryCounter, defaultdict, deque
from threading import Lock
from typing import Final

from app.observability import log_event

LABEL_KEYS: Final[tuple[str, str, str]] = ("document_type", "prompt_level", "status")
API_LABEL_KEYS: Final[tuple[str, str, str]] = ("method", "route", "status_code")
EVALSET_LABEL_KEYS: Final[tuple[str, str, str, str]] = ("document_type", "prompt_level", "status", "evaluation_set_id")
COUNTER_NAMES: Final[tuple[str, ...]] = (
    "grading_run_created_total",
    "grading_run_reused_total",
    "grading_run_failed_total",
    "grading_retry_total",
)
DURATION_METRIC_NAME: Final[str] = "grading_duration_seconds"

_lock = Lock()
_mem_counters: dict[str, InMemoryCounter[tuple[str, str, str]]] = {}
_mem_duration_sum: dict[str, InMemoryCounter[tuple[str, str, str]]] = {}
_mem_duration_count: dict[str, InMemoryCounter[tuple[str, str, str]]] = {}
_mem_api_duration_sum: InMemoryCounter[tuple[str, str, str]] = InMemoryCounter()
_mem_api_duration_count: InMemoryCounter[tuple[str, str, str]] = InMemoryCounter()
_mem_export_rows: InMemoryCounter[tuple[str]] = InMemoryCounter()
_mem_export_duration_sum: InMemoryCounter[tuple[str, str]] = InMemoryCounter()
_mem_export_duration_count: InMemoryCounter[tuple[str, str]] = InMemoryCounter()
_mem_audit_query_duration_sum: InMemoryCounter[tuple[str]] = InMemoryCounter()
_mem_audit_query_duration_count: InMemoryCounter[tuple[str]] = InMemoryCounter()
_mem_evalset_duration_sum: InMemoryCounter[tuple[str, str, str, str]] = InMemoryCounter()
_mem_evalset_duration_count: InMemoryCounter[tuple[str, str, str, str]] = InMemoryCounter()
_mem_evalset_latency_samples: dict[tuple[str, str, str, str], deque[float]] = defaultdict(lambda: deque(maxlen=200))
_mem_resolution_reason_count: InMemoryCounter[tuple[str]] = InMemoryCounter()

try:
    from prometheus_client import Counter as PromCounter  # type: ignore
    from prometheus_client import Histogram as PromHistogram  # type: ignore
    from prometheus_client import generate_latest as prom_generate_latest  # type: ignore
except Exception:
    PromCounter = None
    PromHistogram = None
    prom_generate_latest = None

_prom_counters: dict[str, object] = {}
_prom_histograms: dict[str, object] = {}


def _normalize_labels(document_type: str, prompt_level: str, status: str) -> tuple[str, str, str]:
    return (
        (document_type or "unknown").strip().lower(),
        (prompt_level or "unknown").strip().lower(),
        (status or "unknown").strip().upper(),
    )


def _normalize_api_labels(method: str, route: str, status_code: int | str) -> tuple[str, str, str]:
    return (
        (method or "UNKNOWN").strip().upper(),
        (route or "unknown").strip(),
        str(status_code),
    )


def _normalize_evalset_labels(
    document_type: str,
    prompt_level: str,
    status: str,
    evaluation_set_id: int | None,
) -> tuple[str, str, str, str]:
    return (
        (document_type or "unknown").strip().lower(),
        (prompt_level or "unknown").strip().lower(),
        (status or "unknown").strip().upper(),
        str(evaluation_set_id) if evaluation_set_id is not None else "none",
    )


def _get_prom_counter(name: str):
    if PromCounter is None:
        return None
    counter = _prom_counters.get(name)
    if counter is not None:
        return counter
    counter = PromCounter(
        name,
        f"{name} counter",
        list(LABEL_KEYS),
    )
    _prom_counters[name] = counter
    return counter


def inc_counter(
    name: str,
    *,
    document_type: str,
    prompt_level: str,
    status: str,
    amount: int = 1,
) -> None:
    labels = _normalize_labels(document_type, prompt_level, status)
    with _lock:
        if name not in _mem_counters:
            _mem_counters[name] = InMemoryCounter()
        _mem_counters[name][labels] += amount

    prom_counter = _get_prom_counter(name)
    if prom_counter is not None:
        prom_counter.labels(
            document_type=labels[0],
            prompt_level=labels[1],
            status=labels[2],
        ).inc(amount)

    log_event(
        "metric_counter_incremented",
        metric_name=name,
        metric_value=amount,
        document_type=labels[0],
        prompt_level=labels[1],
        status=labels[2],
    )


def observe_duration_seconds(
    name: str,
    duration_seconds: float,
    *,
    document_type: str,
    prompt_level: str,
    status: str,
) -> None:
    labels = _normalize_labels(document_type, prompt_level, status)
    with _lock:
        if name not in _mem_duration_sum:
            _mem_duration_sum[name] = InMemoryCounter()
            _mem_duration_count[name] = InMemoryCounter()
        _mem_duration_sum[name][labels] += float(duration_seconds)
        _mem_duration_count[name][labels] += 1

    if PromHistogram is not None:
        histogram = _prom_histograms.get(name)
        if histogram is None:
            histogram = PromHistogram(
                name,
                f"{name} histogram",
                list(LABEL_KEYS),
            )
            _prom_histograms[name] = histogram
        histogram.labels(
            document_type=labels[0],
            prompt_level=labels[1],
            status=labels[2],
        ).observe(float(duration_seconds))

    log_event(
        "metric_duration_observed",
        metric_name=name,
        metric_value_seconds=float(duration_seconds),
        document_type=labels[0],
        prompt_level=labels[1],
        status=labels[2],
    )


def observe_api_request_seconds(
    duration_seconds: float,
    *,
    method: str,
    route: str,
    status_code: int,
) -> None:
    labels = _normalize_api_labels(method, route, status_code)
    with _lock:
        _mem_api_duration_sum[labels] += float(duration_seconds)
        _mem_api_duration_count[labels] += 1

    if PromHistogram is not None:
        histogram = _prom_histograms.get("api_request_duration_seconds")
        if histogram is None:
            histogram = PromHistogram(
                "api_request_duration_seconds",
                "api_request_duration_seconds histogram",
                list(API_LABEL_KEYS),
            )
            _prom_histograms["api_request_duration_seconds"] = histogram
        histogram.labels(
            method=labels[0],
            route=labels[1],
            status_code=labels[2],
        ).observe(float(duration_seconds))


def observe_queue_delay_seconds(
    delay_seconds: float,
    *,
    document_type: str,
    prompt_level: str,
) -> None:
    observe_duration_seconds(
        "grading_queue_delay_seconds",
        delay_seconds,
        document_type=document_type,
        prompt_level=prompt_level,
        status="QUEUED",
    )


def inc_export_rows_total(endpoint: str, rows: int = 1) -> None:
    normalized_endpoint = (endpoint or "unknown").strip()
    with _lock:
        _mem_export_rows[(normalized_endpoint,)] += int(rows)

    prom_counter = _prom_counters.get("export_rows_total")
    if prom_counter is None and PromCounter is not None:
        prom_counter = PromCounter("export_rows_total", "export_rows_total counter", ["endpoint"])
        _prom_counters["export_rows_total"] = prom_counter
    if prom_counter is not None:
        prom_counter.labels(endpoint=normalized_endpoint).inc(int(rows))


def observe_export_duration_seconds(endpoint: str, duration_seconds: float, *, status: str = "OK") -> None:
    normalized_endpoint = (endpoint or "unknown").strip()
    normalized_status = (status or "UNKNOWN").strip().upper()
    with _lock:
        _mem_export_duration_sum[(normalized_endpoint, normalized_status)] += float(duration_seconds)
        _mem_export_duration_count[(normalized_endpoint, normalized_status)] += 1

    if PromHistogram is not None:
        histogram = _prom_histograms.get("export_duration_seconds")
        if histogram is None:
            histogram = PromHistogram(
                "export_duration_seconds",
                "export_duration_seconds histogram",
                ["endpoint", "status"],
            )
            _prom_histograms["export_duration_seconds"] = histogram
        histogram.labels(endpoint=normalized_endpoint, status=normalized_status).observe(float(duration_seconds))


def observe_audit_query_duration_seconds(duration_seconds: float, *, status: str = "OK") -> None:
    normalized_status = (status or "UNKNOWN").strip().upper()
    with _lock:
        _mem_audit_query_duration_sum[(normalized_status,)] += float(duration_seconds)
        _mem_audit_query_duration_count[(normalized_status,)] += 1

    if PromHistogram is not None:
        histogram = _prom_histograms.get("audit_query_duration_seconds")
        if histogram is None:
            histogram = PromHistogram(
                "audit_query_duration_seconds",
                "audit_query_duration_seconds histogram",
                ["status"],
            )
            _prom_histograms["audit_query_duration_seconds"] = histogram
        histogram.labels(status=normalized_status).observe(float(duration_seconds))


def observe_evalset_duration_seconds(
    duration_seconds: float,
    *,
    document_type: str,
    prompt_level: str,
    status: str,
    evaluation_set_id: int | None,
) -> None:
    labels = _normalize_evalset_labels(document_type, prompt_level, status, evaluation_set_id)
    with _lock:
        _mem_evalset_duration_sum[labels] += float(duration_seconds)
        _mem_evalset_duration_count[labels] += 1
        _mem_evalset_latency_samples[labels].append(float(duration_seconds))

    if PromHistogram is not None:
        histogram = _prom_histograms.get("grading_evalset_duration_seconds")
        if histogram is None:
            histogram = PromHistogram(
                "grading_evalset_duration_seconds",
                "grading_evalset_duration_seconds histogram",
                list(EVALSET_LABEL_KEYS),
            )
            _prom_histograms["grading_evalset_duration_seconds"] = histogram
        histogram.labels(
            document_type=labels[0],
            prompt_level=labels[1],
            status=labels[2],
            evaluation_set_id=labels[3],
        ).observe(float(duration_seconds))


def get_evalset_latency_samples() -> dict[tuple[str, str, str, str], list[float]]:
    with _lock:
        return {k: list(v) for k, v in _mem_evalset_latency_samples.items()}


def inc_resolution_reason_total(reason: str, amount: int = 1) -> None:
    normalized = (reason or "unknown").strip()
    with _lock:
        _mem_resolution_reason_count[(normalized,)] += int(amount)


def get_resolution_reason_totals() -> dict[str, int]:
    with _lock:
        return {k[0]: int(v) for k, v in _mem_resolution_reason_count.items()}


def render_prometheus_metrics() -> str:
    if prom_generate_latest is not None:
        return prom_generate_latest().decode("utf-8")

    # Fallback exporter when prometheus_client is unavailable.
    lines: list[str] = []
    with _lock:
        for metric_name in COUNTER_NAMES:
            lines.append(f"# TYPE {metric_name} counter")
            metric_counter = _mem_counters.get(metric_name, InMemoryCounter())
            for labels, value in metric_counter.items():
                lines.append(
                    f'{metric_name}{{document_type="{labels[0]}",prompt_level="{labels[1]}",status="{labels[2]}"}} {float(value)}'
                )

        duration_metric_names = sorted(set(_mem_duration_sum.keys()) | set(_mem_duration_count.keys()) | {DURATION_METRIC_NAME})
        for metric_name in duration_metric_names:
            lines.append(f"# TYPE {metric_name}_sum counter")
            for labels, value in _mem_duration_sum.get(metric_name, InMemoryCounter()).items():
                lines.append(
                    f'{metric_name}_sum{{document_type="{labels[0]}",prompt_level="{labels[1]}",status="{labels[2]}"}} {float(value)}'
                )

            lines.append(f"# TYPE {metric_name}_count counter")
            for labels, value in _mem_duration_count.get(metric_name, InMemoryCounter()).items():
                lines.append(
                    f'{metric_name}_count{{document_type="{labels[0]}",prompt_level="{labels[1]}",status="{labels[2]}"}} {float(value)}'
                )

        lines.append("# TYPE api_request_duration_seconds_sum counter")
        for labels, value in _mem_api_duration_sum.items():
            lines.append(
                f'api_request_duration_seconds_sum{{method="{labels[0]}",route="{labels[1]}",status_code="{labels[2]}"}} {float(value)}'
            )

        lines.append("# TYPE api_request_duration_seconds_count counter")
        for labels, value in _mem_api_duration_count.items():
            lines.append(
                f'api_request_duration_seconds_count{{method="{labels[0]}",route="{labels[1]}",status_code="{labels[2]}"}} {float(value)}'
            )

        lines.append("# TYPE export_rows_total counter")
        for labels, value in _mem_export_rows.items():
            lines.append(
                f'export_rows_total{{endpoint="{labels[0]}"}} {float(value)}'
            )

        lines.append("# TYPE export_duration_seconds_sum counter")
        for labels, value in _mem_export_duration_sum.items():
            lines.append(
                f'export_duration_seconds_sum{{endpoint="{labels[0]}",status="{labels[1]}"}} {float(value)}'
            )
        lines.append("# TYPE export_duration_seconds_count counter")
        for labels, value in _mem_export_duration_count.items():
            lines.append(
                f'export_duration_seconds_count{{endpoint="{labels[0]}",status="{labels[1]}"}} {float(value)}'
            )

        lines.append("# TYPE audit_query_duration_seconds_sum counter")
        for labels, value in _mem_audit_query_duration_sum.items():
            lines.append(
                f'audit_query_duration_seconds_sum{{status="{labels[0]}"}} {float(value)}'
            )
        lines.append("# TYPE audit_query_duration_seconds_count counter")
        for labels, value in _mem_audit_query_duration_count.items():
            lines.append(
                f'audit_query_duration_seconds_count{{status="{labels[0]}"}} {float(value)}'
            )

        lines.append("# TYPE grading_evalset_duration_seconds_sum counter")
        for labels, value in _mem_evalset_duration_sum.items():
            lines.append(
                f'grading_evalset_duration_seconds_sum{{document_type="{labels[0]}",prompt_level="{labels[1]}",status="{labels[2]}",evaluation_set_id="{labels[3]}"}} {float(value)}'
            )
        lines.append("# TYPE grading_evalset_duration_seconds_count counter")
        for labels, value in _mem_evalset_duration_count.items():
            lines.append(
                f'grading_evalset_duration_seconds_count{{document_type="{labels[0]}",prompt_level="{labels[1]}",status="{labels[2]}",evaluation_set_id="{labels[3]}"}} {float(value)}'
            )

    return "\n".join(lines) + "\n"
