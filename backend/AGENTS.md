# Backend AGENTS

## Scope

Áp dụng cho toàn bộ `backend/`.

Root [AGENTS.md](/e:/workspace/AI-Review-Document-System/AGENTS.md) vẫn là source of truth cho:
- business invariants
- backward compatibility
- append-only / auditability
- refactor workflow chung

File này chỉ bổ sung rule backend-specific.

## API / Contract Rules

- Không đổi public route path, request shape, response shape nếu chưa có yêu cầu rõ.
- Không đổi behavior legacy alias routes âm thầm.
- Không đổi schema DB âm thầm.

## Page/Slide Compatibility Rules

- Runtime/UI terminology hiện tại ưu tiên `page`.
- Backward compatibility bắt buộc giữ:
  - input/output có thể chứa `slide_number` / `slide_reviews`
  - parser hỗ trợ cả `page_number` và `slide_number`
- Khi build response mới:
  - ưu tiên populate `page_number`
  - chỉ fallback `slide_number` khi dữ liệu cũ chưa migrate

## Grading Output Rules

- Text hiển thị cho user dùng `page` (không dùng `slide` cho fallback message mới).
- Không đổi contract key cũ nếu chưa có migration plan + compatibility adapter.
- GradingRun là immutable, không rewrite kết quả đã lưu.

## Layering Rules

- Router không chứa business logic dài hoặc query phức tạp.
- Router gọi service/application layer.
- Service không phụ thuộc trực tiếp HTTP framework details.
- Repository chịu trách nhiệm query/persistence retrieval.

## Contract-First Change Note (Bắt buộc)

Khi thay đổi payload hoặc mapping FE-BE, PR phải nêu:
1. old behavior
2. new behavior
3. compatibility plan
4. rollback plan

## Validation Rules

Khi backend bị ảnh hưởng, tối thiểu phải chạy hoặc nêu rõ:
- targeted `pytest`
- regression test cho API bị ảnh hưởng
- smoke test cho flow grading/audit nếu có đổi orchestration

Nếu không chạy được:
- nêu rõ test nào chưa chạy
- lý do
- residual risk

## Definition of Done (Backend)

- Contract không bị phá ngoài scope đã duyệt.
- Backward compatibility còn nguyên.
- Test/smoke tương ứng đã chạy hoặc đã nêu rõ residual risk.
