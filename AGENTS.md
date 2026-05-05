# AGENTS.md

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
- project_description là metadata của project
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
