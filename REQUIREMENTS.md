# AI Review Tài Liệu — Requirements Specification

## 1. Tổng Quan

### 1.1 Tên hệ thống

**AI Review Tài Liệu**

### 1.2 Mục tiêu

Hệ thống hỗ trợ upload tài liệu `PDF` hoặc `PPTX`, trích xuất nội dung, chấm điểm bằng Google Gemini theo tiêu chuẩn đánh giá, và hiển thị kết quả review chi tiết theo tổng điểm, tiêu chí và từng slide/page.

### 1.3 Đối tượng sử dụng

- Project Manager / PMO
- Team Leader
- QA Team
- Người phụ trách review / tổng kết dự án

### 1.4 Phạm vi hiện tại

- Hệ thống full-stack chạy theo mô hình nội bộ, chưa có authentication/authorization.
- Frontend: `React 19`, `TypeScript`, `Vite`.
- Backend: `FastAPI` + `uvicorn`.
- Runtime data: SQLite tại `backend/data/review_system.db`.
- File upload: `backend/uploads/`.
- UI hỗ trợ tiếng Việt và tiếng Nhật.
- Kết quả review song ngữ `vi/ja`.
- Giao diện hỗ trợ chế độ sáng/tối.

---

## 2. Functional Requirements

### 2.1 Upload tài liệu

- Chấp nhận file `PDF` và `PPTX`.
- Tên file phải theo mẫu `P<project_id>_<project_name>.<ext>` (ví dụ: `P001_WebsiteDesign.pdf`).
- Từ chối file sai định dạng hoặc sai quy tắc tên.
- Trích xuất text sau khi upload: PPTX theo `[Slide n]`, PDF theo `[Page n]`.
- Phát hiện ngôn ngữ tài liệu từ nội dung trích xuất.
- Lưu metadata submission, nội dung trích xuất và `content_hash`.

### 2.2 Loại tài liệu

- Người dùng chọn `document_type` khi upload.
- Các loại hỗ trợ:

| document_type | Mô tả |
|---|---|
| `project-review` | Review retrospective / tổng kết dự án |
| `bug-analysis` | Review phân tích bug |
| `qa-review` | Review tài liệu QA |
| `explanation-review` | Review tài liệu giải thích |

### 2.3 Rubric và version

- Người dùng chọn rubric version khi upload/chấm điểm.
- Active version runtime được quản lý trong DB (không tự đồng bộ ngược về file seed).
- Tổng điểm tối đa các tiêu chí trong một rubric phải bằng `100`.
- Người dùng quản lý và kích hoạt version từ giao diện.
- Thay đổi prompt/criteria nên tạo version mới thay vì sửa trực tiếp.

### 2.4 Chấm điểm bằng AI

- Dùng Google Gemini (multi-key round-robin, auto-retry).
- Kết quả bao gồm: `score`, `criteria_scores`, `criteria_suggestions`, `draft_feedback`, `slide_reviews`.
- `criteria_suggestions` và `draft_feedback` phải hỗ trợ song ngữ `vi/ja`.
- `slide_reviews`: review từng slide/page với trạng thái `OK`/`NG`; nếu `NG` phải có lý do và tư vấn sửa.
- Hỗ trợ chấm đơn và `force=true` để chấm lại.
- Hỗ trợ chấm hàng loạt (background job).

### 2.5 Cache và regrade

- Tái dùng kết quả cũ chỉ khi grading signature khớp hoàn toàn:
  - `content_hash`, `rubric_version`, `gemini_model`, `prompt_hash`, `criteria_hash`, `grading_schema_version`, `slide_reviews is not None`
- In-memory cache giới hạn **200 entries** (LRU eviction).
- Cache chỉ ghi khi `use_cache=True`; `force=True` bỏ qua cache đọc và không ghi cache.
- Khi prompt/criteria thay đổi, tài liệu liên quan cần chấm lại.

### 2.6 Review theo từng slide/page

- AI phải review từng slide/page.
- Mỗi item `slide_reviews` gồm: `slide_number`, `status` (`OK`/`NG`), `title`, `summary`, `issues`, `suggestions` — tất cả song ngữ `vi/ja`.
- UI có khu vực `Review theo từng slide`, filter `Tất cả / OK / NG`, modal xem chi tiết.

