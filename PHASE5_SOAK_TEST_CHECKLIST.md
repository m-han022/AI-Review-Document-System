# Phase 5 Soak Test Checklist

Date: 2026-05-06  
Purpose: xác nhận hệ thống ổn định khi chạy dài, với tải lặp upload/grade/audit/export.

---

## 1. Test Window

- Recommended soak duration:
  - tối thiểu: `2 giờ`
  - mục tiêu: `8-24 giờ` (overnight)

- Sampling interval metrics:
  - mỗi `1-5 phút`

---

## 2. Preconditions

- Backend + Worker + Redis + DB chạy ổn định.
- Có API key và evaluation set active cho scope test.
- Không chạy migration/schema change trong lúc soak.
- Có đủ disk cho log/export artifacts.

---

## 3. Workload Pattern

- Lặp chu kỳ:
  1. create project
  2. upload document
  3. trigger grade
  4. poll audit list
  5. call audit export

- Có thể dùng script:
  - `backend/scripts/soak_phase5_runtime.py`

---

## 4. Metrics to Track

Required:

- `api_request_duration_seconds` (P50/P95/P99)
- `grading_queue_delay_seconds` (P95)
- `grading_retry_total`
- `grading_run_failed_total`
- `audit_query_duration_seconds`
- `export_duration_seconds`
- `export_rows_total`

Operational:

- CPU / memory backend
- CPU / memory worker
- Redis memory + connection health
- DB connection usage / slow query

---

## 5. Pass/Fail Criteria

Pass:

- Không có memory leak rõ rệt (trend tăng không kiểm soát).
- Queue delay không tăng liên tục vượt ngưỡng vận hành.
- Tỷ lệ failed run ổn định trong ngưỡng chấp nhận.
- Audit/export thành công xuyên suốt test window.
- Metrics cập nhật liên tục, không “đứng”.

Fail:

- Worker chết lặp lại hoặc queue backlog tăng không hồi phục.
- Export timeout diện rộng.
- API latency P95 tăng liên tục và không hồi về baseline.
- Có regression hành vi Phase 1-4.

---

## 6. Execution Checklist

- [ ] Start environment and verify `/health`, `/api/health`, `/metrics`
- [ ] Run soak script với duration mục tiêu
- [ ] Snapshot metrics định kỳ (1-5 phút/lần)
- [ ] Ghi nhận error log theo request_id
- [ ] Tổng hợp kết quả cuối ca:
  - latency summary
  - queue summary
  - fail/retry summary
  - export summary

---

## 7. Report Template (End of Soak)

- Window:
- Total cycles:
- Completed grades:
- Failed grades:
- Retry count:
- API P95 (main routes):
- Queue delay P95:
- Audit/export success rate:
- Notable incidents:
- Final verdict: PASS / FAIL

