# Hệ thống AI Review Tài Liệu

Hệ thống full-stack dùng để upload tài liệu `PDF` hoặc `PPTX`, trích xuất nội dung, chấm điểm bằng Google Gemini theo tiêu chuẩn đánh giá, và hiển thị kết quả review chi tiết theo tiêu chí và theo từng slide/page.

## Tổng quan

- Frontend: `React 19` + `TypeScript` + `Vite`
- Backend: `FastAPI` + `uvicorn`
- Database runtime: `SQLite` tại `backend/data/review_system.db`
- Model grading: Google Gemini (multi-key round-robin với auto-retry)
- File upload runtime: `backend/uploads/`
- Ngôn ngữ UI: `Tiếng Việt`, `日本語`
- Giao diện: hỗ trợ chế độ sáng/tối
- Kết quả review: song ngữ `vi/ja`, gồm tổng điểm, điểm theo tiêu chí, góp ý chi tiết và review từng slide/page

## Chạy local

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend chạy tại: `http://localhost:8000`
API base: `http://localhost:8000/api`
Swagger docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại: `http://localhost:5173`

### Cấu hình API URL

Tạo file `frontend/.env.local` để cố định API URL:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

> Nếu không có file `.env.local`, frontend tự động fallback về `http://localhost:8000/api`.

## Cấu hình môi trường backend

Tạo file `backend/.env`:

```env
# Dùng một key
GEMINI_API_KEY=your_gemini_api_key_here

# Hoặc nhiều key (round-robin tự động)
GEMINI_API_KEYS=key1,key2,key3

GEMINI_MODEL=gemini-2.5-flash
FRONTEND_URL=http://localhost:5173
API_TITLE=AI Review Document API
API_VERSION=1.0.0
```

CORS mặc định cho phép: `localhost:5173`, `localhost:3000`, `127.0.0.1:5173`, `127.0.0.1:3000`.

## Các loại tài liệu hỗ trợ

| document_type | Mô tả |
|---|---|
| `project-review` | Review retrospective / tổng kết dự án |
| `bug-analysis` | Review phân tích bug |
| `qa-review` | Review tài liệu QA |
| `explanation-review` | Review tài liệu giải thích |

## Schema chấm điểm

### `project-review`
- `review_tong_the` `/25` · `diem_tot` `/25` · `diem_xau` `/30` · `chinh_sach` `/20`

### `bug-analysis`
- `kha_nang_tai_hien_bug` `/25` · `phan_tich_nguyen_nhan` `/25` · `danh_gia_anh_huong` `/25` · `giai_phap_phong_ngua` `/25`

### `qa-review`
- `do_ro_rang` `/25` · `do_bao_phu` `/25` · `kha_nang_truy_vet` `/25` · `tinh_thuc_thi` `/25`

### `explanation-review`
- `do_ro_rang_de_hieu` `/25` · `tinh_day_du_dung_trong_tam` `/25` · `tinh_chinh_xac` `/25` · `tinh_ung_dung` `/25`

## Phát hiện ngôn ngữ

Hệ thống tự phát hiện ngôn ngữ tài liệu (`vi`/`ja`) từ nội dung extract bằng weighted scoring kết hợp:
- Số lượng ký tự đặc trưng từng ngôn ngữ
- Pattern từ khóa đặc trưng
- Tỷ lệ xuất hiện trong toàn văn bản

Logic tại: `backend/app/services/pdf_parser.py`

## Rubric và prompt

Rubric được quản lý theo `document_type + version`. Cấu trúc file seed:

```text
backend/app/rubrics/
  project-review/v1/
    vi.md         ← prompt tiếng Việt
    ja.md         ← prompt tiếng Nhật
    meta.json     ← criteria keys, max_scores, labels
  active_versions.json
```

- `active_versions.json` chỉ dùng khi seed DB lần đầu.
- Sau khi DB tồn tại, active version được quản lý trong bảng `rubric`.
- Thay đổi prompt/criteria nên tạo version mới (`v2`, `v3`...) thay vì sửa trực tiếp.

## Database

```text
backend/data/review_system.db   ← SQLite runtime
```

Các bảng chính:

| Bảng | Mô tả |
|---|---|
| `submission` | Metadata bài upload |
| `submissioncontent` | Nội dung trích xuất + `content_hash` |
| `rubric` | Version rubric, prompt `vi/ja`, trạng thái active |
| `rubriccriterionrecord` | Tiêu chí và điểm tối đa |
| `gradingrun` | Một lần chấm điểm |
| `gradingcriteriaresult` | Điểm và góp ý theo tiêu chí |
| `gradingslidereview` | Review từng slide/page |

Schema version hiện tại: `grading_schema_version = v1_slide_reviews`

## Cơ chế cache và regrade

