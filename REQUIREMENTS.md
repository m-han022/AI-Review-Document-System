# REQUIREMENTS.md (v5.1 - ALIGNED WITH AGENTS v2.1)

## 🎯 Mục tiêu

Hệ thống AI Review tài liệu phải:

* Quản lý nhiều tài liệu trong 1 project
* Lưu lịch sử version của tài liệu
* Chấm điểm độc lập từng version
* Cho phép so sánh trước/sau
* Không overwrite dữ liệu

---

# 🧠 Core Architecture

Project (submission)
→ Document
→ Document Version
→ Grading Run

---

# 📘 1. Project

* Định danh bằng `project_id`
* Đại diện cho 1 dự án
* Không chứa file

---

# 📄 2. Document

* Thuộc về 1 project
* Định danh bởi:

```text
document_type
document_name
```

* Ví dụ:

```text
bug-analysis / bug_login
qa-review / test_case_01
```

---

# 📂 3. Document Version

* Mỗi lần upload = 1 version mới
* Format: v1, v2, v3...
* Không sửa version cũ

---

## Version Rule

* Version thuộc Document
* Không thuộc Project
* Không thuộc document_type

---

# 📊 4. Quan hệ

1 Project → nhiều Document
1 Document → nhiều Version
1 Version → nhiều GradingRun

---

# 📤 5. Upload Logic

## Input

```text
project_id
document_type
document_name
file
```

---

## Flow

IF project chưa tồn tại:
reject upload (project must be created explicitly first)

IF document chưa tồn tại:
create document

ALWAYS:
create document_version mới

---

## ❌ Không được

* overwrite file
* update version cũ
* **Project Status Reset**: Khi upload version mới của một tài liệu, nếu `latest_grading_run_id` của Project đang thuộc về chính tài liệu đó, hệ thống sẽ reset trạng thái project về `pending`.

---

# 🧠 6. Grading Logic

* Chấm theo document_version
* Không chấm trực tiếp project
* Cho phép nhiều grading run trên cùng version

---

## Input mới

```json
{
  "document_version_id": 123,
  "prompt_level": "medium"
}
```

---

# ⚡ 6.1 Async Grading (Production)

* **Async execution**: Việc chấm điểm được tách biệt khỏi API request qua hàng đợi (Queue).
* **Lifecycle**: Trạng thái `GradingRun` thay đổi theo thời gian: `PENDING` -> `EXTRACTING` -> `GRADING` -> `COMPLETED/FAILED`.
* **Reliability**:
  * Tự động Retry khi gặp lỗi tạm thời (Gemini error).
  * Lưu `error_message` khi thất bại cuối cùng.
  * Backend restart không làm mất job (Job được lưu trong Redis).
* **Production mode**: Yêu cầu Redis + Celery Worker.

---

# ⚡ 7. Cache Logic

Cache key phải gồm:

* content_hash
* document_version_id
* rubric_version
* prompt_version
* prompt_level

---

# 📊 8. Result

Mỗi kết quả phải gắn với:

```text
project
document
version
rubric_version
prompt_version
level
```

---

# 🧩 9. Document Type

* Bắt buộc
* Quyết định:

  * rubric
  * prompt
  * UI

---

# 🔒 10. Immutable Rules

Không được sửa:

* document_version
* grading_run
* rubric_version
* prompt_version

---

# 🌐 11. API Evolution

* Hệ thống chuyển từ:
  submission-centric → document-centric

---

## API mới (target)

```text
GET /projects
GET /projects/{id}/documents
GET /documents/{id}/versions
GET /versions/{id}/gradings
```

---

## API cũ

* vẫn tồn tại
* phải map sang logic mới

---

# 🧪 12. Testing

Hệ thống phải đảm bảo:

* Không mất dữ liệu
* Có version history
* Có thể so sánh version
* Test bằng pytest

---

# 🚨 13. Constraints

* Không assume 1 document
* Không assume 1 version
* Không overwrite dữ liệu
* Không dùng submissioncontent làm source of truth

---

# 🏁 14. Kết luận

System = versioned + immutable + auditable


## Project Management

- Project phải được tạo trước khi upload
- User phải chọn project khi upload
- File upload phải thuộc project đã chọn
- Không auto-create project ngầm từ filename
- Filename chỉ dùng để validate/gợi ý
- Định dạng bắt buộc: `Pxxx-Tên_File.pdf` (phần `Pxxx` là Project ID).
- Validation:
  - project_id từ filename phải match project đã chọn

## Project Description

- Là mô tả tổng quan dự án
- Không phải nội dung tài liệu
- Dùng làm context bổ sung cho AI
- Được lưu trữ bền vững (persisted) trong database cùng Project metadata

---

