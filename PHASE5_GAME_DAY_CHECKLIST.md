# Phase 5 Game-day Checklist

Date: 2026-05-06  
Purpose: kiểm tra khả năng chịu lỗi vận hành theo các tình huống thực tế.

---

## Rule chung

- Không thay đổi API contract.
- Không can thiệp dữ liệu cũ.
- Mỗi scenario cần:
  1. mục tiêu
  2. thao tác
  3. expected behavior
  4. rollback/recovery

---

## Scenario 1: Restart worker khi đang grading

Goal:
- xác nhận grading run không phá invariants khi worker restart.

Steps:
1. Trigger nhiều grading run ở trạng thái `PENDING/EXTRACTING/GRADING`.
2. Restart worker.
3. Theo dõi run status và queue delay.

Expected:
- Run không corrupt dữ liệu.
- Run chuyển `COMPLETED` hoặc `FAILED` có error_message rõ.
- Không tạo duplicate run sai context.

Recovery:
- Worker lên lại, queue tiếp tục xử lý.

---

## Scenario 2: Restart backend

Goal:
- xác nhận API phục hồi nhanh, worker độc lập vẫn xử lý queue.

Steps:
1. Đang có workload audit/export/grade.
2. Restart backend service.
3. Re-check health và API response.

Expected:
- `/health`, `/api/health`, `/metrics` hồi phục.
- Không mất audit trail.
- Grading async không phá luồng.

---

## Scenario 3: Redis unavailable tạm thời

Goal:
- quan sát hành vi queue khi broker lỗi.

Steps:
1. Dừng Redis ngắn hạn.
2. Gọi grade async.
3. Khởi động lại Redis.

Expected:
- Request lỗi có kiểm soát hoặc pending theo thiết kế.
- Không mất dữ liệu cũ.
- Khi Redis hồi phục, flow tiếp tục bình thường.

Recovery:
- Bật lại Redis, xác nhận worker reconnect.

---

## Scenario 4: DB unavailable tạm thời

Goal:
- xác nhận API/worker fail-safe, không ghi rác.

Steps:
1. Tạm thời ngắt DB.
2. Thực hiện upload/grade/audit/export.
3. Bật lại DB.

Expected:
- API trả lỗi rõ ràng, không silent failure.
- Không tạo dữ liệu nửa vời.
- Sau recovery, hệ thống chạy lại bình thường.

---

## Scenario 5: Export dataset lớn

Goal:
- kiểm chứng stream/chunk ổn định và không spike memory bất thường.

Steps:
1. Seed dataset lớn.
2. Gọi `/api/audit/export` với phạm vi rộng.
3. Theo dõi `export_duration_seconds`, `export_rows_total`, memory.

Expected:
- Export hoàn tất.
- Memory không tăng mất kiểm soát.
- Throughput ổn định theo batch.

---

## Scenario 6: Duplicate grade request

Goal:
- xác nhận idempotent + distributed lock còn đúng.

Steps:
1. Gửi nhiều request grade trùng context trong thời gian ngắn.
2. Quan sát số run được tạo/reused.

Expected:
- Không bùng nổ duplicate run active sai.
- Metric `grading_run_reused_total` tăng phù hợp.
- Không phá unique/index/lock rules.

---

## Game-day Acceptance

- [ ] Mỗi scenario có log bằng chứng
- [ ] Có metric snapshot trước/sau
- [ ] Có kết luận PASS/FAIL từng scenario
- [ ] Không regression Phase 1-4
- [ ] Có action items cho issue còn mở

