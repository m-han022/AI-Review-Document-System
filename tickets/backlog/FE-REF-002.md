# FE-REF-002 - Split Large Workspace Screens By Responsibility

## Status

- Done

## Goal

Xac dinh va tach cac man workspace lon thanh sub-sections hoac helper/view-model ro trach nhiem hon, bat dau tu cac seam it rui ro.

## Scope

- `workspace/OperationalScreens.tsx`
- `workspace/AuditDashboard.tsx`
- helper/view-model extraction neu phu hop

## Out Of Scope

- redesign UI
- doi route behavior
- doi data source

## Current Problem

- cac man workspace lon dang tron:
- fetch state
- derived metrics
- rendering layout
- formatting logic

## Target State

- moi man co boundary ro hon giua:
- state/data orchestration
- metrics derivation
- presentational sections

## Constraints

- giu nguyen UI semantics
- khong invent analytics moi

## Implementation Notes

- chon seam nho truoc
- uu tien extract section/component khong chong write scope voi ticket khac

## Validation

- frontend build
- typecheck
- smoke screens lien quan
- Extracted helper module:
- `frontend/src/components/workspace/operationalScreens.helpers.ts`
- Rewired `OperationalScreens.tsx` to use:
- `buildOperationalMetrics`
- `buildLatestRows`
- `hasReviewedScore`
- `npm run build` passed on 2026-05-15

## Risk

- component split qua som co the chi doi cau truc ma chua giam complexity that

## Rollback

- revert extraction theo section neu integration kho doc hon

## Dependencies

- `FE-REF-001` co the lam truoc de tao seam nho

## Acceptance Criteria

- it nhat mot man workspace lon duoc tach nho hon theo responsibility ro rang
- khong doi behavior/user flow
