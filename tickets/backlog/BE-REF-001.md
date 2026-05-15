# BE-REF-001 - Extract Latest Run Resolution Into One Backend Resolver

## Status

- Done

## Goal

Chuẩn hóa logic chọn `latest grading run` về một điểm trung tâm để tránh lặp logic ở nhiều query path và giảm regression tương tự case stale `PENDING/FAILED`.

## Scope

- các helper/query path chọn latest run theo submission/document/version
- repository/service/facade liên quan

## Out Of Scope

- đổi shape API
- đổi schema DB
- đổi semantics status lifecycle

## Current Problem

- logic latest run dễ bị phân tán giữa repository, storage, summary/detail path
- bug trước đó cho thấy chỉ cần lệch tiêu chí chọn latest là UI và API sẽ mâu thuẫn

## Target State

- có một resolver/helper backend trung tâm cho latest run
- các path summary/detail dùng cùng một source logic

## Constraints

- giữ nguyên public API
- giữ nguyên behavior hiện tại sau fix

## Implementation Notes

- ưu tiên extract helper/query service nhỏ
- không rewrite toàn bộ `storage.py` trong ticket này

## Validation

- targeted pytest cho latest run selection
- smoke API cho project summary/detail/document summary
- Implemented repository seam:
  - `get_latest_run_for_submission`
  - `get_latest_run_for_document_version`
- `storage.py` now delegates latest-run selection to repository seam
- `PYTHONPATH=backend pytest backend/tests/test_latest_run_selection.py -q` passed on 2026-05-15

## Risk

- chạm nhầm các path legacy đang dựa vào logic cũ

## Rollback

- revert resolver extraction và quay lại helper cũ nếu regression xuất hiện

## Dependencies

- `X-REF-001` nên có trước hoặc song song

## Acceptance Criteria

- logic latest run không còn duplicate nguy hiểm ở các path chính
- test stale/pending/completed/failed vẫn pass
