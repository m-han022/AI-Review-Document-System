# Frontend AGENTS

## Scope

Áp dụng cho toàn bộ `frontend/`.

Root [AGENTS.md](/e:/workspace/AI-Review-Document-System/AGENTS.md) vẫn là source of truth cho:

- business truth
- UI truth guardrail
- anti-invention rules
- refactor workflow chung

File này chỉ bổ sung rule frontend-specific.

## Frontend Refactor Goals

- Tách presentation, view-model/state, API access, constants, and shared UI clean hơn.
- Giảm component quá lớn, khó test, khó đọc.
- Chuẩn hóa status rendering, error handling, i18n, design tokens.
- Không làm thay đổi UX behavior thực tế nếu chưa được yêu cầu rõ.

## Current Layer Intent

- `src/components/`: presentation + container components hiện tại
- `src/api/`: API client boundary
- `src/types/`: typed contracts
- `src/constants/`: UI/business display constants
- `src/locales/`: i18n resources
- `src/styles/`: design tokens / global styles

## Frontend Rules

### UI / Behavior Protection

- Không hardcode business logic mới trong component tree.
- Không thay đổi label/meaning của status nếu backend contract chưa đổi.
- Không invent analytics, confidence, risk score, recommendation nếu backend không có dữ liệu thật.
- Khi refactor UI, phải giữ nguyên data semantics hiện tại.

### Component Boundary Rules

- Component lớn nên được tách theo vai trò:
  - container/state orchestration
  - presentation
  - helper/view-model
- Không duplicate fetch/state logic ở nhiều component nếu có thể gom về hook/helper.
- Không trộn i18n mapping, formatting logic, và rendering sâu trong cùng một block lớn nếu có thể tách ra.

### API Boundary Rules

- Mọi gọi API đi qua `src/api/client.ts` hoặc abstraction tương đương.
- Không gọi fetch trực tiếp rải rác nếu module đã có client abstraction.
- Khi contract backend giữ nguyên, refactor frontend phải tiếp tục tiêu thụ shape cũ.

### i18n / Copy Rules

- Không hardcode text mới ở khu vực đã i18n nếu có thể thêm qua locale files.
- Nếu tạm thời cần text local-only để unblock, phải ghi rõ debt và follow-up.
- Không để encoding lỗi hoặc mojibake trong file mới/chỉnh sửa.

### Validation / Quality Gate

Nếu frontend bị ảnh hưởng, tối thiểu phải nêu hoặc chạy:

- `npm run build`
- typecheck nếu tách riêng
- targeted UI/test file nếu có
- smoke path cho màn hình bị ảnh hưởng

Nếu không chạy được:

- phải nêu rõ chưa chạy gì
- vì sao
- UI/regression risk còn lại

### Forbidden Actions

- Không đổi component behavior âm thầm dưới danh nghĩa “chỉ refactor”.
- Không tạo thêm biến thể styling trùng lặp nếu có thể dùng design tokens/component chung.
- Không move toàn bộ tree lớn cùng lúc nếu chưa có seam và validation đủ an toàn.

## Recommended Refactor Direction

- Ưu tiên tách các màn lớn như dashboard/audit/project view thành container + subcomponents + helpers.
- Chuẩn hóa status/error rendering ở một chỗ trước khi dọn các màn riêng lẻ.
- Cô lập API contract mapping khỏi presentation.
