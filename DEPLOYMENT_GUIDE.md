# Hướng dẫn deploy lên internet miễn phí

## 🎯 Phương án: Render (Backend) + Vercel (Frontend)

---

## 📦 Phần 1: Deploy Backend trên Render

### Bước 1: Tạo tài khoản Render
1. Truy cập: https://render.com
2. Sign up với GitHub account
3. Miễn phí: 750 giờ/tháng (đủ cho 1 service chạy 24/7)

### Bước 2: Push code lên GitHub
```bash
cd e:\11.PMO\AI\Project_PMO\AI-Review-Document-System
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/AI-Review-Document-System.git
git push -u origin main
```

### Bước 3: Tạo Web Service trên Render
1. Vào Render Dashboard → New → Web Service
2. Connect repository GitHub của bạn
3. Cấu hình:
   - **Name**: ai-review-document-backend
   - **Root Directory**: backend
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free

### Bước 4: Cấu hình Environment Variables
Trong Render Dashboard → Environment, thêm:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

### Bước 5: Deploy
- Render sẽ tự động build và deploy
- Bạn sẽ nhận được URL: `https://ai-review-document-backend.onrender.com`

---

## 🎨 Phần 2: Deploy Frontend trên Vercel

### Bước 1: Tạo tài khoản Vercel
1. Truy cập: https://vercel.com
2. Sign up với GitHub account
3. Miễn phí: Không giới hạn cho personal projects

### Bước 2: Import Project
1. Dashboard → New Project
2. Import repository GitHub
3. Cấu hình:
   - **Root Directory**: frontend
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: dist

### Bước 3: Cấu hình Environment Variables
Trong Vercel Dashboard → Settings → Environment Variables:
```
VITE_API_BASE_URL=https://ai-review-document-backend.onrender.com/api
```

### Bước 4: Cập nhật frontend code
Sửa file `frontend/src/api/client.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
```

### Bước 5: Deploy
- Vercel sẽ tự động build và deploy
- Bạn sẽ nhận được URL: `https://ai-review-document-system.vercel.app`

---

## 🔗 Phần 3: Kết nối Frontend và Backend

### Cập nhật CORS trong backend
Sửa file `backend/app/main.py`:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Local dev
        "https://ai-review-document-system.vercel.app",  # Production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## ✅ Kiểm tra deployment

### 1. Test Backend API
```bash
curl https://ai-review-document-backend.onrender.com/api/submissions
```

### 2. Test Frontend
Mở trình duyệt: `https://ai-review-document-system.vercel.app`

### 3. Test upload file
- Upload file PDF/PPTX
- Kiểm tra grading hoạt động
- Xem kết quả trên dashboard

---

## 🎁 Các phương án hosting free khác

### Backend (Python/FastAPI):
| Platform | Free Tier | Giới hạn |
|----------|-----------|----------|
| **Render** | 750 giờ/tháng | Sleep sau 15 phút idle |
| **Railway** | $5 credit/tháng | Giới hạn 500 giờ |
| **PythonAnywhere** | Free | 1 web app, limited |
| **Fly.io** | 3 VMs free | 256MB RAM mỗi VM |

### Frontend (React/Vite):
| Platform | Free Tier | Giới hạn |
|----------|-----------|----------|
| **Vercel** | Unlimited | 100GB bandwidth |
| **Netlify** | Unlimited | 100GB bandwidth |
| **GitHub Pages** | Unlimited | Static only |
| **Cloudflare Pages** | Unlimited | Unlimited bandwidth |

---

## 🚀 Phương án all-in-one: Railway

Nếu muốn deploy cả backend + frontend trên 1 platform:

### Railway (https://railway.app)
1. Sign up với GitHub
2. New Project → Deploy from GitHub repo
3. Thêm 2 services:
   - Backend (Python)
   - Frontend (Node.js)
4. Cấu hình environment variables
5. Auto-deploy khi push code

**Free tier**: $5 credit/tháng (~500 giờ chạy)

---

## ⚠️ Lưu ý quan trọng

### 1. Gemini API Key
- Không commit `.env` lên GitHub
- Chỉ cấu hình trong hosting platform
- Giới hạn free: 20 requests/phút

### 2. Database
- Hiện tại dùng JSON file → Sẽ mất data khi redeploy
- Giải pháp: Dùng **Supabase** (free PostgreSQL) hoặc **MongoDB Atlas** (free 512MB)

### 3. File Uploads
- Render: File lưu trong `/uploads` sẽ mất khi redeploy
- Giải pháp: Dùng **Cloudinary** hoặc **AWS S3** (free tier)

### 4. Cold Start
- Free tier sẽ sleep khi không có request
- Request đầu tiên có thể mất 30-50 giây để wake up

---

## 📊 Chi phí ước tính

| Service | Free Tier | Trả phí (nếu cần) |
|---------|-----------|-------------------|
| Render Backend | ✅ Free | $7/tháng |
| Vercel Frontend | ✅ Free | $20/tháng |
| Gemini API | ✅ Free (20 RPM) | $0.0025/1K tokens |
| Database (optional) | Supabase Free | $25/tháng |
| **TOTAL** | **$0** | **~$27/tháng** |

---

## 🎉 Kết luận

**Phương án khuyến nghị**: Render + Vercel
- ✅ 100% miễn phí
- ✅ Dễ setup
- ✅ Auto deploy từ GitHub
- ✅ SSL certificate tự động
- ✅ CDN toàn cầu

**Thời gian deploy**: ~15-20 phút cho lần đầu

**Tài liệu tham khảo**:
- Render: https://render.com/docs
- Vercel: https://vercel.com/docs
- FastAPI deployment: https://fastapi.tiangolo.com/deployment/
