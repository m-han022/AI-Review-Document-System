# AI Review Tài Liệu - Requirements Specification

## 1. Tổng Quan

### 1.1 Tên hệ thống

**AI Review Tài Liệu**

### 1.2 Mục tiêu

Hệ thống hỗ trợ upload tài liệu `PDF` hoặc `PPTX`, trích xuất nội dung, chấm điểm bằng Google Gemini theo tiêu chuẩn đánh giá, và hiển thị kết quả review chi tiết theo tổng điểm, tiêu chí và từng slide/page.

### 1.3 Đối tượng sử dụng

- Project Manager
- PMO
- Team Leader
- QA Team
- Người phụ trách review/tổng kết dự án

### 1.4 Phạm vi hiện tại

- Hệ thống full-stack chạy theo mô hình nội bộ, chưa có authentication/authorization.
- Frontend dùng `React 19`, `TypeScript`, `Vite`.
- Backend dùng `FastAPI`.
- Runtime data lưu bằng SQLite tại `backend/data/review_system.db`.
- File upload runtime lưu tại `backend/uploads/`.
- UI hỗ trợ tiếng Việt và tiếng Nhật.
- Kết quả review hỗ trợ song ngữ `vi/ja`.
- Giao diện hỗ trợ chế độ sáng/tối.

---

## 2. Functional Requirements

### 2.1 Upload tài liệu

- Hệ thống phải cho phép upload file `PDF` và `PPTX`.
- Tên file phải theo mẫu `P<project_id>_<project_name>.pdf` hoặc `P<project_id>_<project_name>.pptx`.
- Ví dụ hợp lệ:
  - `P001_WebsiteDesign.pdf`
  - `P002_CRM.pptx`
- Hệ thống phải từ chối file sai định dạng hoặc sai quy tắc tên file.
- Hệ thống phải trích xuất text sau khi upload.
- PPTX phải được extract theo marker `[Slide n]`.
- PDF phải được extract theo marker `[Page n]`.
- Hệ thống phải phát hiện ngôn ngữ tài liệu từ nội dung trích xuất.
- Hệ thống phải lưu metadata submission, nội dung trích xuất và `content_hash`.

### 2.2 Loại tài liệu

- Người dùng phải có thể chọn `document_type` khi upload.
- Hệ thống hiện hỗ trợ:
  - `project-review`
  - `bug-analysis`
  - `qa-review`
  - `explanation-review`
- `document_type` được dùng để chọn rubric, prompt và schema điểm phù hợp.

### 2.3 Rubric version

- Người dùng phải có thể chọn rubric version khi upload/chấm điểm.
- Nếu chọn active version, backend phải dùng version đang active trong DB.
- Người dùng phải có thể quản lý rubric/version từ giao diện.
- Người dùng phải có thể kích hoạt một version làm version đang áp dụng.
- Tổng điểm tối đa của các tiêu chí trong một rubric phải bằng `100`.
- Sau khi DB đã tồn tại, active version runtime được lưu trong bảng `rubric`, không tự đồng bộ ngược về `backend/app/rubrics/active_versions.json`.

### 2.4 Chấm điểm bằng AI

- Hệ thống phải dùng Google Gemini để chấm điểm nội dung.
- Kết quả chấm phải bao gồm:
  - `score`
  - `criteria_scores`
  - `criteria_suggestions`
  - `draft_feedback`
  - `slide_reviews`
- `criteria_suggestions` và `draft_feedback` phải hỗ trợ song ngữ `vi/ja`.
- `slide_reviews` phải có review theo từng slide/page với trạng thái `OK` hoặc `NG`.
- Nếu slide/page là `NG`, kết quả phải có lý do và tư vấn sửa.
- Hệ thống phải hỗ trợ chấm một tài liệu theo `project_id`.
- Hệ thống phải hỗ trợ `force=true` để chấm lại dù đã có kết quả cũ.
- Hệ thống phải hỗ trợ chấm hàng loạt các tài liệu chưa chấm.

### 2.5 Cache và regrade