## Evaluation Set Runtime (Current Alignment)

- UI vận hành thường dùng chế độ `Auto` cho bộ đánh giá.
- User không bắt buộc chọn `evaluation_set_id` thủ công trước khi review.

### Review Resolution Rule

Khi gọi review:

1. Nếu client truyền `evaluation_set_id` hợp lệ:
   - dùng set đó.
2. Nếu client không truyền:
   - backend tự resolve active `EvaluationSet` theo `(document_type, prompt_level)`.
3. Nếu chưa có active set theo scope:
   - backend thử auto-ensure/auto-bootstrap để giảm gián đoạn vận hành.

### Safety & Compatibility

- Không phá luồng cũ khi scope nâng cao chưa đủ dữ liệu.
- Vẫn đảm bảo nguyên tắc append-only, immutable, auditable cho grading run.

---

## UI/UX Acceptance (Current)

### Terminology

- Màn hình nghiệp vụ phải ưu tiên thuật ngữ dễ hiểu cho user:
  - `Bộ tiêu chuẩn chấm`
  - `Khung tiêu chí chấm điểm`
  - `Hướng dẫn phản hồi AI`
  - `Nguyên tắc đánh giá`
  - `Quy tắc bắt buộc`
- Tránh lộ jargon kỹ thuật ở lớp hiển thị chính (vẫn giữ metadata cho audit).

### Prompt Level Definition

- `low / medium / high` là mức độ đánh giá (độ nghiêm, độ sâu phản hồi), không phải mức chất lượng tài liệu.

### Layout & Visual Consistency

- Shell layout (`sidebar / topbar / header`) phải nhất quán ở các màn chính.
- Typography, spacing, trạng thái màu (`success / warning / danger`) phải đồng bộ.
- Không có lỗi font/encoding khi chuyển VI/JA.

### Upload UX Requirement

- Trước khi review, màn Upload phải hiển thị rõ bộ tiêu chuẩn đang áp dụng theo scope hiện tại.
- Nếu điều kiện chưa sẵn sàng (project chưa chọn/cấu hình chưa sẵn), nút hành động phải khóa kèm lý do rõ.

---

## Operational Dashboard Integrity (Current)

- Dashboard phải là **Enterprise AI Review Operations Center** dựa trên dữ liệu thật.
- Mọi block mới trên UI chỉ được dùng:
  - dữ liệu API hiện có
  - dữ liệu metrics hiện có
  - hoặc dữ liệu derive trực tiếp từ state hiện tại
- Không được thêm analytics/prediction/recommendation nếu backend không có nguồn dữ liệu thật tương ứng.

### Allowed Signals (Implemented in DashboardOverview)

- review failed count
- retry count
- queue delay trend
- API latency trend
- export status
- grading duration
- low score documents
- latest audit runs
- latest version diffs
- evaluation set coverage
- prompt level distribution
- completed vs failed reviews
- recent operational events

### Not Allowed

- AI confidence score nếu backend không có
- predictive risk engine
- anomaly detection AI chưa implement
- reviewer productivity ranking không có source thật
- recommendation engine không có logic backend

---

## UI/UX Governance (Current)

- Mục tiêu UI/UX:
  1. operational truth
  2. governance clarity
  3. workflow visibility
  4. actionable review operations
  5. enterprise trust
- Không đổi business flow khi polish UI.
- Không đổi grading architecture khi polish UI.



---

## Cache Signature (Patch 2026-05-13)

Cache key/signature ph?i bao g?m t?i thi?u:

- project_id
- content_hash
- document_version_id
- rubric_version
- prompt_version
- prompt_level
- prompt_hash
- policy_hash
- required_rule_hash
- binary_hash

## Regression Check Add-on

- L?p l?i grading c?ng evaluation context ph?i match ??ng run tr?ng th?i `COMPLETED` cho reuse logic.
- Kh?ng l?m m?t nguy?n t?c append-only/audit trail.

---

## Documentation Governance (Current)

- Nguồn chuẩn vận hành và nghiệp vụ hiện tại được duy trì trực tiếp trong:
  - `README.md`
  - `REQUIREMENTS.md`
  - `AGENTS.md`
- Không phụ thuộc vào tài liệu phase/docs đã loại bỏ.
- Trước khi xóa tài liệu cũ, bắt buộc migrate nội dung cần thiết vào 3 tài liệu trên.

### Safe Delete Rules

1. Không xóa tài liệu nếu còn được tham chiếu trong code/script/readme.
2. Không xóa tài liệu governance nếu chưa có nội dung tương đương trong `README.md`/`REQUIREMENTS.md`/`AGENTS.md`.
3. Sau khi dọn tài liệu, phải rà soát link chết bằng grep toàn repo.