### 2.7 Danh sách submission

- Hiển thị: `project_id`, `project_name`, `filename`, `document_type`, `uploaded_at`, `language`, trạng thái, điểm.
- API trả về: `submissions`, `total`, `ungraded_count`.
- Phân trang trên UI.

### 2.8 Xóa submission

- Xóa đơn theo `project_id` hoặc xóa hàng loạt theo danh sách.
- Khi xóa: xóa toàn bộ dữ liệu liên quan (content, grading runs, criteria results, slide reviews).
- Kết quả xóa hàng loạt trả về danh sách thành công / thất bại.

### 2.9 Job chấm hàng loạt

- Chạy background job, trả `job_id` ngay lập tức.
- Trạng thái: `queued` → `running` → `completed` / `failed`.
- Theo dõi: `total_count`, `processed_count`, `graded_count`, `failed_count`, `results`, `started_at`, `finished_at`.
- Job in-memory — mất trạng thái nếu backend restart.

### 2.10 Export dữ liệu

- Export Excel gồm 4 sheet: `Summary`, `CriteriaDetails`, `Feedback`, `SlideReviews`.
- Bao gồm: metadata, tổng điểm, điểm tiêu chí, góp ý, feedback, slide review, `rubric_version`, `gemini_model`, `prompt_hash`, `criteria_hash`, `grading_schema_version`.

### 2.11 Đa ngôn ngữ

- UI hỗ trợ `vi` và `ja`.
- Phát hiện ngôn ngữ tài liệu tự động.
- Kết quả review song ngữ; đổi ngôn ngữ UI → nội dung review đổi theo.

### 2.12 Giao diện

- Dashboard, màn hình upload, danh sách bài chấm, kết quả review chi tiết, quản lý tiêu chuẩn đánh giá.
- Header/topbar nhất quán giữa các trang.
- Chế độ sáng/tối.
- Nội dung dài có modal xem chi tiết.

---

## 3. Schema Chấm Điểm

### `project-review`
- `review_tong_the` `/25` · `diem_tot` `/25` · `diem_xau` `/30` · `chinh_sach` `/20`

### `bug-analysis`
- `kha_nang_tai_hien_bug` `/25` · `phan_tich_nguyen_nhan` `/25` · `danh_gia_anh_huong` `/25` · `giai_phap_phong_ngua` `/25`

### `qa-review`
- `do_ro_rang` `/25` · `do_bao_phu` `/25` · `kha_nang_truy_vet` `/25` · `tinh_thuc_thi` `/25`

### `explanation-review`
- `do_ro_rang_de_hieu` `/25` · `tinh_day_du_dung_trong_tam` `/25` · `tinh_chinh_xac` `/25` · `tinh_ung_dung` `/25`

---

## 4. Data Requirements

### 4.1 Runtime database

```text
backend/data/review_system.db
```

| Bảng | Mô tả |
|---|---|
| `submission` | Metadata bài upload |
| `submissioncontent` | Nội dung trích xuất + `content_hash` |
| `rubric` | Version rubric, prompt `vi/ja`, trạng thái active |
| `rubriccriterionrecord` | Tiêu chí và điểm tối đa |
| `gradingrun` | Một lần chấm điểm |
| `gradingcriteriaresult` | Điểm và góp ý theo tiêu chí |
| `gradingslidereview` | Review từng slide/page |

### 4.2 Grading run — các trường kiểm soát tính đúng đắn

- `content_hash`, `rubric_version`, `gemini_model`, `prompt_hash`, `criteria_hash`, `grading_schema_version`

Schema version hiện tại: `grading_schema_version = v1_slide_reviews`

---

## 5. API Requirements

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
- `POST /api/grade/{project_id}` · `POST /api/grade/{project_id}?force=true&rubric_version=v1`
- `POST /api/grade-all`
- `GET /api/grade-jobs/{job_id}`

### Rubrics
- `GET /api/rubrics` · `GET /api/rubrics/{document_type}`
- `GET /api/rubrics/{document_type}/{version}`
- `PUT /api/rubrics/{document_type}/{version}`
- `POST /api/rubrics/{document_type}/{version}/activate`

