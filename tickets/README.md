# Tickets Workflow

Thư mục này dùng để quản lý refactor plan theo phase và ticket nhỏ, thay vì làm refactor lớn một lần.

## Structure

- `templates/`: template chuẩn cho ticket
- `backlog/`: ticket đang chờ / đang active / đã chốt

## Usage

Mỗi refactor task lớn nên:

1. tạo phase plan
2. chia thành ticket nhỏ
3. chỉ rõ scope / out-of-scope
4. gắn validation và risk
5. update status theo tiến độ

## Naming Suggestion

- `BE-REF-001.md`
- `FE-REF-001.md`
- `X-REF-001.md`

Trong đó:

- `BE` = backend
- `FE` = frontend
- `X` = cross-cutting
- `REF` = refactor
