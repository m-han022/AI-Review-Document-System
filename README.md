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
* **Định dạng file bắt buộc**: Filename phải khớp pattern `P\d+[-_].+` (Ví dụ: `P001-ProjectName.pdf`).
* **Validation bắt buộc**: project_id parse từ filename (phần `Pxxx`) phải khớp project_id đã chọn trên UI.
* **project_description** là metadata project, không thay thế nội dung tài liệu.
* **Tái sử dụng nội dung**: Hệ thống dùng binary hash để bỏ qua trích xuất text nếu cùng một file được upload lại.

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
uvicorn app.main:app --reload --reload-dir app --reload-exclude "data/*" --reload-exclude "uploads/*"

# Frontend
cd frontend
npm install
npm run dev
```

### Local Dev Scripts (Recommended on Windows)

For local development, prefer the repo scripts instead of enabling Celery by default.

#### Sync local mode (safe default)

```powershell
cd e:\workspace\AI-Review-Document-System
.\scripts\dev-start-sync.ps1
```

- Forces `USE_CELERY=false` for the local backend process.
- Prevents orphaned `PENDING` grading runs when Redis / Celery worker are not running.
- Recommended for normal UI/API development.

#### Async local mode (explicit)

```powershell
cd e:\workspace\AI-Review-Document-System
.\scripts\dev-start-async.ps1
```

- Starts local frontend/backend in async mode.
- Expects Redis on `localhost:6379`.
- If Redis is missing and Docker is available, the script starts the `redis` service from `docker-compose.yml`.
- Also starts a local Celery worker process.

#### Stop local processes

```powershell
.\scripts\dev-stop.ps1
```

To stop Redis started through Docker as well:

```powershell
.\scripts\dev-stop.ps1 -StopRedis
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

## Evaluation Bundle V2 Cutover Gate (Phase 4)

```powershell
cd backend
$env:PYTHONPATH='.'

# 1) Migration hardening audit (dry-run)
python scripts/evaluation_bundle_v2_migration_hardening.py --output artifacts/evaluation_bundle_v2_migration_report.pre_cutover.json

# 2) Parity report (all active scopes)
python scripts/evaluation_bundle_v2_parity_report.py --all-active-scopes --output artifacts/evaluation_bundle_v2_parity_report.pre_cutover.json

# 3) Go/No-Go gate
python scripts/evaluation_bundle_v2_pre_cutover_gate.py `
  --migration-report artifacts/evaluation_bundle_v2_migration_report.pre_cutover.json `
  --parity-report artifacts/evaluation_bundle_v2_parity_report.pre_cutover.json
```

Expected:
- Gate must return `"PASS"`.
- `mismatched = 0`.
- `active_scope_violations = 0`.

## Official Operation (Local/Internal)

Source of truth: phần "Official Operation (Local/Internal)" trong chính `README.md` này.

