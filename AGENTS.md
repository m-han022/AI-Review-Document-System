# AGENTS.md (v2.1)

## 🎯 Mục tiêu hệ thống

Hệ thống AI Review Tài Liệu phải đảm bảo:

* Không ghi đè dữ liệu cũ
* Có thể audit toàn bộ lịch sử chấm
* Hỗ trợ nhiều loại tài liệu trong 1 project
* Hỗ trợ nhiều tài liệu trong cùng 1 loại
* Có thể so sánh kết quả trước/sau
* Prompt và Rubric được version hóa rõ ràng

---

# 🏗️ ARCHITECTURE

Project (submission)
→ Document
→ Document Version
→ Grading Run

---

# 📦 CORE CONCEPTS

## 1. Project (submission)

* Đại diện cho 1 dự án
* KHÔNG chứa file
* KHÔNG chứa document_type

---

## 2. Document

* Là tài liệu logic
* Thuộc về 1 project
* Có:

  * document_type
  * document_name

---

## 3. Document Version

* Mỗi lần upload = 1 version mới
* Format: v1, v2, v3...
* Không update version cũ

---

## 4. Grading Run

* Mỗi lần chấm = 1 record mới
* Gắn với document_version_id
* Immutable (không update sau khi tạo)
* Cho phép nhiều grading run trên cùng 1 version
* Lưu trữ `final_prompt_snapshot`: Lưu vết nguyên bản prompt đã gửi sang AI để audit.

---

## 5. Rubric Version

* Định nghĩa tiêu chí chấm
* Phụ thuộc document_type
* Immutable

---

## 6. Prompt Version

* Định nghĩa cách AI phản hồi
* Phụ thuộc document_type + level
* Immutable

---

## 7. Evaluation Policy (PMO)

* low / medium / high
* Không hardcode trong prompt
* Do PMO định nghĩa

---

## 8. Required Rules

* Rule hệ thống bắt buộc
* Không cho admin sửa
* Ví dụ:

  * JSON only
  * No markdown
  * No hallucination

---

# 🔥 FINAL PROMPT STRUCTURE

Final Prompt =
Required Rules

* Rubric
* Policy (level)
* Prompt Version
* Output Schema

---

# 🧠 DATA MODEL RULES

1 Project → nhiều Document
1 Document → nhiều Version
1 Version → nhiều GradingRun

---

## Version scope

Version thuộc Document
KHÔNG thuộc Project
KHÔNG thuộc document_type

---

## Document uniqueness

UNIQUE(submission_id, document_type, document_name)

---

## Version flags

* is_latest phải scoped theo:
  (submission_id, document_type, document_name)

---

# 📤 UPLOAD RULES

## Input bắt buộc

project_id
document_type
document_name
file hoặc file_url

---

## Flow

IF project chưa tồn tại:
reject upload (project must be created explicitly first)

IF document chưa tồn tại:
create document

ALWAYS:
create document_version mới

---

## Upload behavior

* Không overwrite dữ liệu cũ
* Nếu nội dung giống nhau:

  * Có thể reuse cache
  * Nhưng vẫn tạo version mới nếu user upload

---

# 🧠 GRADING RULES

* Chấm theo document_version
* Không chấm trực tiếp project
* Không chấm trực tiếp document_type

---

## Mapping

gradingrun
→ document_version
→ document
→ project

---

# ⚡ GRADING EXECUTION MODEL

## 1. Async Flow (Production)
* **API**:
  1. Nhận request chấm điểm.
  2. Tạo record `GradingRun` mới với status `PENDING`.
  3. Enqueue Celery task (`grade_document_version_task`).
  4. Trả về `GradeResponse` với status `PENDING` ngay lập tức.
* **Worker**:
  1. Cập nhật status: `EXTRACTING` (khi bắt đầu).
  2. Cập nhật status: `GRADING` (khi gọi LLM).
  3. Cập nhật status: `COMPLETED` (thành công) hoặc `FAILED` (lỗi).
  4. Lưu kết quả/error message vào DB.

## 2. Sync Flow (Local/Dev)
* Nếu `USE_CELERY=false`: API block cho đến khi chấm xong và trả kết quả `COMPLETED` hoặc `FAILED` ngay trong response.

---

# ⚡ CACHE RULES

Cache signature phải gồm:

content_hash
document_version_id
rubric_version
prompt_version
prompt_level
prompt_hash
policy_hash
required_rule_hash
binary_hash (dùng để bỏ qua bước trích xuất text nếu file trùng lặp)

---

# 🌐 API RULES

* API phải tiến hóa theo:
  project → document → version → grading
* Không truy cập trực tiếp submissioncontent
* API cũ phải được giữ và map sang logic mới (backward compatibility)

