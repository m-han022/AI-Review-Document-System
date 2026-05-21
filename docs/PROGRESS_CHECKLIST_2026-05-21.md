# Progress Checklist (Saved)

Updated: 2026-05-21

Legend: [x]=Done, [~]=In Progress, [ ]=Pending, [d]=Deferred, [c]=Cancelled

## Completed

- [x] Fix `dev-stop.ps1` stop behavior and `-StopRedis` handling.
- [x] Review/update `dev-start-async.ps1` flow and messaging.
- [x] Add delete action in Quality Report list UI.
- [x] Optimize double-click selection/loading behavior in grading detail.
- [x] Fix i18n missing keys and pass `check:i18n`.
- [x] Fix CI backend test command (`python -m pytest`) and ensure pytest dependency.
- [x] Harden grading persistence: invalid AI output (missing criteria) is rejected.
- [x] Restore score/criteria display behavior in UI and related flow checks.
- [x] Extend upload support to `.txt`, `.xlsx`, `.png` (plus `.jpg/.jpeg`).
- [x] Update backend extraction and multimodal routing for new file types.
- [x] Update frontend upload accept list and validation copy for new file types.
- [x] Add backend regression test for extended upload file types.
- [x] Run full backend core flow tests successfully (`test_core_flows.py`).
- [x] Resolve mojibake incident in locales and restore clean locale files.
- [x] Confirm frontend gates pass: `npm run check:i18n`, `npm run build`.
- [x] Add frontend gate helper script: `scripts/frontend-gate.ps1`.
- [x] Update governance rules in `AGENTS.md` and `frontend/AGENTS.md` for UTF-8 no BOM policy.

## Current Quality Gate Status

- [x] Backend tests: PASS (`pytest -q`)
- [x] Frontend i18n gate: PASS (`npm run check:i18n`)
- [x] Frontend build gate: PASS (`npm run build`)

## Risk Register / Priority Backlog (New)

### Critical

- [x] Data integrity gap từng xảy ra: `COMPLETED` nhưng thiếu `criteria_results`.
- [x] Enforce invariant cứng: chỉ được set `COMPLETED` khi `criteria_scores` hợp lệ và insert đủ `GradingCriteriaResult`.
- [x] Thêm transaction-level/DB-level guard để reject `COMPLETED` giả. (đã thêm guarded `COMPLETED` update với `EXISTS(criteria_results)` trong transaction)
Note: `backend/app/services/grading_service.py`, `backend/app/storage.py`.

### High

- [x] Centralize async readiness preflight trong service layer để mọi entrypoint chấm dùng cùng guard.
- [x] Chuẩn hóa error code cho runtime unavailable để frontend map chính xác.
Note: `backend/app/routers/grading.py` (+ service layer tương ứng).

- [x] Chuẩn hóa error taxonomy cho AI-contract/persist/runtime/timeout:
  - `FAILED_INVALID_AI_RESPONSE`
  - `FAILED_PERSIST_CRITERIA`
  - `FAILED_RUNTIME_UNAVAILABLE`
  - `FAILED_TIMEOUT`
- [x] Expose mã lỗi rõ trong API response + audit list.
Note: `frontend/src/api/client.ts`, `frontend/src/components/workspace/AuditDashboard.tsx`.

- [x] Bổ sung test regression bắt buộc cho invariant hậu điều kiện:
  - invalid criteria => không `COMPLETED`
  - `COMPLETED` => `criteria rows > 0`
Note: `backend/tests/*` (ưu tiên `backend/tests/test_core_flows.py`).

### Medium

- [x] Gom fallback UX về helper chung `runDataHealth` để dùng nhất quán giữa màn.
- [ ] Chuẩn hóa messaging cho `FAILED` vs `COMPLETED` inconsistent data.
Note: `frontend/src/components/project/ProjectCard.tsx`, `frontend/src/components/project/ProjectCriteriaTab.tsx`.

- [x] Tăng observability pipeline AI -> parse/normalize -> persist:
  - parse fail counter
  - normalize fallback counter
  - persist criteria fail counter
- [x] Thêm alert khi có `completed giả` hoặc tỷ lệ invalid AI tăng.
Note: metrics router/service.

- [ ] Thêm preflight script cho dev async môi trường host:
  - ExecutionPolicy check
  - Docker daemon check
  - ports check
  - worker ping
- [ ] In checklist tự khắc phục.
Note: `scripts/dev-start-async.ps1`, `scripts/dev-stop.ps1`.

### Low

- [x] Pin test dependency `pytest` trong `backend/requirements.txt`.
- [x] Dùng `python -m pytest` trong CI quality gate.
- [ ] Theo dõi thêm nhu cầu tách `dev-requirements.txt` khi pipeline mở rộng.

## Deployment Priority (Execution Order)

- [x] P1: Khóa invariant `COMPLETED => criteria persisted`. (runtime/service guard + transaction guarded update đã hoàn tất)
- [x] P2: Chuẩn hóa error taxonomy + API mapping frontend/backend.
- [x] P3: Bổ sung regression tests bắt buộc cho pipeline parse->persist.
- [x] P4: Tăng observability pipeline AI->persist.

## Remaining / Next Time

- [ ] Monitor remote CI workflow after push for sustained green state.
- [ ] Optional: add `.gitattributes` rule for stronger text encoding consistency.
- [ ] Optional: add automated BOM detection step in CI pipeline.

## Resume Notes

- Preferred frontend pre-merge gate command:
  - `./scripts/frontend-gate.ps1`
