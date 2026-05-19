# Scripts AGENTS

## Scope

Áp dụng cho thư mục `scripts/` ở repo root.

File này quy định cách quản lý dev scripts, presentation generators và script hygiene.

## Canonical Scripts

- `dev-start-sync.ps1`: local sync mode (mặc định, khuyến nghị cho dev hằng ngày).
- `dev-start-async.ps1`: local async mode (cần Redis + Celery worker).
- `dev-stop.ps1`: dừng local frontend/backend/worker; dùng `-StopRedis` nếu cần dừng Redis Docker.

## Startup Verification

Sau khi chạy `dev-start-sync.ps1`, verify tối thiểu:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/health -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:8000/api/projects?limit=5&offset=0" -UseBasicParsing
```

Expected:
- `/api/health` healthy
- `/api/projects` HTTP 200

## Presentation Generators

- `generate_project_intro_ppt.py`
- `generate_evaluation_baseline_ppt.py`
- `generate_evaluation_baseline_ppt_safe.py`
- `generate_future_business_direction_ppt.py`
- `generate_future_business_direction_exec_ppt.py`
- `generate_future_business_direction_exec_vi_ppt.py`

Generated outputs phải lưu trong `artifacts/`.

## Rules

- Không thêm script mới nếu chỉ là biến thể nhỏ; ưu tiên thêm option/argument.
- Không để generated artifacts trong `scripts/`.
- Script mới phải ghi rõ:
  - purpose
  - input/source of truth
  - output location
- Script one-off hoặc đã thay thế nên chuyển sang vùng `archive/` phù hợp, không xóa ngay khi chưa chắc.

## Forbidden Actions

- Không tạo script trùng chức năng khi có thể gộp.
- Không để script runtime chính phụ thuộc bước thủ công chưa được tài liệu hóa.
- Không thêm script debug tạm vào flow chính của repo.
