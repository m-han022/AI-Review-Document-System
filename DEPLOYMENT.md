# AI Review Document System - Deployment

Tài liệu này gom phần chạy local, deploy cơ bản và lưu ý production cho hệ thống AI Review Tài Liệu.

## 1. Chạy local

### Backend

Tạo `backend/.env`:

```env
GEMINI_API_KEY=
GEMINI_API_KEYS=your_key_1,your_key_2
GEMINI_MODEL=gemini-3-flash-preview
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
API_TITLE=AI Review Document API
API_VERSION=1.0.0
```

Chạy backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8001
```

API local:

```text
http://localhost:8001/api
```

Lưu ý: trên một số máy Windows, `--reload` có thể gây lỗi watcher. Khi đó nên chạy không có `--reload`.

### Frontend

Tạo `frontend/.env.local`:

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

Tạo Web Service với cấu hình:

```text
Root Directory: backend
Environment: Python
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Environment variables tối thiểu:

```env
GEMINI_API_KEY=
GEMINI_API_KEYS=your_key_1,your_key_2
GEMINI_MODEL=gemini-3-flash-preview
FRONTEND_URL=https://your-frontend-domain
CORS_ALLOWED_ORIGINS=https://your-frontend-domain
API_TITLE=AI Review Document API
API_VERSION=1.0.0
```

Sau khi deploy, backend thường có dạng:

```text
https://your-backend-domain
https://your-backend-domain/api
https://your-backend-domain/docs
```

## 3. Deploy frontend trên Vercel

Import repository với cấu hình:

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

Sau khi frontend có domain thật, quay lại backend và cập nhật:

```env
FRONTEND_URL=https://your-frontend-domain
CORS_ALLOWED_ORIGINS=https://your-frontend-domain
```

Sau đó redeploy backend.

## 4. CORS

Code hiện tại không yêu cầu sửa trực tiếp `backend/app/main.py`.

CORS được đọc từ cấu hình backend qua biến môi trường:

```env
CORS_ALLOWED_ORIGINS=https://your-frontend-domain
```

Local dev đã được hỗ trợ sẵn cho các origin như:

```text
http://localhost:5173
http://127.0.0.1:5173
```

## 5. Database và file upload

Runtime hiện dùng:

```text
backend/data/review_system.db
backend/uploads/
```

Nếu deploy cloud mà không có persistent storage:

- SQLite có thể mất khi service restart/redeploy
- file upload có thể mất khi instance thay đổi

Khuyến nghị:

- demo hoặc nội bộ: dùng SQLite nhưng nên có persistent disk
- production: chuyển DB sang PostgreSQL hoặc database managed
- file upload nên chuyển sang object storage

## 6. Kiểm tra sau deploy

Backend:

```text
GET https://your-backend-domain/health
GET https://your-backend-domain/docs
```

Frontend:

```text
https://your-frontend-domain
```

Luồng nên test:

- upload file `PDF` hoặc `PPTX`
- chấm một bài
- kiểm tra tổng điểm, điểm theo tiêu chí, `Review theo từng slide`
- đổi ngôn ngữ UI
- export Excel

## 7. Lỗi thường gặp

### Frontend báo `Failed to fetch`

Kiểm tra:

- backend có đang chạy không
- `VITE_API_BASE_URL` có trỏ đúng `/api` không
- `CORS_ALLOWED_ORIGINS` có chứa domain frontend không
- sau khi đổi env đã restart hoặc redeploy chưa

### Backend không start

Kiểm tra:

- `GEMINI_API_KEY` hoặc `GEMINI_API_KEYS`
- build log dependency
- start command có đúng `uvicorn app.main:app --host 0.0.0.0 --port $PORT` không

### Chấm điểm lỗi

Kiểm tra:

- file đúng định dạng `PDF` hoặc `PPTX`
- Gemini key còn hoạt động
- model còn truy cập được
- backend log có lỗi extract hay lỗi provider

### `Review theo từng slide (0)`

Nguyên nhân thường gặp:

- dữ liệu cũ được chấm trước schema `slide_reviews`
- prompt hoặc rubric trong DB chưa cập nhật
- chưa chấm lại sau khi đổi prompt

Cách xử lý:

```http
POST /api/grade/{project_id}?force=true&rubric_version=v1
```

## 8. Reset DB

Nếu cần seed lại từ đầu:

1. dừng backend
2. xóa `backend/data/review_system.db`
3. khởi động lại backend

Lưu ý:

- thao tác này xóa submission và kết quả chấm trong DB
- file trong `backend/uploads/` không tự bị xóa
- chỉnh file rubric sau khi DB đã tồn tại sẽ không tự sync ngược vào DB

## 9. Kiểm tra trước khi deploy

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
