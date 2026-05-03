# REQUIREMENT.md (v5 - ALIGNED WITH AGENTS v2)

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
create project

IF document chưa tồn tại:
create document

ALWAYS:
create document_version mới

---

## ❌ Không được

* overwrite file
* update version cũ

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
- Validation:
  - project_id từ filename phải match project đã chọn

## Project Description

- Là mô tả tổng quan dự án
- Không phải nội dung tài liệu
- Dùng làm context bổ sung cho AI