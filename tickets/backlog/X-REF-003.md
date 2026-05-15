# X-REF-003 - Define Phase 2 Candidate Boundaries

## Status

- Done

## Goal

Chot boundary cho phase 2 de tranh refactor lan man sau khi phase 1 da hoan thanh cac seam low-risk.

## Scope

- backend candidate boundaries
- frontend candidate boundaries
- sequencing proposal cho phase 2

## Out Of Scope

- implement phase 2 runtime
- doi business flow
- doi public API

## Current Input (From Phase 1)

- `BE-REF-001`: latest-run selection da duoc gom ve repository seam
- `BE-REF-002`: storage summary formatting da duoc extract helper
- `FE-REF-001`: AuditDashboard status/error rendering da duoc tach helper
- `FE-REF-002`: OperationalScreens metrics/latest-row derivation da duoc tach helper
- `X-REF-002`: validation matrix da co va tai su dung duoc

## Phase 2 Boundary Map

### Backend Boundary (P2-BE)

- In scope:
- continue strangler pattern cho `storage.py`
- extract nhom query/read-model logic ra repository/service helpers
- giam duplicate conversion logic (run/doc/version summary)
- Out of scope:
- bo `storage.py` hoan toan
- doi response contract
- doi DB schema

### Frontend Boundary (P2-FE)

- In scope:
- tach tiep `AuditDashboard` theo section boundary
- tach presentation sections trong `OperationalScreens` thanh subcomponents
- giu API boundary o `src/api/client.ts`
- Out of scope:
- redesign UX
- doi route behavior
- invent analytics moi

### Cross-cutting Boundary (P2-X)

- In scope:
- chuan hoa naming + placement cho helper/view-model modules
- cap nhat docs/tickets workflow theo ket qua phase 2
- Out of scope:
- thiet ke lai toan bo folder tree trong 1 lan

## Proposed Sequencing For Phase 2

1. P2-BE-001: Extract read-model helpers from `storage.py` (summary/detail cluster)
2. P2-FE-001: Split `AuditDashboard` into section-level components
3. P2-FE-002: Split `OperationalScreens` into route-focused presentational components
4. P2-BE-002: Consolidate grading-run projection/serialization seam
5. P2-X-001: Normalize helper conventions + update docs/checklists

## Why This Sequence

- backend step 1 giam risk data-shape drift truoc khi frontend split lon hon
- frontend splits duoc tiep tuc tren seam da tao tu phase 1
- cross-cutting cleanup de sau cung de tranh block implement

## Guardrails For Phase 2

- moi ticket chi duoc cham write scope da khai bao
- khong doi public API/request/response shape
- khong doi status semantics (`PENDING/EXTRACTING/GRADING/COMPLETED/FAILED`)
- moi ticket phai dung validation matrix tu `X-REF-002`
- neu co `Not Run`, bat buoc ghi `Residual Risk`

## Validation

- review cheo voi:
- `PHASE1.md` exit criteria
- `X-REF-002` validation matrix
- root/module AGENTS rules

## Risk

- boundary qua rong se lam phase 2 mat kiem soat
- giam risk bang ticket scope nho va sequencing theo seam co san

## Rollback

- phase planning level: revise boundary doc truoc khi bat dau implement phase 2
- ticket level: rollback theo ticket plan, khong rollback hang loat

## Dependencies

- `X-REF-001`
- `X-REF-002`
- `BE-REF-001`
- `BE-REF-002`
- `FE-REF-001`
- `FE-REF-002`

## Acceptance Criteria

- co boundary map ro cho backend/frontend/cross-cutting
- co sequencing proposal phase 2 kha thi
- co guardrail de ngan refactor vuot scope
