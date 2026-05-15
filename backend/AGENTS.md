# Backend AGENTS

## Scope

Áp dụng cho toàn bộ `backend/`.

Root [AGENTS.md](/e:/workspace/AI-Review-Document-System/AGENTS.md) vẫn là source of truth cho:

- business invariants
- backward compatibility
- append-only / auditability
- refactor workflow chung

File này chỉ bổ sung rule backend-specific.

## Backend Refactor Goals

- Tách rõ router, application/service, repository, persistence, integration.
- Giảm coupling giữa HTTP layer và data access details.
- Dễ test hơn theo từng layer.
- Không thay đổi public API behavior nếu chưa có approval rõ.

## Current Layer Intent

- `app/routers/`: HTTP/API boundary
- `app/services/`: application/use-case/service logic
- `app/repositories/`: persistence queries/retrieval
- `app/models.py`: data contracts / persistence models / API models hiện hữu
- `app/storage.py`: facade legacy + orchestration compatibility layer

## Backend Rules

### API / Contract Protection

- Không đổi public route path, request shape, response shape nếu chưa được yêu cầu rõ.
- Không đổi behavior legacy alias routes âm thầm.
- Nếu cần thay đổi contract nội bộ, phải giữ adapter/facade để không phá flow hiện tại.

### Layering Rules

- Router không được chứa business logic dài hoặc query logic phức tạp.
- Router nên gọi service/application layer.
- Service không nên phụ thuộc trực tiếp vào framework HTTP.
- Repository chịu trách nhiệm query/persistence retrieval.
- Không đẩy logic orchestration mới vào nhiều nơi nếu có thể gom về service/facade rõ ràng.

### Persistence Rules

- Không thay đổi DB schema âm thầm.
- Không remove field legacy nếu chưa có migration path rõ.
- Không bypass audit/history rules khi refactor persistence.
- Khi cần refactor query logic, ưu tiên extract helper/query service thay vì rewrite toàn bộ model.

### Migration Rules

- Mọi thay đổi schema phải có migration hoặc nêu rõ vì sao chưa cần migration.
- Mọi thay đổi liên quan version/history phải chỉ ra backward compatibility impact.
- Không thực hiện destructive migration nếu chưa có approval rõ.

### Testing / Validation

Nếu backend bị ảnh hưởng, tối thiểu phải nêu hoặc chạy:

- targeted `pytest`
- regression tests cho API bị ảnh hưởng
- smoke test cho flow runtime nếu có thay đổi orchestration
- nếu thay đổi query/latest-state logic: test stale/pending/failed/completed cases

Nếu không chạy được:

- phải nêu rõ test nào chưa chạy
- vì sao chưa chạy được
- residual risk là gì

### Forbidden Actions

- Không nhét logic mới vào router chỉ để sửa nhanh.
- Không thêm dependency mới nếu có thể giải quyết trong stack hiện tại.
- Không đổi schema/model/API cùng lúc trong một phase lớn nếu chưa có rollback path.
- Không xóa compatibility code nếu chưa chứng minh không còn caller sử dụng.

## Recommended Refactor Direction

- Ưu tiên strangler pattern cho `storage.py` và các flow legacy.
- Tách dần logic chọn latest run, grading orchestration, export logic, evaluation resolution thành đơn vị nhỏ hơn.
- Giữ một compatibility facade trong giai đoạn chuyển tiếp.
