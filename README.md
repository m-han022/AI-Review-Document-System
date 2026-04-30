# Hệ thống AI Review Tài Liệu

Hệ thống full-stack dùng để upload tài liệu `PDF` hoặc `PPTX`, trích xuất nội dung, chấm điểm bằng Google Gemini theo tiêu chuẩn đánh giá, và hiển thị kết quả review chi tiết theo tiêu chí và theo từng slide/page.

## Tổng quan

- Frontend: `React 19` + `TypeScript` + `Vite`
- Backend: `FastAPI`
- Database runtime: `SQLite` tại `backend/data/review_system.db`
- Model grading: Google Gemini
- File upload runtime: `backend/uploads/`
- Ngôn ngữ UI: `Tiếng Việt`, `日本語`
- Giao diện: hỗ trợ chế độ sáng/tối
- Kết quả review: song ngữ `vi/ja`, gồm tổng điểm, điểm theo tiêu chí, góp ý chi tiết và review từng slide/page

## Cách chạy local hiện tại

Backend chạy ở:

```text
http://localhost:8001
```

Frontend chạy tại:

```text
http://localhost:5173
```

Chạy backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

API base sau khi backend chạy:

```text
http://localhost:8001/api
```

Chạy frontend:

```bash
cd frontend
npm install
set VITE_API_BASE_URL=http://localhost:8001/api&& npm run dev -- --host localhost --port 5173 --strictPort
```

Nếu dùng PowerShell:

```powershell
cd frontend
$env:VITE_API_BASE_URL="http://localhost:8001/api"
npm run dev -- --host localhost --port 5173 --strictPort
```

Lưu ý: frontend source hiện fallback về `http://localhost:8001/api`. Vẫn nên set `VITE_API_BASE_URL=http://localhost:8001/api` để tránh lệch cấu hình giữa local, preview và production.

Có thể cấu hình cố định cho frontend bằng file `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8001/api
```

## Cấu hình môi trường

Tạo file `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Hoặc dùng nhiều key:

```env
GEMINI_API_KEYS=key1,key2,key3
GEMINI_MODEL=gemini-3-flash-preview
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
API_TITLE=AI Review Document API
API_VERSION=1.0.0
```

Backend hiện có CORS mặc định cho từng origin dev sau:

```text
http://localhost:5173
http://localhost:5174
http://localhost:5175
http://localhost:5176
http://127.0.0.1:5173
http://127.0.0.1:5174
http://127.0.0.1:5175
http://127.0.0.1:5176
http://localhost:3000
http://127.0.0.1:3000
```

## Các loại tài liệu hỗ trợ

- `project-review`: Review tài liệu retrospective / tổng kết dự án
- `bug-analysis`: Review tài liệu phân tích bug
- `qa-review`: Review tài liệu QA
- `explanation-review`: Review tài liệu giải thích

## Phát hiện ngôn ngữ

Hệ thống tự phát hiện ngôn ngữ tài liệu từ nội dung extract bằng cơ chế weighted scoring, thay vì chỉ đếm vài ký tự Nhật hay Việt.

Các tín hiệu chính:

- số lượng ký tự đặc trưng `vi/ja`
- pattern từ khóa đặc trưng
- tỷ lệ xuất hiện của từng ngôn ngữ trong toàn văn bản

Nguyên tắc này giúp giảm false positive với tài liệu hỗn hợp, ví dụ:

- tài liệu tiếng Việt có tên công ty hoặc thuật ngữ tiếng Nhật
- tài liệu tiếng Nhật có lẫn cụm tiếng Việt trong phần ghi chú hoặc handover

Logic hiện nằm ở:

```text
backend/app/services/pdf_parser.py
```

## Schema chấm điểm

### `project-review`

- `review_tong_the` `/25`
- `diem_tot` `/25`
- `diem_xau` `/30`
- `chinh_sach` `/20`

### `bug-analysis`

- `kha_nang_tai_hien_bug` `/25`
- `phan_tich_nguyen_nhan` `/25`
- `danh_gia_anh_huong` `/25`
- `giai_phap_phong_ngua` `/25`

### `qa-review`

- `do_ro_rang` `/25`
- `do_bao_phu` `/25`
- `kha_nang_truy_vet` `/25`
- `tinh_thuc_thi` `/25`

### `explanation-review`

- `do_ro_rang_de_hieu` `/25`
- `tinh_day_du_dung_trong_tam` `/25`
- `tinh_chinh_xac` `/25`
- `tinh_ung_dung` `/25`

## Rubric và prompt

Rubric được quản lý theo:

```text
document_type + version
```

Ví dụ:

```text
backend/app/rubrics/project-review/v1/
  vi.md
  ja.md
  meta.json