Kết quả cũ chỉ được tái dùng khi **toàn bộ** grading signature khớp:

```text
content_hash + rubric_version + gemini_model +
prompt_hash + criteria_hash + grading_schema_version + slide_reviews is not None
```

- In-memory cache có giới hạn tối đa **200 entries** (LRU eviction).
- Cache chỉ ghi khi `use_cache=True`; `force=True` sẽ không ghi vào cache.

Chấm lại một bài:

```http
POST /api/grade/{project_id}?force=true&rubric_version=v1
```

## Tính năng chính

- Upload `PDF`, `PPTX` — tự phát hiện ngôn ngữ `vi`/`ja`
- Chọn loại tài liệu và rubric version khi upload/chấm
- Chấm đơn hoặc chấm hàng loạt (background job)
- Hiển thị tổng điểm, điểm tiêu chí, thanh điểm, góp ý chi tiết
- Review từng slide/page với filter `OK / NG` và modal xem chi tiết
- Dashboard + danh sách bài chấm với phân trang
- Quản lý rubric/version từ giao diện, kích hoạt version active
- Xuất Excel gồm 4 sheet: `Summary`, `CriteriaDetails`, `Feedback`, `SlideReviews`
- Xóa đơn / xóa hàng loạt
- UI đa ngôn ngữ `vi`/`ja` và chế độ sáng/tối

## Luồng xử lý

1. Upload file → backend lưu tại `backend/uploads/`
2. Extract text (PPTX: `[Slide n]` / PDF: `[Page n]`)
3. Phát hiện ngôn ngữ tài liệu
4. Chọn rubric theo `document_type` + `rubric_version`
5. Tạo grading signature
6. Gọi Gemini API → nhận JSON kết quả
7. Normalize + lưu vào SQLite
8. Frontend hiển thị kết quả

## API

### System
- `GET /` · `GET /health` · `GET /docs`

### Upload & Submissions
- `POST /api/upload`
- `GET /api/submissions` · `GET /api/submissions/{project_id}`
- `GET /api/submissions/{project_id}/file`
- `DELETE /api/submissions/{project_id}`
- `POST /api/submissions/bulk-delete`
- `GET /api/submissions/export.xlsx`

### Grading
- `POST /api/grade/{project_id}`
- `POST /api/grade-all`
- `GET /api/grade-jobs/{job_id}`

### Rubrics
- `GET /api/rubrics` · `GET /api/rubrics/{document_type}`
- `GET /api/rubrics/{document_type}/{version}`
- `PUT /api/rubrics/{document_type}/{version}`
- `POST /api/rubrics/{document_type}/{version}/activate`

### Export
- `GET /api/exports/submissions.xlsx`

## Cấu trúc thư mục

```text
backend/
  app/
    main.py · models.py · database.py · rubric.py · storage.py · config.py
    routers/    ← grading, submissions, upload, rubrics, exports
    services/   ← grading_engine, gemini_manager, grading_jobs, pdf_parser, excel_export
    rubrics/    ← seed files theo document_type/version
  data/review_system.db
  uploads/
  requirements.txt

frontend/
  src/
    api/        ← client.ts
    components/ ← Dashboard, FileUpload, SubmissionsTable, ...
    locales/    ← vi, ja
    config.ts   ← API_BASE_URL
  package.json
```

## Build & kiểm tra

```bash
# Backend syntax check
cd backend && python -m py_compile app/main.py

# Frontend build
cd frontend && npm run build

# Frontend lint
cd frontend && npm run lint
```

## Reset database

1. Dừng backend
2. Xóa `backend/data/review_system.db`
3. Khởi động lại backend → DB tự tạo và seed rubric từ `backend/app/rubrics/`

> File upload tại `backend/uploads/` **không** tự bị xóa khi reset DB.

## Lưu ý vận hành

- **`Failed to fetch`**: kiểm tra backend đang chạy, `VITE_API_BASE_URL` đúng port, CORS origin hợp lệ.
- Đổi prompt/criteria → kết quả cũ cần chấm lại (grading signature thay đổi).
- Batch grading là background job in-memory → mất trạng thái nếu restart backend.
- Gemini multi-key: lỗi rate-limit tự chuyển sang key tiếp theo, lỗi auth vĩnh viễn disable key đó.

## Dependency chính

### Backend
`fastapi` · `uvicorn` · `sqlmodel` · `google-genai` · `pdfplumber` · `PyPDF2` · `python-pptx` · `python-dotenv` · `python-multipart` · `openpyxl`

### Frontend
`react` · `react-dom` · `@tanstack/react-query` · `lucide-react` · `vite` · `typescript`

---

[REQUIREMENTS.md](REQUIREMENTS.md) · [DEPLOYMENT.md](DEPLOYMENT.md)
