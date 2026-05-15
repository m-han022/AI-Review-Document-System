# FE-REF-001 - Extract Audit Dashboard Status And Error Rendering Helpers

## Status

- Done

## Goal

Tách logic render status / error summary của audit dashboard thành helper rõ ràng để dễ test, dễ reuse, và giảm JSX condition lặp lại.

## Scope

- `frontend/src/components/workspace/AuditDashboard.tsx`
- helper / formatting logic liên quan status/error

## Out Of Scope

- đổi UX flow lớn
- đổi contract API
- refactor toàn bộ audit dashboard trong một ticket

## Current Problem

- dashboard đang chứa cả fetch/state/render/formatting trong cùng file lớn
- logic status/error hiện hữu dễ tiếp tục phình

## Target State

- status label
- status tone
- error summary
- time formatting liên quan

được tách gọn hơn khỏi JSX render phức tạp

## Constraints

- giữ nguyên behavior hiển thị
- không đổi API contract

## Implementation Notes

- ưu tiên pure helper hoặc view-model helper
- không cần tách quá nhiều component nếu ticket này chỉ nhắm status/error

## Validation

- frontend build
- typecheck
- smoke audit dashboard path
- Implemented with helper extraction in `AuditDashboard` + `auditDashboard.helpers.ts`
- `npm run build` passed on 2026-05-15
- Manual smoke still recommended for:
  - failed row short reason
  - status badge semantics
  - reviewed-at fallback display
  - failed detail panel retry button visibility

## Risk

- encoding/i18n/formatting dễ bị regression nếu sửa trực tiếp trong file lớn

## Rollback

- revert helper extraction nếu render output lệch

## Dependencies

- `X-REF-001` hữu ích nhưng không bắt buộc

## Acceptance Criteria

- logic status/error dễ tìm và tách khỏi khối render chính
- không đổi UI behavior thực tế