```

File seed active version:

```text
backend/app/rubrics/active_versions.json
```

File này chỉ được dùng khi seed DB lần đầu. Sau khi `backend/data/review_system.db` đã tồn tại, active version runtime được lưu trong bảng `rubric`. Khi đổi active version từ giao diện, hệ thống cập nhật DB, không tự ghi ngược lại `active_versions.json`.

Hiện tại toàn bộ hệ thống đang dùng `v1`. Với `project-review`, `v1` đã bao gồm yêu cầu trả về `slide_reviews`.

Lưu ý vận hành:

- Trong giai đoạn reset DB và làm lại dữ liệu, có thể giữ thay đổi hiện tại là `v1`.
- Sau khi hệ thống đi vào sử dụng thật, nếu thay đổi tiêu chuẩn/prompt thì nên tạo version mới, ví dụ `v2`, thay vì sửa trực tiếp `v1`.

## Database hiện tại

Runtime data được lưu trong SQLite:

```text
backend/data/review_system.db
```

Các nhóm bảng chính:

- `submission`: thông tin bài upload
- `submissioncontent`: nội dung đã trích xuất và `content_hash`
- `rubric`: version rubric, prompt `vi/ja`, trạng thái active
- `rubriccriterionrecord`: danh sách tiêu chí và điểm tối đa
- `gradingrun`: một lần chấm điểm
- `gradingcriteriaresult`: điểm và góp ý theo từng tiêu chí
- `gradingslidereview`: review từng slide/page

`gradingrun` lưu thêm các trường kiểm soát tính đúng đắn:

- `content_hash`
- `rubric_version`
- `gemini_model`
- `prompt_hash`
- `criteria_hash`
- `grading_schema_version`

Schema hiện tại:

```text
grading_schema_version = v1_slide_reviews
```

## Review theo từng slide/page

Kết quả chấm hiện yêu cầu AI trả thêm:

```json
{
  "slide_reviews": [
    {
      "slide_number": 1,
      "status": "OK",
      "title": {
        "vi": "...",
        "ja": "..."
      },
      "summary": {
        "vi": "...",
        "ja": "..."
      },
      "issues": {
        "vi": [],
        "ja": []
      },
      "suggestions": {
        "vi": "...",
        "ja": "..."
      }
    }
  ]
}
```

Quy tắc:

- Mỗi slide/page phải có `OK` hoặc `NG`.
- Nếu `NG`, bắt buộc có lý do và tư vấn sửa.
- PPTX được extract theo marker `[Slide n]`.
- PDF được extract theo marker `[Page n]`.
- UI hiển thị khu vực `Review theo từng slide`, có filter `Tất cả / OK / NG` và nút `Xem chi tiết`.

## Cơ chế cache và regrade

Hệ thống chỉ dùng lại kết quả chấm cũ nếu tất cả thông tin sau khớp:

```text
content_hash
rubric_version
gemini_model
prompt_hash
criteria_hash
grading_schema_version
slide_reviews tồn tại
```

Nếu prompt hoặc criteria thay đổi, hoặc kết quả cũ chưa có `slide_reviews`, hệ thống sẽ không coi run cũ là hợp lệ và cần chấm lại.

Chấm lại một bài:

```http
POST /api/grade/{project_id}?force=true&rubric_version=v1
```

Ví dụ:

```http
POST /api/grade/P050?force=true&rubric_version=v1
```

## Tính năng chính

- Upload file `PDF`, `PPTX`
- Tự phát hiện ngôn ngữ tài liệu `vi` hoặc `ja`
- Chọn loại tài liệu trước khi upload
- Chọn rubric version khi upload/chấm
- Chấm từng bài hoặc chấm hàng loạt
- Hiển thị tổng điểm, điểm theo tiêu chí và thanh điểm
- Hiển thị góp ý theo tiêu chí với `Giải thích` và `Để tăng điểm`
- Hiển thị review từng slide/page với trạng thái `OK/NG`
- Có modal `Xem chi tiết` cho nội dung dài
- Dashboard và danh sách bài chấm có phân trang
- Quản lý rubric/version từ giao diện
- Kích hoạt version đang áp dụng
- Xuất Excel, gồm sheet `SlideReviews`
- Xóa một bài, xóa nhiều bài, hoặc xóa theo lựa chọn
- UI đa ngôn ngữ và chế độ sáng/tối

## Luồng xử lý chính

1. Người dùng upload file từ frontend.
2. Backend lưu file vào `backend/uploads/`.
3. Backend trích xuất nội dung:
   - PPTX: theo `[Slide n]`
   - PDF: theo `[Page n]`
4. Backend phát hiện ngôn ngữ tài liệu.
5. Backend chọn rubric theo `document_type` và `rubric_version`.
6. Backend tạo grading signature gồm `content_hash`, `prompt_hash`, `criteria_hash`, `grading_schema_version`.
7. Gemini trả JSON kết quả.
8. Backend normalize kết quả và lưu vào SQLite.
9. Frontend hiển thị kết quả tổng quan, tiêu chí và từng slide/page.

## API chính

### System

- `GET /`
- `GET /health`
- `GET /docs`

### Upload và submissions

- `POST /api/upload`
- `GET /api/submissions`
- `GET /api/submissions/{project_id}/file`
- `DELETE /api/submissions/{project_id}`
- `POST /api/submissions/bulk-delete`

### Grading

- `POST /api/grade/{project_id}`
- `POST /api/grade-all`
- `GET /api/grade-jobs/{job_id}`

### Rubrics

- `GET /api/rubrics`
- `GET /api/rubrics/{document_type}`
- `GET /api/rubrics/{document_type}/{version}`
- `PUT /api/rubrics/{document_type}/{version}`
- `POST /api/rubrics/{document_type}/{version}/activate`

### Export

- `GET /api/exports/submissions.xlsx`

## Cấu trúc thư mục chính

```text
backend/
  app/
    main.py
    models.py
    database.py
    rubric.py
    storage.py
    routers/
    services/
    rubrics/
  data/
    review_system.db
  uploads/
  tests/
  requirements.txt