- Hệ thống chỉ được dùng lại kết quả chấm cũ khi grading signature còn khớp.
- Grading signature phải dựa trên:
  - `content_hash`
  - `rubric_version`
  - `gemini_model`
  - `prompt_hash`
  - `criteria_hash`
  - `grading_schema_version`
- Kết quả cũ chưa có `slide_reviews` không được coi là kết quả hợp lệ cho schema hiện tại.
- Khi prompt hoặc criteria thay đổi, tài liệu liên quan cần được chấm lại.

### 2.6 Review theo từng slide/page

- Hệ thống phải yêu cầu AI review từng slide/page.
- Mỗi item trong `slide_reviews` phải có:
  - `slide_number`
  - `status`
  - `title`
  - `summary`
  - `issues`
  - `suggestions`
- `status` chỉ được là `OK` hoặc `NG`.
- UI phải hiển thị khu vực `Review theo từng slide`.
- UI phải có filter `Tất cả / OK / NG`.
- UI phải có nút `Xem chi tiết` để đọc nội dung dài.

### 2.7 Danh sách submission

- Hệ thống phải hiển thị danh sách submission.
- Mỗi submission phải hiển thị:
  - `project_id`
  - `project_name`
  - `filename`
  - `document_type`
  - `uploaded_at`
  - `language`
  - trạng thái
  - điểm nếu đã chấm
- API danh sách phải trả về:
  - `submissions`
  - `total`
  - `ungraded_count`
- Dashboard và màn hình tất cả bài chấm phải có phân trang trên UI.

### 2.8 Xóa submission

- Hệ thống phải cho phép xóa một submission theo `project_id`.
- Hệ thống phải cho phép xóa nhiều submission bằng danh sách `project_ids`.
- Khi xóa submission, hệ thống phải xóa dữ liệu liên quan trong DB:
  - content
  - grading runs
  - criteria results
  - slide reviews
- Kết quả xóa hàng loạt phải phân tách:
  - danh sách đã xóa
  - danh sách thất bại

### 2.9 Job chấm hàng loạt

- Chấm hàng loạt phải chạy bằng background job.
- API phải trả về `job_id` ngay khi tạo job.
- Hệ thống phải cho phép truy vấn trạng thái job.
- Trạng thái job gồm:
  - `queued`
  - `running`
  - `completed`
  - `failed`
- Job phải theo dõi:
  - `total_count`
  - `processed_count`
  - `graded_count`
  - `failed_count`
  - `results`
  - `started_at`
  - `finished_at`
- Job hiện lưu in-memory, không đảm bảo tồn tại sau khi backend restart.

### 2.10 Export dữ liệu

- Hệ thống phải hỗ trợ export danh sách submission ra Excel.
- File export phải có các sheet:
  - `Summary`
  - `CriteriaDetails`
  - `Feedback`
  - `SlideReviews`
- Dữ liệu export phải bao gồm:
  - metadata submission
  - tổng điểm
  - điểm từng tiêu chí
  - góp ý theo tiêu chí
  - feedback tổng
  - review từng slide/page
  - `rubric_version`
  - `gemini_model`
  - `prompt_hash`
  - `criteria_hash`
  - `grading_schema_version`

### 2.11 Đa ngôn ngữ

- UI phải hỗ trợ:
  - `vi`
  - `ja`
- Hệ thống phải phát hiện ngôn ngữ tài liệu giữa tiếng Việt và tiếng Nhật.
- Kết quả review phải hỗ trợ song ngữ `vi/ja`.
- Khi người dùng đổi ngôn ngữ UI, nội dung review có dữ liệu song ngữ phải đổi theo ngôn ngữ đang hiển thị.

### 2.12 Giao diện

- Hệ thống phải có:
  - dashboard
  - màn hình upload
  - màn hình tất cả bài chấm
  - màn hình kết quả review chi tiết
  - màn hình quản lý tiêu chuẩn đánh giá
- Header/topbar phải thống nhất giữa các page.
- Giao diện phải hỗ trợ chế độ sáng/tối.
- Nội dung dài phải có modal hoặc cơ chế xem chi tiết.
- UI ưu tiên phong cách business, rõ ràng, dễ đọc, phù hợp môi trường Nhật.