### Export
- `GET /api/exports/submissions.xlsx`

---

## 6. Technical Requirements

### 6.1 Backend

| Thành phần | Chi tiết |
|---|---|
| Framework | `FastAPI` |
| Server | `uvicorn` |
| Database | `SQLite` (`sqlmodel`) |
| AI SDK | `google-genai` |
| PDF parsing | `pdfplumber`, `PyPDF2` |
| PPTX parsing | `python-pptx` |
| Excel export | `openpyxl` |
| Port local | `8000` |

### 6.2 Frontend

| Thành phần | Chi tiết |
|---|---|
| Framework | `React 19` + `TypeScript` |
| Build tool | `Vite` |
| Data fetching | `@tanstack/react-query` |
| Icons | `lucide-react` |
| Port local | `5173` |
| API base local | `http://localhost:8000/api` |

### 6.3 Environment variables

**Backend** (`backend/.env`):
- `GEMINI_API_KEY` / `GEMINI_API_KEYS` — một hoặc nhiều Gemini API key
- `GEMINI_MODEL` — model Gemini sử dụng
- `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` — CORS origins cho phép
- `API_TITLE`, `API_VERSION`

**Frontend** (`frontend/.env.local`):
- `VITE_API_BASE_URL` — URL API backend (mặc định: `http://localhost:8000/api`)

---

## 7. Non-Functional Requirements

### 7.1 Performance

- UI thông thường phản hồi nhanh.
- Chấm điểm phụ thuộc thời gian phản hồi Gemini.
- Chấm hàng loạt chạy nền, không block request.
- Danh sách submission có phân trang.
- In-memory grading cache LRU, tối đa 200 entries.
- DB query history tối ưu: batch query thay vì N+1.

### 7.2 Reliability

- Dữ liệu tồn tại sau restart nếu SQLite file còn nguyên.
- Lỗi upload/extract trả message rõ ràng.
- Gemini multi-key: rate-limit → chuyển key; auth fail vĩnh viễn → disable key đó.
- Gemini trả JSON không hợp lệ → runtime error rõ ràng, không expose raw response.
- Job batch in-memory → mất trạng thái nếu backend restart.

### 7.3 Security và validation

- Chỉ chấp nhận `PDF` và `PPTX`.
- Validate tên file trước khi lưu.
- API key Gemini qua biến môi trường.
- CORS giới hạn theo danh sách origin.
- Không dùng `CORS_ALLOWED_ORIGINS=*` trong production.

### 7.4 Operability

- Deploy cloud với SQLite cần persistent storage.
- Production nên cân nhắc PostgreSQL và object storage.

---

## 8. Limitations

- Chưa có authentication/authorization.
- Chưa có phân quyền theo vai trò.
- Chưa có persistent queue cho grading jobs.
- Chưa có soft delete hoặc undo delete.
- Chưa có audit log cho thay đổi rubric/prompt.
- Upload xử lý file local; cloud cần persistent storage.

---

## 9. Chạy Local

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Cấu hình `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

### Địa chỉ local

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8000` |
| API base | `http://localhost:8000/api` |
| API docs | `http://localhost:8000/docs` |
| Health | `http://localhost:8000/health` |

### Reset database

1. Dừng backend
2. Xóa `backend/data/review_system.db`
3. Khởi động lại → DB tự tạo và seed rubric từ `backend/app/rubrics/`

> File trong `backend/uploads/` không tự bị xóa khi reset DB.

---

## 10. Hướng Nâng Cấp

- Thêm authentication/authorization và phân quyền.
- Server-side pagination đầy đủ.
- Filter/search theo loại tài liệu, trạng thái, ngôn ngữ, điểm.
- API regrade stale results theo signature.
- Chuyển batch grading sang persistent queue (Redis/Celery).
- Chuyển runtime DB sang PostgreSQL cho production.
- Chuyển upload file sang object storage (S3/GCS).
- Thêm audit log cho thay đổi rubric/version/prompt.
- Thêm soft delete và khôi phục dữ liệu.

---

## 11. Thông Tin Tài Liệu

| Trường | Giá trị |
|---|---|
| Version | `4.0.0` |
| Ngày cập nhật | `2026-05-02` |
| Trạng thái | `Aligned with current codebase` |