---

# 🖥️ FRONTEND RULES

## ❌ KHÔNG

* Hardcode criteria
* Assume 1 document per type

---

## ✅ PHẢI

Hiển thị rõ:

Project
Document
Version
Rubric version
Prompt version
Level

---

# 🔁 VERSION MANAGEMENT

active   = dùng cho chấm mới
archived = chỉ dùng để hiển thị lại

---

## Rule

1 document_type + level → 1 active prompt
1 document_type → 1 active rubric

---

# ⚠️ LEGACY STORAGE

Submission fields:

* filename
* document_type
* file_path

submissioncontent:

* Deprecated
* Không dùng làm source of truth
* Chỉ dùng cho migration/backward compatibility

---

# 🚨 DO NOT BREAK

* Không xóa dữ liệu cũ
* Không rewrite DB một lần
* Không assume 1 document per type
* Không mất dữ liệu cũ

---

# 🧪 TESTING RULES

* Không mất dữ liệu cũ
* API cũ vẫn chạy
* UI không vỡ
* Có thể xem history
* Không gọi AI thật trong test (phải mock)
* Core flow phải có pytest:

  * upload
  * versioning
  * grading

---

# 🔒 SAFETY

Ưu tiên:

1. Không mất dữ liệu
2. Không phá version
3. Backward compatibility

---

# 🏁 FINAL PRINCIPLE

Không overwrite
→ chỉ append
→ mọi thứ đều version hóa

## Project Rules (Updated)

- Project là master data, KHÔNG auto-create trong upload
- Upload phải gắn với project_id tồn tại
- project_description là metadata của project, được lưu trữ trong Database (Submission table)
- project_description có thể được dùng làm auxiliary context cho AI
- Không dùng project_description để thay thế nội dung tài liệu

## Upload Validation

- project_id phải tồn tại trước
- user phải chọn project từ danh sách project có sẵn
- không auto-create project ngầm từ filename
- filename chỉ dùng để validate/gợi ý
- project_id parse từ filename phải match project đã chọn
- không tạo project ngầm

## Evaluation Set Runtime Behavior (Current)

- Frontend upload/review đang chạy theo chế độ `Auto` cho bộ đánh giá.
- User không bắt buộc chọn `evaluation_set_id` thủ công trước khi bấm review.
- Backend khi nhận review sẽ:
  - ưu tiên dùng `evaluation_set_id` nếu client truyền và hợp lệ.
  - nếu không truyền, tự resolve `active EvaluationSet` theo `(document_type, prompt_level)`.
  - nếu chưa có `active EvaluationSet`, thử auto-ensure/auto-bootstrap theo scope.
- Mục tiêu vận hành: giảm thao tác cho user thường, vẫn giữ audit trail và backward compatibility.

## UI Business Terms (Current)

- `Evaluation Set` hiển thị trên UI là: `Bộ tiêu chuẩn chấm`.
- `Rubric` hiển thị là: `Khung tiêu chí chấm điểm`.
- `Prompt` hiển thị là: `Hướng dẫn phản hồi AI`.
- `Policy` hiển thị là: `Nguyên tắc đánh giá`.
- `Required Rules` hiển thị là: `Quy tắc bắt buộc`.

## Prompt Level Meaning (Current)

- `low / medium / high` là `Mức độ đánh giá` (độ nghiêm và độ sâu khi nhận xét).
- Không dùng `low / medium / high` để đại diện chất lượng tài liệu đầu vào.

## Upload UI Rule (Current)

- Trước khi bấm review, UI phải hiển thị rõ bộ tiêu chuẩn đang áp dụng theo scope hiện tại.

## Operational Truth Guardrail (Current)

- Mọi cải tiến Dashboard/UI/UX phải bám sát dữ liệu thật và nghiệp vụ thật hiện có.
- Chỉ được tổ chức lại dữ liệu có thật, tăng clarity, tăng decision-support và trustworthiness.
- Không được invent:
  - AI prediction/AI confidence giả
  - risk score giả
  - governance engine giả
  - recommendation không có logic backend
  - analytics cần API chưa tồn tại
  - workflow nghiệp vụ chưa được implement

## Allowed Data Sources For UI Blocks

- Dữ liệu hợp lệ để hiển thị/derive:
  - Project / Document / Version / GradingRun
  - grading status lifecycle (`PENDING/EXTRACTING/GRADING/COMPLETED/FAILED`)
  - audit history
  - version diff
  - export CSV state
  - evaluation set / prompt level
  - metrics endpoint (`/metrics`) và operational metrics hiện có
  - retry / queue delay / API latency metrics (nếu đã được backend expose)

## Rule Before Adding New Dashboard Block

