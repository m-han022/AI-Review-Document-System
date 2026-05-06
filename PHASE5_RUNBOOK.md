# Phase 5 Runbook (Operational Readiness)

Date: 2026-05-06  
Scope: Operations only (no API contract change, no grading flow change)

---

## 1. Health Check

## Backend

- `GET /health`
- `GET /api/health`
- `GET /metrics`

Quick commands:

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/health
curl -s http://localhost:8000/metrics | head -n 40
```

Expected:

- health endpoints return HTTP `200`.
- `/metrics` returns Prometheus text payload.

## Worker / Queue (Celery + Redis)

- Worker process must be running.
- Redis must be reachable from backend and worker.

Quick commands (Docker):

```bash
docker ps
docker logs --since 5m ai_review_worker
docker logs --since 5m ai_review_backend
```

---

## 2. Metrics Reading Guide

## Core latency / queue metrics

- `api_request_duration_seconds`  
  Labels: `method`, `route`, `status_code`

- `grading_queue_delay_seconds`  
  Labels: `document_type`, `prompt_level`, `status="QUEUED"`

- `grading_duration_seconds`  
  Labels: `document_type`, `prompt_level`, `status`

## Audit / Export metrics

- `audit_query_duration_seconds`  
  Labels: `status`

- `export_duration_seconds`  
  Labels: `endpoint`, `status`

- `export_rows_total`  
  Labels: `endpoint`

## Grade reliability counters

- `grading_run_created_total`
- `grading_run_reused_total`
- `grading_run_failed_total`
- `grading_retry_total`

### PromQL examples

API P95:

```promql
histogram_quantile(
  0.95,
  sum(rate(api_request_duration_seconds_bucket[5m])) by (le, route, method)
)
```

Queue delay P95:

```promql
histogram_quantile(
  0.95,
  sum(rate(grading_queue_delay_seconds_bucket[5m])) by (le, document_type, prompt_level)
)
```

Audit query avg:

```promql
sum(rate(audit_query_duration_seconds_sum[5m])) / sum(rate(audit_query_duration_seconds_count[5m]))
```

Export rows throughput:

```promql
sum(rate(export_rows_total[5m])) by (endpoint)
```

---

## 3. Debug Playbook

## A) Grading stuck (`PENDING`/`EXTRACTING` lâu)

1. Check queue delay metrics:
- `grading_queue_delay_seconds`

2. Check worker logs:
- xem lỗi kết nối Redis/DB/Gemini

3. Check run status transition:
- `GET /api/audit/runs?status=PENDING`
- `GET /api/audit/runs/{run_id}`

4. If worker down:
- restart worker
- theo dõi run cũ tiếp tục hay fail có kiểm soát

## B) Worker fail spike / retry spike

1. Check metrics:
- `grading_run_failed_total`
- `grading_retry_total`

2. Correlate with logs:
- `request_id`
- error_code trong structured logs

3. Verify dependencies:
- Redis reachable
- DB reachable
- Gemini/API provider reachable

4. Action:
- nếu dependency outage: chuyển trạng thái incident, thông báo PMO
- nếu cấu hình lỗi: rollback config gần nhất (không sửa dữ liệu cũ)

## C) Export/Audit chậm hoặc fail

1. Check metrics:
- `audit_query_duration_seconds`
- `export_duration_seconds`
- `export_rows_total`

2. Verify DB pressure:
- kiểm tra slow query / connection saturation

3. Retry with narrower scope:
- filter theo `project_id`, `document_id`, `version_id`

4. Nếu lỗi tái diễn:
- mở incident và dùng checklist game-day tương ứng

---

## 4. Verify Audit/Export Functionality

## Audit list

```bash
curl -s "http://localhost:8000/api/audit/runs?project_id=P200&limit=20&offset=0"
```

## Audit export CSV

```bash
curl -L -o audit.csv "http://localhost:8000/api/audit/export?project_id=P200&format=csv"
```

## Version diff export CSV

```bash
curl -L -o diff.csv "http://localhost:8000/api/documents/1/versions/diff/export?version_id_a=10&version_id_b=11"
```

Expected:

- response HTTP `200`
- file tải thành công
- CSV có header đúng theo README

---

## 5. Escalation Matrix (Recommended)

- P1: hệ thống không grade được diện rộng / export fail diện rộng
  - phản hồi ban đầu < 15 phút
- P2: latency tăng mạnh, queue delay tăng kéo dài
  - phản hồi ban đầu < 30 phút
- P3: lỗi cục bộ theo project/document
  - xử lý trong ngày

---

## 6. Close Criteria for Ops Shift

Một ca vận hành được coi là ổn nếu:

- health endpoints xanh
- queue delay không tăng bất thường kéo dài
- failed/retry không vượt ngưỡng cảnh báo
- audit/export hoạt động và metrics cập nhật liên tục