Mandatory before internal operation/demo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-verify-v2.ps1
```

Rule:
- Only operate when result is `PASS`.

Go/No-Go criteria (mandatory):
- `mismatched = 0` in parity report.
- `invalid_status_count = 0` in migration hardening report.
- `active_scope_violations = 0` in migration hardening report.

---

# 🌐 API (High-level)

* `GET /projects`: Danh sách dự án
* `POST /api/upload`: Upload tài liệu mới (tạo Version mới)
* `POST /api/grade`: Bắt đầu chấm điểm (Nếu dùng Celery sẽ trả về PENDING ngay)
* `GET /versions/{id}/gradings`: Lấy lịch sử chấm điểm
* `GET /api/audit/export`: Export danh sách audit run (CSV, read-only)
* `GET /api/documents/{document_id}/versions/diff/export`: Export version diff (CSV, read-only)

---

# 📄 CSV Export Columns

## 1) Audit Export CSV

Endpoint: `GET /api/audit/export`

| Column | Meaning |
| :--- | :--- |
| `project_id` | Mã project |
| `document_id` | ID document |
| `document_version_id` | ID version tài liệu |
| `grading_run_id` | ID grading run |
| `score` | Điểm tổng (ưu tiên `total_score`, fallback `score`) |
| `status` | Trạng thái run (`PENDING/EXTRACTING/GRADING/COMPLETED/FAILED`) |
| `prompt_level` | Mức đánh giá (`low/medium/high`) |
| `evaluation_set_id` | ID bộ tiêu chuẩn chấm đã dùng |
| `graded_at` | Thời điểm chấm (ISO datetime) |

## 2) Version Diff Export CSV

Endpoint: `GET /api/documents/{document_id}/versions/diff/export`

| Column | Meaning |
| :--- | :--- |
| `row_type` | Loại dòng: `summary` / `criteria` / `warning` |
| `document_id` | ID document |
| `version_a_id` | ID version A |
| `version_b_id` | ID version B |
| `run_a_id` | ID run dùng cho version A |
| `run_b_id` | ID run dùng cho version B |
| `score_a` | Điểm version A (dòng `summary`) |
| `score_b` | Điểm version B (dòng `summary`) |
| `score_delta` | Chênh lệch điểm (dòng `summary`) |
| `score_direction` | Hướng thay đổi điểm: `up/down/same` (dòng `summary`) |
| `prompt_level_changed` | Có đổi mức đánh giá hay không (dòng `summary`) |
| `evaluation_set_changed` | Có đổi bộ tiêu chuẩn hay không (dòng `summary`) |
| `same_evaluation_context` | Có cùng ngữ cảnh đánh giá hay không (dòng `summary`) |
| `criterion_key` | Mã tiêu chí (dòng `criteria`) |
| `criterion_a` | Điểm tiêu chí ở version A (dòng `criteria`) |
| `criterion_b` | Điểm tiêu chí ở version B (dòng `criteria`) |
| `criterion_delta` | Chênh lệch theo tiêu chí (dòng `criteria`) |
| `criterion_direction` | Hướng thay đổi theo tiêu chí: `up/down/same` (dòng `criteria`) |
| `warning` | Cảnh báo context compare (dòng `warning`) |

---

# 🧾 API Export Documentation

## `GET /api/audit/export`

Query params:

* `project_id` (required)
* `document_id` (optional)
* `version_id` (optional)
* `format` = `csv` (initial)
* `status` (optional)
* `from_time` (optional, ISO datetime)
* `to_time` (optional, ISO datetime)

Behavior:

* Read-only, không mutation.
* Streaming CSV response để tránh memory spike.
* Backend paginate nội bộ khi đọc dữ liệu lớn.

## `GET /api/documents/{document_id}/versions/diff/export`

Query params:

* `version_id_a` (required)
* `version_id_b` (required)
* `run_id_a` (optional)
* `run_id_b` (optional)

Behavior:

* Read-only, không mutation.
* Export đúng structured diff (không dùng raw LLM text).
* CSV gồm `summary + criteria + warning`.

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

# 📌 Current Product State (Latest)

- Phase 1–5 completed and stable.
- Core architecture stable: `Project -> Document -> Version -> GradingRun`.
- i18n dictionaries (VI/JA) are clean:
  - Missing keys: 0
  - Used-key missing: 0
  - Potential mojibake (VI/JA): 0
- Operational modules implemented and stable:
  - Enterprise AI Review Operations Dashboard (KPIs, Risk Watchlist)
  - Advanced Project Context (project_description) supported in AI prompts
  - Audit Dashboard & Version Diff
  - Export CSV (Audit & Diff)

---

# 🛡️ Operational Truth Guardrail

All dashboard/UI/UX refinements must be grounded in **real existing system data**.

Allowed:
- reorganize existing data
- derive insights directly from current state/API/metrics
- improve operational clarity, governance visibility, decision support

Not allowed:
- fake AI insights/predictions
- fake governance/risk scoring
- recommendation logic without backend source
- analytics requiring non-existing APIs
- workflow changes that alter business behavior

Before adding any new UI block:
1. map to existing API/metric/state source
2. evaluate regression risk
3. confirm no large backend rewrite needed

---

# ✅ Release Validation Gate

For UI polish and documentation-aligned releases:

```bash
npm run build
npm run check:i18n
```

Expected:
- Missing in vi/ja = 0
- Used keys missing in dictionary = 0
- Potential mojibake vi/ja = 0

---

# 🔄 Runtime Behavior (Current)

## Review Flow (Auto Mode)

- Ở màn Upload, hệ thống hiển thị bộ đánh giá theo chế độ `[Auto]`.
- User vận hành thường không cần chọn `Evaluation Set` thủ công để chạy review.
- Backend sẽ tự resolve bộ đánh giá active phù hợp theo `(document_type, prompt_level)`.

## Evaluation Set Auto-Ensure

- Nếu request review không truyền `evaluation_set_id`, backend sẽ tự tìm active set theo scope.
- Nếu chưa có active set, backend thử auto-ensure theo scope hiện tại để giảm gián đoạn vận hành.
- Nếu scope chưa đủ cấu hình nâng cao, hệ thống vẫn ưu tiên backward-compatible behavior để không phá luồng review cũ.

## Auditability

- Mỗi lần chấm vẫn tạo `GradingRun` mới.
- Metadata cấu hình thực tế dùng để chấm vẫn được lưu trong `GradingRun` (khi có).

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

---

# ⚙️ Evaluation Set Operation (Current)

## Scope Rule

- 1 scope = `(document_type + prompt_level)`.
- Mỗi scope chỉ có 1 `active Evaluation Set` dùng cho các lần chấm mới.

## Auto Runtime

- Ở màn Upload, user vận hành thường không bắt buộc chọn `evaluation_set_id` thủ công.
- Backend sẽ tự resolve bộ active theo `(document_type, prompt_level)`.
- Nếu chưa có active set, backend thử auto-ensure theo scope để giảm gián đoạn vận hành.

## Audit Rule

- Mỗi `GradingRun` vẫn lưu metadata cấu hình đã dùng (khi có) để truy vết/audit.

---

# 🧭 Quick Start (Business Flow)

1. Tạo Project.
2. Chọn loại tài liệu + mức độ đánh giá.
3. Upload tài liệu vào Project đã có.
4. Bấm review và xem kết quả chi tiết.
5. Nếu cần thay chuẩn chấm, tạo bộ tiêu chuẩn mới từ bộ hiện tại và kích hoạt.

---

# ✅ UAT / Release Gate

- Chạy gate bắt buộc: `powershell -ExecutionPolicy Bypass -File scripts/dev-verify-v2.ps1`
- Chỉ vận hành khi kết quả cuối là `PASS`
- Nếu gate fail: dừng vận hành và xử lý theo log từ migration/parity/pre-cutover

---

# 🛠️ Troubleshooting

### Python 3.14 + Windows Installation Issue
If `pip install -r requirements.txt` fails at `watchfiles` on Windows with Python 3.14:
1. Use `backend/requirements_temp.txt` (filtered version) or manually install dependencies excluding `watchfiles`.
2. Run backend without `--reload` if `watchfiles` is missing: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.

### Windows NPM Permission Issue (`EPERM ... lstat C:\Users\...`)
If `npm run dev` fails with `EPERM` related to user profile path resolution, use the project dev scripts instead:

```powershell
cd e:\workspace\AI-Review-Document-System
.\scripts\dev-start-sync.ps1
```

Stop backend/frontend and local Celery worker:

```powershell
.\scripts\dev-stop.ps1
```

If you used async local mode and want to stop Docker Redis too:

```powershell
.\scripts\dev-stop.ps1 -StopRedis
```

The fallback script starts:
- Backend: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Frontend: `node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173`
- Default local mode is synchronous (`USE_CELERY=false`) to avoid stuck `PENDING` runs.
- For explicit async local testing, use `.\scripts\dev-start-async.ps1`.

---

# Patch Notes (2026-05-13)

## Cache Signature Update

Current grading cache signature includes:

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

## Verification Gate Add-on

- Verify repeated grading under same evaluation context resolves against `COMPLETED` cache candidate correctly.
- Keep append-only audit behavior: each grading action must preserve history.


