# Scripts AGENTS

## Scope

Áp dụng cho `scripts/` ở repo root.

File này điều chỉnh cách quản lý dev scripts, presentation generators, và script hygiene.

## Canonical Scripts

- `start-dev.ps1`: local sync mode mặc định
- `start-dev-async.ps1`: local async mode
- `stop-dev.ps1`: stop local processes

## Presentation Generators

- `generate_project_intro_ppt.py`
- `generate_evaluation_baseline_ppt.py`
- `generate_evaluation_baseline_ppt_safe.py`
- `generate_future_business_direction_ppt.py`
- `generate_future_business_direction_exec_ppt.py`
- `generate_future_business_direction_exec_vi_ppt.py`

Generated outputs phải đi vào `artifacts/`.

## Rules

- Không thêm script mới nếu chỉ là biến thể nhỏ của script hiện có; ưu tiên thêm option/argument.
- Không để generated artifacts trong `scripts/`.
- Script mới phải ghi rõ:
  - purpose
  - input/source of truth
  - output location
- Script bị thay thế hoặc one-off nên chuyển sang `archive/` hoặc module archive tương ứng, không xóa ngay nếu chưa chắc.

## Forbidden Actions

- Không tạo script trùng chức năng khi có thể gộp.
- Không để script runtime chính phụ thuộc vào artifact/manual step không được tài liệu hóa.
- Không thêm script “debug tạm” vào flow chính của repo.