- Phải ghi rõ:
  1. Block dùng dữ liệu/API/metrics nào đang tồn tại
  2. Dữ liệu derive trực tiếp từ state hiện tại hay từ endpoint nào
  3. Regression risk
  4. Có cần API mới không
- Nếu cần backend rewrite lớn hoặc đổi business flow: **không implement**.

---

# REFACTOR WORKFLOW RULES

## Mandatory For Large Refactor Tasks

Nếu nhiệm vụ là refactor / restructure / clean architecture / modularization:

- KHÔNG được code ngay.
- BẮT BUỘC đọc và phân tích structure hiện tại trước.
- BẮT BUỘC lập refactor plan trước khi implement.
- Chỉ được implement sau khi plan được approve rõ ràng.

## Required First Output For Refactor Tasks

Output đầu tiên phải gồm:

1. Current project structure
2. Main structural/code issues
3. Refactor goals
4. Refactor phases
5. Concrete refactor tickets
6. Risks
7. Validation plan

- Không được bỏ qua bước plan rồi chuyển thẳng sang implement.

## Phase Rules

- Refactor phải chia theo phase nhỏ.
- Mỗi phase phải có:
  - scope rõ
  - expected outcome
  - affected modules
  - regression risk
  - rollback approach
- Mỗi phase phải có tiêu chí hoàn thành rõ ràng trước khi chuyển phase tiếp theo.
- Không thực hiện big-bang rewrite.

## Scope Protection

- Không sửa file không liên quan.
- Không move/rename module lớn nếu chưa có lý do rõ và plan tương ứng.
- Không thay đổi public API / request / response contract nếu chưa được yêu cầu rõ.
- Không thay đổi DB schema hoặc persistence contract âm thầm.

## Behavior Protection

- Refactor phải giữ nguyên behavior hiện tại trừ khi có yêu cầu khác.
- Nếu có thay đổi behavior bắt buộc, phải nêu rõ:
  - old behavior
  - new behavior
  - reason
  - impact

## Validation Gate

Mỗi phase phải nêu rõ validation cần chạy theo đúng module bị ảnh hưởng. Tối thiểu nếu có liên quan:

- Backend: pytest
- Frontend: typecheck
- Frontend: build
- Lint: nếu project/module hiện có lint config
- Nếu có thay đổi cấu trúc module hoặc wiring runtime: phải nêu rõ smoke test / flow test cần chạy.
- Nếu không chạy được test/build thì phải nói rõ chưa chạy được gì và vì sao.

## Subagent Collaboration

Với task lớn có nhiều phần độc lập, phải chia vai rõ cho subagents nếu có sử dụng subagents:

- Architecture analysis agent
- Backend refactor agent
- Frontend refactor agent
- Validation/review agent

Main agent chịu trách nhiệm:

- tổng hợp plan
- chia phase
- kiểm soát scope
- review output của subagents
- đảm bảo consistency cuối cùng
- không được giao toàn bộ critical path cho subagent mà không có integration review ở main agent

## Risk And Rollback

Mỗi refactor phase phải có:

- risk chính
- impact area
- rollback strategy hoặc fallback strategy
- trigger rõ để quyết định rollback hoặc dừng rollout

## Modular Restructuring Principles

Khi tái cấu trúc theo hướng clean architecture / modular design:

- Tách rõ domain logic, application/service logic, infrastructure, presentation.
- Dependency direction phải rõ, không để module high-level phụ thuộc ngược vào low-level details.
- Legacy code phải được cô lập dần qua adapter/facade nếu cần.
- Ưu tiên strangler pattern hơn là rewrite toàn bộ.
- Không phá backward compatibility nếu chưa có approval rõ.
- Ưu tiên refactor theo seam hiện có thay vì tách module đồng loạt nếu chưa có test coverage đủ an toàn.

## Forbidden Actions During Refactor

- Không big-bang rewrite.
- Không đổi public API ngầm.
- Không đổi behavior ngầm.
- Không thêm thư viện mới nếu chưa thực sự cần.
- Không xóa test cũ nếu không có lý do và thay thế tương ứng.

## Documentation Deletion Rules (Current)

- Khi ngu?i d�ng y�u c?u d?n/x�a t�i li?u:
  1. R� so�t tham chi?u to�n repo tru?c khi x�a.
  2. Ch? x�a khi n?i dung v?n h�nh c?t l�i d� du?c h?p nh?t v�o README.md / REQUIREMENTS.md / AGENTS.md.
  3. Sau khi x�a, b?t bu?c c?p nh?t l?i link/hu?ng d?n d? kh�ng c�n dead reference.
- Kh�ng x�a im l?ng t�i li?u governance n?u chua c� b?n thay th? tuong duong.

