# DEPLOY_PRODUCTION.md

Hướng dẫn triển khai production cho dự án này:
- Backend API: Render Web Service
- Background jobs: Render Background Worker (Celery)
- Frontend: Vercel
- Database: PostgreSQL (production)
- Broker: Redis (Render Redis / Upstash Redis)

## 1. Kiến trúc triển khai

1. Frontend (Vercel) gọi API backend trên Render.
2. Backend nhận request review, tạo GradingRun status `PENDING`.
3. Backend enqueue task vào Redis.
4. Celery Worker trên Render xử lý task (`EXTRACTING -> GRADING -> COMPLETED/FAILED`).
5. Kết quả lưu về PostgreSQL.

## 2. Chuẩn bị biến môi trường

### 2.1 Backend API (Render Web Service)

Bắt buộc:
- `DATABASE_URL=<postgres-production-url>`
- `USE_CELERY=true`
- `CELERY_BROKER_URL=<redis-url>`
- `CELERY_RESULT_BACKEND=<redis-url>` (nếu dùng backend kết quả)
- `GEMINI_API_KEY=<your_key>`

Khuyến nghị:
- `PYTHONUNBUFFERED=1`

### 2.2 Worker (Render Background Worker)

Dùng cùng bộ env với backend API:
- `DATABASE_URL`
- `USE_CELERY=true`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `GEMINI_API_KEY`

### 2.3 Frontend (Vercel)

- `VITE_API_BASE_URL=https://<your-render-backend>.onrender.com`

## 3. Deploy Backend API lên Render

1. Render Dashboard -> `New` -> `Web Service`.
2. Kết nối repo GitHub.
3. Root Directory: `backend`.
4. Build Command:

```bash
pip install -r requirements.txt
```

5. Start Command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

6. Khai báo env vars (mục 2.1).
7. Deploy.

## 4. Deploy Worker lên Render

1. Render Dashboard -> `New` -> `Background Worker`.
2. Chọn cùng repo, Root Directory: `backend`.
3. Build Command:

```bash
pip install -r requirements.txt
```

4. Start Command (điều chỉnh đúng module Celery app nếu khác):

```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

5. Khai báo env vars giống backend API.
6. Deploy và kiểm tra log worker đã sẵn sàng nhận task.

## 5. Redis/Broker

Nếu workspace Render không thấy mục Redis:
- Dùng Redis ngoài (Upstash/Redis Cloud/Railway Redis).
- Lấy Redis URL và gán vào:
  - `CELERY_BROKER_URL`
  - `CELERY_RESULT_BACKEND`

## 6. Deploy Frontend lên Vercel

1. Vercel -> Import Project từ repo.
2. Root Directory: `frontend`.
3. Build command: mặc định Vite hoặc `npm run build`.
4. Set env:

```bash
VITE_API_BASE_URL=https://<your-render-backend>.onrender.com
```

5. Deploy.

## 7. Verify sau deploy

### 7.1 API health

Truy cập:
- `https://<your-render-backend>.onrender.com/api/health`

Kỳ vọng: phản hồi thành công.

### 7.2 Async flow

1. Từ UI, chạy review một tài liệu.
2. Kỳ vọng:
   - Response nhanh với status `PENDING`.
   - Sau đó tiến tới `EXTRACTING`, `GRADING`, `COMPLETED` (hoặc `FAILED` có lỗi rõ).
3. Kiểm tra logs:
   - API log: enqueue task.
   - Worker log: nhận và xử lý task.

### 7.3 Frontend

Xác nhận frontend đang gọi đúng backend production (Network tab, API URL).

## 8. Lỗi thường gặp

1. Job đứng `PENDING` mãi:
- Worker chưa chạy.
- Sai `CELERY_BROKER_URL`.
- Sai `celery -A ...` module.

2. Frontend không ra dữ liệu:
- `VITE_API_BASE_URL` sai hoặc chưa redeploy.

3. API chạy được nhưng worker lỗi:
- Thiếu env trong Worker (`DATABASE_URL`, `GEMINI_API_KEY`, ...).

4. Lỗi CORS:
- Backend chưa whitelist domain Vercel.

## 9. Chính sách môi trường

- Dev/local: dùng SQLite.
- Production: bắt buộc PostgreSQL.
- Không để production fallback về SQLite.

## 10. Checklist go-live

- [ ] Backend API deploy thành công trên Render.
- [ ] Worker deploy thành công trên Render.
- [ ] Redis broker kết nối OK.
- [ ] `USE_CELERY=true` trên API và Worker.
- [ ] `DATABASE_URL` trỏ PostgreSQL production.
- [ ] Vercel `VITE_API_BASE_URL` trỏ đúng backend Render.
- [ ] Review trả `PENDING` và hoàn tất bất đồng bộ.

