# AI Review Document System

## 🚀 Overview

Hệ thống AI Review Tài Liệu cho phép:

* Upload tài liệu (`PDF`, `PPTX`)
* Tự động trích xuất nội dung
* Chấm điểm bằng AI (Google Gemini)
* Quản lý nhiều tài liệu trong cùng một project
* Lưu lịch sử version của tài liệu
* So sánh kết quả trước và sau khi chỉnh sửa

---

# 🏗️ Architecture

```text
Project (submission)
  → Document
      → Document Version
          → Grading Run
```

### Nguyên tắc:

* 1 Project có nhiều Document
* 1 Document có nhiều Version (`v1`, `v2`, `v3`)
* Mỗi Version được chấm độc lập
* Không overwrite dữ liệu cũ

---

# 📂 Example Structure

```text
Project: P001

Bug Analysis
  - bug_login
      v1
      v2
  - bug_checkout
      v1

QA Review
  - test_case_01
      v1
```

---

# 📤 Upload

## Input

* `project_id`
* `document_type`
* `document_name`
* `file` hoặc `file_url`

---

## Behavior

* Nếu project chưa tồn tại → tạo mới
* Nếu document chưa tồn tại → tạo mới
* Luôn tạo `document_version` mới
* Không overwrite file cũ

---

# 🧠 Grading

## Nguyên tắc

* Chấm theo `document_version`
* Không chấm trực tiếp project
* Mỗi version có thể chấm nhiều lần

---

## Kết quả gồm

* Tổng điểm
* Điểm theo tiêu chí
* Góp ý chi tiết
* Review từng slide/page (`OK` / `NG`)
* Hỗ trợ song ngữ `vi / ja`

---

# ⚡ Cache

Kết quả grading được cache dựa trên:

* `content_hash`
* `document_version_id`
* `rubric_version`
* `prompt_version`
* `prompt_level`

---

# 📊 Data Model

| Entity           | Mô tả              |
| ---------------- | ------------------ |
| Project          | Dự án              |
| Document         | Tài liệu logic     |
| Document Version | Phiên bản tài liệu |
| Grading Run      | Kết quả chấm       |

---

# 🧪 Development

## Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Test

```bash
pytest
```

---

# ⚙️ Environment

### Backend (`backend/.env`)

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3-flash-preview
```

---

### Frontend (`frontend/.env.local`)

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

---

# 🌐 API (High-level)

### Core Flow

```text
GET    /projects
GET    /projects/{id}/documents
GET    /documents/{id}/versions
GET    /versions/{id}/gradings
```

---

### Legacy APIs

* `/api/submissions`
* `/api/grade/{project_id}`

→ vẫn được hỗ trợ (backward compatibility)

---

# 🖥️ Frontend Rules

* Không hardcode criteria
* Không assume 1 document per type
* Hiển thị đầy đủ:

  * Project
  * Document
  * Version
  * Rubric version
  * Prompt version
  * Level

---

# 🔒 Important Rules

* Không overwrite dữ liệu
* Mọi thay đổi đều tạo version mới
* Có thể xem lại toàn bộ lịch sử
* Có thể so sánh version

---

# 🚨 Limitations

* Chưa có authentication / authorization
* Batch job in-memory (mất khi restart)
* SQLite chưa tối ưu cho production

---

### Project Structure

Project → Document → Version → Grading Run

### Upload Flow

- Chọn project có sẵn
- Không auto-create project từ filename

## Troubleshooting: stale backend process

Nếu API đã sửa nhưng vẫn trả 404 hoặc không thấy route mới trong Swagger:

```powershell
taskkill /F /IM python.exe /T
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 🏁 Summary

```text
System = versioned + immutable + auditable
```