- Local dev recommended mode:
  - `./scripts/dev-start-sync.ps1`
- Stop local services:
  - `./scripts/dev-stop.ps1`


## Multi-Format Upload Expansion (Consolidated)

### Objective

- Extend upload support for `.txt`, `.xlsx`, `.png` without breaking architecture `Project -> Document -> Version -> GradingRun` and keep backward compatibility.

### Workstream Status (Current)

1. Ingest plugin parser (keep existing upload contract)
- [x] Keep current upload API/flow (no contract break).
- [x] `txt_parser` implemented (UTF-8 read with controlled fallback).
- [x] `xlsx_parser` implemented (sheet/row/cell bounded extraction).
- [~] `image_parser` implemented with multimodal image payload; OCR best-effort + confidence threshold + status logging ?? c?, alerting policy c?n pending.
- [x] Dispatcher integration completed in existing parser service (no flow rewrite).

2. Versioning/audit model integrity
- [x] Append-only rule preserved (new upload => new `DocumentVersion`).
- [x] `content_hash` / `binary_hash` applied consistently for new file types.
- [x] `GradingRun` remains linked to `document_version_id`.

3. Extract output normalization for grading engine
- [x] Unified `extracted_text` contract for txt/xlsx/png.
- [x] Optional multimodal payload preserved for image path.
- [x] No grading contract break.

4. Upload validation hardening
- [x] Allow-list updated: `.pdf`, `.pptx`, `.txt`, `.xlsx`, `.png` (and `.jpg/.jpeg` currently supported).
- [x] MIME/ext mismatch guard added.
- [x] Per-type max-size guard added.
- [x] Processing timeout guard added by file type.
- [ ] `.ppt` extension support decision pending (currently not enabled in upload allow-list).

5. Evidence/preview handling
- [x] Added `preview_status` contract with `UNSUPPORTED_PREVIEW` fallback path.
- [x] UI fallback now uses metadata status instead of scattered extension-only checks.
- [d] Dedicated viewers for txt/xlsx/png deferred (fallback download/metadata accepted in current scope).

6. Cache/signature compatibility
- [x] Existing cache signature keys retained.
- [x] New file types follow same hash compatibility path.
- [d] Evaluate optional `source_mime` metadata field + safe migration only if operationally needed (deferred).

7. Frontend alignment
- [x] Upload accept list updated for new formats.
- [x] Upload messaging/i18n updated (no pdf/ppt-only hardcode in validation text).
- [x] Frontend gates pass (`check:i18n`, `build`).

8. Testing & regression lock
- [x] Backend tests cover upload acceptance for `.txt/.xlsx/.png`.
- [x] Backend tests cover MIME mismatch + oversize rejection.
- [x] Core flow tests currently pass on targeted suites.
- [ ] Add integration tests for OCR-mocked pipeline behavior once OCR policy is introduced.

### Phase Rollout Progress

- [x] Phase 1 (.txt): baseline + hardening complete.
- [x] Phase 2 (.xlsx): baseline + limits/timeout hardening complete.
- [~] Phase 3 (.png + OCR): baseline image path complete; OCR threshold/metrics ?? c?; alerting policy pending.
- [c] Feature flags per phase (`txt`, `xlsx`, `png_ocr`) CANCELLED by decision (2026-05-21: keep always-on support; no toggle).

### Risk Controls (Current)

- [~] OCR/png noise: size guard done; confidence heuristic + OCR status log added; strict confidence threshold added in parser (2026-05-21); alerting policy pending.
- [x] XLSX large input: sheet/row/cell bounds + timeout guard done.
- [~] TXT encoding: UTF-8 controlled fallback done; fallback telemetry pending.

### Next High-Value Actions

- [c] Implement phase feature flags for fast rollback. CANCELLED by current decision: always-on.
- [~] Introduce OCR policy (confidence threshold + low-confidence fallback + metrics). (2026-05-21: metrics + status logging done; strict threshold policy added (alerting policy still pending))
- [x] Add observability counters for parser fallback/timeouts by file type. (2026-05-21: ingest validation/timeout + OCR status counters wired)
- [x] Resolved celery idempotent retry regression after COMPLETED invariant hardening (2026-05-21: set run status COMPLETED before commit once criteria persistence passes).



## Execution Board (Week Plan)

### Week 1 (Stabilize Core Reliability)

- [x] P1 invariant hardening: runtime guard + transaction guarded update done.
- [x] P2 error taxonomy + FE/BE mapping (`FAILED_INVALID_AI_RESPONSE`, `FAILED_PERSIST_CRITERIA`, `FAILED_RUNTIME_UNAVAILABLE`, `FAILED_TIMEOUT`).
- [x] P3 regression tests for post-condition (`COMPLETED => criteria_rows > 0`) across API/query paths.
- [x] Async readiness preflight centralization in service layer for all grading entrypoints.

### Week 2 (Operational Visibility & UX Consistency)

- [~] Alerting policy for OCR low-confidence / invalid AI rate / ingest timeout anomalies. (invalid AI + persist alerts done; OCR-specific threshold action pending)
- [x] runDataHealth helper unification for UI fallback + messaging consistency.
- [d] Dedicated viewers for txt/xlsx/png (only if scope expands beyond fallback UX).
- [d] Optional `source_mime` metadata field + migration (only if audit requirement emerges).

### Closed by Decision

- [c] Phase feature flags (`txt`, `xlsx`, `png_ocr`) cancelled (always-on support accepted).