---

## 3. Schema Chấm Điểm

### 3.1 `project-review`

- `review_tong_the` `/25`
- `diem_tot` `/25`
- `diem_xau` `/30`
- `chinh_sach` `/20`

### 3.2 `bug-analysis`

- `kha_nang_tai_hien_bug` `/25`
- `phan_tich_nguyen_nhan` `/25`
- `danh_gia_anh_huong` `/25`
- `giai_phap_phong_ngua` `/25`

### 3.3 `qa-review`

- `do_ro_rang` `/25`
- `do_bao_phu` `/25`
- `kha_nang_truy_vet` `/25`
- `tinh_thuc_thi` `/25`

### 3.4 `explanation-review`

- `do_ro_rang_de_hieu` `/25`
- `tinh_day_du_dung_trong_tam` `/25`
- `tinh_chinh_xac` `/25`
- `tinh_ung_dung` `/25`

---

## 4. Data Requirements

### 4.1 Runtime database

Runtime database:

```text
backend/data/review_system.db
```

Các bảng chính:

- `submission`
- `submissioncontent`
- `rubric`
- `rubriccriterionrecord`
- `gradingrun`
- `gradingcriteriaresult`
- `gradingslidereview`

### 4.2 Submission

Submission phải lưu:

- `project_id`
- `project_name`
- `filename`
- `document_type`
- `language`
- `file_path`
- `uploaded_at`
- `status`
- `latest_grading_run_id`

### 4.3 Submission content

Submission content phải lưu:

- `submission_id`
- `extracted_text`
- `content_hash`

### 4.4 Grading run

Grading run phải lưu:

- `submission_id`
- `rubric_id`
- `rubric_version`
- `gemini_model`
- `score`
- `draft_feedback`
- `status`
- `error_message`
- `content_hash`
- `prompt_hash`
- `criteria_hash`
- `grading_schema_version`
- `started_at`
- `graded_at`

Schema hiện tại:

```text
grading_schema_version = v1_slide_reviews
```

### 4.5 Slide review

Slide review phải lưu:

- `grading_run_id`
- `slide_number`
- `status`
- `title`
- `summary`
- `issues`
- `suggestions`
- `created_at`

---

## 5. API Requirements

### 5.1 System

- `GET /`
- `GET /health`
- `GET /docs`

### 5.2 Upload và submissions

- `POST /api/upload`
- `GET /api/submissions`
- `GET /api/submissions/{project_id}/file`
- `DELETE /api/submissions/{project_id}`
- `POST /api/submissions/bulk-delete`

### 5.3 Grading

- `POST /api/grade/{project_id}`
- `POST /api/grade/{project_id}?force=true&rubric_version=v1`
- `POST /api/grade-all`
- `GET /api/grade-jobs/{job_id}`

### 5.4 Rubrics

- `GET /api/rubrics`
- `GET /api/rubrics/{document_type}`
- `GET /api/rubrics/{document_type}/{version}`
- `PUT /api/rubrics/{document_type}/{version}`
- `POST /api/rubrics/{document_type}/{version}/activate`

### 5.5 Export

- `GET /api/exports/submissions.xlsx`

---

## 6. Technical Requirements

### 6.1 Backend

- Framework: `FastAPI`
- Server: `uvicorn`
- Database: `SQLite`
- ORM: `sqlmodel`
- AI SDK: `google-genai`
- PDF parsing: `pdfplumber`, `PyPDF2`
- PowerPoint parsing: `python-pptx`
- File upload: `python-multipart`
- Runtime DB: `backend/data/review_system.db`
- Upload directory: `backend/uploads/`
- Local backend port đang dùng: `8001`

### 6.2 Frontend

- Framework: `React 19`
- Language: `TypeScript`
- Build tool: `Vite`
- Data fetching/cache: `@tanstack/react-query`
- Icon library: `lucide-react`
- Local frontend port: `5173`
- API base local: `http://localhost:8001/api`

### 6.3 Environment variables

Backend:

