# BE-REF-002 - Reduce Responsibility Overlap In storage.py

## Status

- Done

## Goal

Giam chong lan trach nhiem trong `backend/app/storage.py` bang cach tach nhom logic thuan ra khoi facade compatibility layer.

## Scope

- `storage.py`
- cac helper/query logic thuan co the extract an toan

## Out Of Scope

- xoa `storage.py`
- doi toan bo call site
- refactor toan bo backend layering trong mot ticket

## Current Problem

- `storage.py` dang dong nhieu vai:
- facade legacy
- orchestration
- formatting output
- query helper

## Target State

- `storage.py` gon hon
- cac helper/query/formatting thuan duoc tach ra thanh don vi nho hon

## Constraints

- giu API behavior
- giu compatibility hien tai

## Implementation Notes

- uu tien extract pure helper truoc
- khong move nhieu call sites trong mot lan

## Validation

- targeted pytest cho project summary/detail/document summary
- smoke flow cac endpoint chinh dang dung `store`
- Extracted pure helpers in `storage.py`:
- `_latest_score_from_run_out`
- `_latest_status_lower`
- `_latest_error_message`
- Rewired summary paths to use shared helpers:
- `list_projects_summary`
- `list_documents_summary`
- `list_versions_by_document`
- `PYTHONPATH=backend pytest backend/tests/test_latest_run_selection.py -q` passed on 2026-05-15

## Risk

- facade legacy co nhieu dependency ngam

## Rollback

- revert extraction tung helper neu call chain phat sinh regression

## Dependencies

- `X-REF-001`
- nen lam sau hoac cung voi `BE-REF-001`

## Acceptance Criteria

- giam it nhat mot nhom responsibility khoi `storage.py`
- khong doi public response contract
