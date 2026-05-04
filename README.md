# AI Review Document System

## 🚀 Overview

Hệ thống AI Review Tài Liệu cho phép:

* Upload tài liệu (`PDF`, `PPTX`)
* Tự động trích xuất nội dung
* Chấm điểm bằng AI (Google Gemini) qua Background Worker (Celery)
* Quản lý nhiều tài liệu trong cùng một project
* Lưu lịch sử version của tài liệu (Immutable/Append-only)
* So sánh kết quả giữa các phiên bản

---

# 🏗️ Architecture

```text
Project (Submission)
  → Document
      → Document Version
          → Grading Run (Status: PENDING -> EXTRACTING -> GRADING -> COMPLETED/FAILED)
```

### Nguyên tắc cốt lõi:
* **Không overwrite**: Mọi thay đổi nội dung đều tạo Version mới.
* **Auditability**: Mọi lần chấm điểm đều được lưu lại thành một Grading Run độc lập.
* **Decoupling**: API nhận request, Worker thực hiện chấm điểm.

### Upload & Project Rules
* **Project là master data**: phải tạo project trước khi upload.
* **Upload phải chọn project có sẵn**: không auto-create project ngầm từ filename.
* **Filename chỉ dùng để validate/gợi ý**: không dùng làm source of truth.
* **Validation bắt buộc**: project_id parse từ filename phải khớp project đã chọn.
* **project_description** là metadata project, không thay thế nội dung tài liệu.

---

# 🛠️ Modes of Operation

Hệ thống hỗ trợ 2 chế độ chạy chính:

### 1. Dev Mode (Mặc định)
Phù hợp cho phát triển local, gọn nhẹ.
* **Database**: SQLite
* **Task Processing**: Synchronous (API xử lý trực tiếp)
* **Storage**: Local filesystem

### 2. Production-like Mode
Phù hợp cho môi trường thật hoặc staging.
* **Database**: PostgreSQL (qua Docker)
* **Task Processing**: Asynchronous (Redis + Celery Worker)
* **Storage**: Docker Volumes

---

# ⚙️ Configuration (Environment Variables)

### Backend (`backend/.env`)

| Variable | Dev Value | Production Value | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | `your_key` | `your_key` | Google Gemini API Key |
| `DATABASE_URL` | (trống) | `postgresql+psycopg2://...` | Connection string |
| `USE_CELERY` | `false` | `true` | Bật/tắt background worker |
| `CELERY_BROKER_URL` | `redis://...` | `redis://...` | Redis broker |
| `CELERY_RESULT_BACKEND` | `redis://...` | `redis://...` | Redis backend |

---

# 🚀 Running the System

### 1. Development Mode

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### 2. Production-like Mode (Docker)

```bash
# Khởi động toàn bộ stack (DB, Redis, Backend, Worker)
docker-compose up -d --build
```

### 3. Database Management

```bash
# Tạo migration mới
cd backend
alembic revision --autogenerate -m "description"

# Update database lên bản mới nhất
alembic upgrade head

# Migrate dữ liệu từ SQLite sang PostgreSQL
python backend/scripts/migrate_sqlite_to_postgres.py
```

### 4. Running Worker manually (nếu không dùng Docker)

```bash
cd backend
celery -A app.celery_app worker --loglevel=info --pool=solo
```

---

# 🧪 Testing

```bash
# Chạy toàn bộ test suite
cd backend
$env:PYTHONPATH="."
pytest
```

---

# 🌐 API (High-level)

* `GET /projects`: Danh sách dự án
* `POST /api/upload`: Upload tài liệu mới (tạo Version mới)
* `POST /api/grade`: Bắt đầu chấm điểm (Nếu dùng Celery sẽ trả về PENDING ngay)
* `GET /versions/{id}/gradings`: Lấy lịch sử chấm điểm

---

# 🔒 Safety & Rollback

* Dữ liệu trong `backend/data/review_system.db` là nguồn SQLite mặc định.
* Luôn backup thư mục `backend/uploads` và `backend/data` trước khi migrate.
* Nếu PostgreSQL gặp sự cố, gỡ biến `DATABASE_URL` để quay lại dùng SQLite.

---

# 🏁 Summary

```text
System = Versioned + Immutable + Auditable + Async (Production)
```

---

# 🔁 Legacy API Mapping

Các API cũ vẫn được giữ để tương thích ngược, nhưng phải map sang flow mới:

```text
project -> document -> version -> grading
```

Quy tắc bắt buộc:

* Upload legacy vẫn phải gắn với `project_id` đã tồn tại.
* Không auto-create project từ upload/filename.
* Grading legacy endpoint vẫn chấm theo `document_version` (không chấm trực tiếp project).