- `GEMINI_API_KEY`
- `GEMINI_API_KEYS`
- `GEMINI_MODEL`
- `FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `API_TITLE`
- `API_VERSION`

Frontend:

- `VITE_API_BASE_URL`

---

## 7. Non-Functional Requirements

### 7.1 Performance

- UI thông thường phải phản hồi nhanh.
- Chấm điểm một tài liệu phụ thuộc vào thời gian phản hồi của Gemini.
- Chấm hàng loạt phải chạy nền để không block request từ frontend.
- Danh sách submission cần có phân trang để tránh render quá nhiều item cùng lúc.

### 7.2 Reliability

- Dữ liệu submission phải tồn tại sau khi backend restart nếu SQLite file còn tồn tại.
- Upload/extract lỗi phải trả message rõ ràng.
- Khi đổi prompt/criteria/schema, kết quả cũ cần được chấm lại.
- Job chấm hàng loạt in-memory sẽ mất trạng thái nếu backend restart.

### 7.3 Security và validation

- Chỉ chấp nhận file `PDF` và `PPTX`.
- Phải validate tên file trước khi lưu.
- API key Gemini phải được cấu hình qua biến môi trường.
- CORS phải giới hạn theo danh sách origin cho phép.
- Không nên dùng `CORS_ALLOWED_ORIGINS=*` cho môi trường thật.

### 7.4 Operability

- Khi deploy cloud, nếu dùng SQLite và local uploads thì cần persistent storage.
- Với môi trường sử dụng thật, nên cân nhắc PostgreSQL hoặc database managed.
- File upload nên cân nhắc object storage nếu cần vận hành lâu dài.

---

## 8. Limitations

- Chưa có authentication/authorization.
- Chưa có phân quyền theo vai trò.
- Chưa có queue/persistent worker cho grading jobs.
- Batch grading hiện chỉ xử lý các submission chưa chấm; regrade stale results cần xử lý bằng grade đơn hoặc mở rộng API.
- Chưa có soft delete hoặc undo delete.
- Chưa có audit log riêng cho thay đổi rubric/prompt.
- Frontend hiện tải danh sách submission theo một request; server-side pagination đầy đủ nên được cải thiện nếu số lượng bài lớn.
- Upload hiện xử lý file local; môi trường cloud cần persistent storage để tránh mất file.

---

## 9. Deployment Và Vận Hành

### 9.1 Chạy local backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

### 9.2 Chạy local frontend

```bash
cd frontend
npm install
npm run dev -- --host localhost --port 5173 --strictPort
```

Nên cấu hình `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8001/api
```

### 9.3 Địa chỉ local

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8001`
- API base: `http://localhost:8001/api`
- API docs: `http://localhost:8001/docs`
- Health check: `http://localhost:8001/health`

### 9.4 Reset database

Nếu muốn tạo DB sạch:

1. Dừng backend.
2. Xóa file `backend/data/review_system.db`.
3. Khởi động lại backend.

Lưu ý:

- Thao tác này xóa submission và kết quả chấm trong DB.
- File trong `backend/uploads/` không tự bị xóa.
- Nếu DB đã tồn tại, thay đổi file rubric không tự cập nhật vào DB.

---

## 10. Hướng Nâng Cấp

- Thêm authentication/authorization.
- Thêm server-side pagination đúng nghĩa cho dashboard và danh sách submission.
- Thêm filter/search theo loại tài liệu, trạng thái, ngôn ngữ, điểm.
- Thêm API regrade stale results theo signature.
- Thêm validate số lượng `slide_reviews` so với số slide/page extract được.
- Clamp và validate `criteria_scores` theo max score.
- Chuyển batch grading sang persistent queue.
- Chuyển runtime DB sang PostgreSQL cho môi trường production.
- Chuyển upload file sang object storage.
- Thêm audit log cho thay đổi rubric/version/prompt.
- Thêm soft delete và khôi phục dữ liệu.

---

## 11. Thông Tin Tài Liệu

- Version tài liệu: `3.0.0`
- Ngày cập nhật: `2026-04-29`
- Trạng thái: `Aligned with current codebase`
