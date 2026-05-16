# Frontend AGENTS

## Scope

Áp dụng cho toàn bộ `frontend/`.

## Terminology Rules

- UI text chuẩn dùng `page` / `trang`.
- Không đổi key API/compatibility cũ chỉ để rename (`slide_*` có thể tồn tại nội bộ).
- Khi render dữ liệu review: ưu tiên `page_number`, fallback `slide_number`.

## i18n Rules

- Không hardcode text ở component nếu đã có locale key.
- Khi thêm key mới: thêm đồng thời `vi`, `en`, `ja`.
- Không để key used-by-code bị thiếu locale.
- Không merge nếu `Used keys missing in locales > 0`.

## Encoding Rules

- Tất cả file text phải UTF-8.
- Không dùng replace thô trên file locale/constants dễ gây mojibake.
- Khi chỉnh JSON locale: parse JSON -> update field -> write UTF-8.

## Contract-First Change Note (Bắt buộc)

Khi thay đổi dữ liệu hiển thị liên quan backend payload, PR phải nêu:
1. old behavior
2. new behavior
3. compatibility plan
4. rollback plan

## Validation Gate

Trước merge/release phải pass:
- `npm run build`
- `npm run check:i18n`

Nếu fail gate: không merge.

## Definition of Done (Frontend)

- Gate pass 100%.
- Không có mojibake.
- Không thiếu locale key.
- Không đổi behavior ngoài scope đã nêu.