frontend/
  src/
    api/
    components/
    constants/
    hooks/
    locales/
    styles/
    types/
    App.tsx
    config.ts
    query.ts
  package.json
```

## Build và kiểm tra

Backend tests:

```bash
cd backend
python -m unittest discover -s tests
```

Frontend build:

```bash
cd frontend
npm run build
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Các lệnh trên là lệnh kiểm tra thủ công. Kết quả có thể thay đổi theo trạng thái code, dependency và cấu hình môi trường tại thời điểm chạy.

## Reset database

Nếu muốn áp dụng toàn bộ schema mới như dữ liệu sạch:

1. Dừng backend.
2. Xóa file:

```text
backend/data/review_system.db
```

3. Khởi động lại backend.
4. Backend sẽ tạo bảng mới và seed rubric từ `backend/app/rubrics/`.

Lưu ý:

- Thao tác này xóa toàn bộ submission và kết quả chấm cũ trong DB.
- File đã upload trong `backend/uploads/` không tự bị xóa khi xóa DB.
- Nếu chỉ sửa file rubric sau khi DB đã tồn tại, DB không tự cập nhật theo file. Khi đó cần chỉnh từ màn hình `Quản lý tiêu chuẩn đánh giá`, gọi API lưu rubric, hoặc reset DB để seed lại từ file.

## Lưu ý vận hành

- Nếu frontend báo `Failed to fetch`, kiểm tra:
  - Backend có chạy không.
  - `VITE_API_BASE_URL` có trỏ đúng API không.
  - Origin frontend có nằm trong CORS allowed origins không.
- Khi đổi prompt hoặc criteria, kết quả cũ cần được chấm lại.
- Batch grading là background job in-memory; nếu restart backend giữa chừng, job đang chạy sẽ mất.
- Các log runtime ở root như `backend-8001.*.log`, `frontend-5173.*.log` chỉ phục vụ local dev.

## Dependency chính

### Backend

- `fastapi`
- `uvicorn`
- `sqlmodel`
- `google-genai`
- `pdfplumber`
- `PyPDF2`
- `python-pptx`
- `python-dotenv`
- `python-multipart`

### Frontend

- `react`
- `react-dom`
- `@tanstack/react-query`
- `lucide-react`
- `vite`
- `typescript`

## Tài liệu liên quan

- [DEPLOYMENT.md](DEPLOYMENT.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
