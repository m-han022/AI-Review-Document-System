# Quick Deploy - AI Review Document System

Tài liệu này dùng để chạy nhanh local và deploy bản cơ bản cho hệ thống AI Review Tài Liệu.

## 1. Chạy local

### Backend

Tạo file `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash-preview
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
```

Chạy backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

API local:

```text
http://localhost:8001/api
```

### Frontend

Tạo file `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8001/api
```

Chạy frontend:

```bash
cd frontend
npm install
npm run dev -- --host localhost --port 5173 --strictPort
```

Mở ứng dụng:

```text
http://localhost:5173
```

## 2. Deploy backend trên Render

Tạo Web Service trên Render với cấu hình:

```text
Root Directory: backend
Environment: Python
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Environment variables bắt buộc:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash-preview
FRONTEND_URL=https://your-frontend-domain
CORS_ALLOWED_ORIGINS=https://your-frontend-domain
```

Sau khi deploy, backend sẽ có dạng:

```text
https://your-backend-domain
https://your-backend-domain/api
https://your-backend-domain/docs
```

## 3. Deploy frontend trên Vercel

Import repository vào Vercel và cấu hình:

```text
Root Directory: frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Environment variable:

```env
VITE_API_BASE_URL=https://your-backend-domain/api
```

Sau khi frontend có domain thật, quay lại Render và cập nhật:

```env
FRONTEND_URL=https://your-frontend-domain
CORS_ALLOWED_ORIGINS=https://your-frontend-domain
```

Redeploy backend sau khi đổi CORS.

## 4. Lưu ý quan trọng về database và file upload

Hệ thống hiện dùng SQLite tại:

```text
backend/data/review_system.db
```

File upload runtime nằm tại:

```text
backend/uploads/
```

Khi deploy cloud, nếu không cấu hình persistent storage thì DB SQLite và file upload có thể bị mất khi service redeploy, restart hoặc đổi instance.

Khuyến nghị:

- Môi trường demo/nội bộ: có thể dùng SQLite, nhưng nên gắn persistent disk cho `backend/data/` và `backend/uploads/`.
- Môi trường sử dụng thật: nên chuyển DB sang PostgreSQL hoặc một database managed, và lưu file upload vào object storage.
- Không nên coi file trong `backend/data/` và `backend/uploads/` là dữ liệu an toàn nếu chưa có persistent storage/backup.

## 5. Kiểm tra sau deploy

Kiểm tra backend:

```text
GET https://your-backend-domain/health
GET https://your-backend-domain/docs
```

Kiểm tra frontend:

```text
https://your-frontend-domain
```

Thử các luồng chính:

- Upload file `PDF` hoặc `PPTX`.
- Chấm điểm một bài.
- Kiểm tra tổng điểm, điểm theo tiêu chí và `Review theo từng slide`.
- Đổi ngôn ngữ UI.
- Xuất Excel nếu cần kiểm tra sheet `SlideReviews`.

## 6. Lỗi thường gặp

### Frontend báo `Failed to fetch`

Kiểm tra:

- Backend đã chạy chưa.
- `VITE_API_BASE_URL` của frontend có trỏ đúng `https://your-backend-domain/api` không.
- `CORS_ALLOWED_ORIGINS` trên backend có đúng domain frontend không.
- Sau khi sửa biến môi trường, backend/frontend đã redeploy chưa.

### Backend không start

Kiểm tra:

- `GEMINI_API_KEY` đã được khai báo chưa.
- Render build log có lỗi install package nào không.
- Start command có đúng `uvicorn app.main:app --host 0.0.0.0 --port $PORT` không.

### Upload/chấm điểm lỗi

Kiểm tra:

- File có đúng định dạng `PDF` hoặc `PPTX` không.
- Gemini API key có còn hoạt động không.
- File quá lớn so với giới hạn của platform không.
- Backend log có lỗi extract PDF/PPTX hoặc lỗi gọi Gemini không.

### `Review theo từng slide (0)`

Nguyên nhân thường gặp:

- Kết quả chấm cũ được tạo trước khi có schema `slide_reviews`.
- Prompt/rubric trong DB chưa được cập nhật.
- Bài chưa được chấm lại sau khi đổi prompt.

Cách xử lý:

```http
POST /api/grade/{project_id}?force=true&rubric_version=v1
```

## 7. Reset DB khi cần làm sạch dữ liệu

Nếu muốn seed lại rubric và tạo DB mới:

1. Dừng backend.
2. Xóa file `backend/data/review_system.db`.
3. Khởi động lại backend.

Lưu ý:

- Thao tác này xóa submission và kết quả chấm trong DB.
- File trong `backend/uploads/` không tự bị xóa.
- Nếu chỉ sửa file rubric sau khi DB đã tồn tại, DB không tự cập nhật theo file. Khi đó cần cập nhật rubric qua giao diện, gọi API lưu rubric, hoặc reset DB để seed lại.

## 8. Lệnh kiểm tra trước khi deploy

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

## 9. Tài liệu liên quan

- [README.md](README.md)
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [LANGUAGE_DETECTION_GUIDE.md](LANGUAGE_DETECTION_GUIDE.md)
