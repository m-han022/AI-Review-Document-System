# Phase 2 - Boundary Refactor And Section Splits

## Goal

Thuc hien refactor theo boundary da chot o `X-REF-003`.
Phase 2 tap trung vao viec tach tiep cac seam da co, nhung van giu nguyen behavior va contract hien tai.

## Scope

- backend: read-model extraction va run projection seam
- frontend: split man hinh workspace theo section responsibility
- cross-cutting: chuan hoa convention helper/view-model + cap nhat checklist

## Out Of Scope

- doi API contract
- doi DB schema
- redesign UX
- rewrite lon mot lan

## Ticket Set

1. `P2-BE-001` - Extract read-model helpers from `storage.py` (summary/detail cluster)
2. `P2-FE-001` - Split `AuditDashboard` into section-level components
3. `P2-FE-002` - Split `OperationalScreens` into route-focused presentational components
4. `P2-BE-002` - Consolidate grading-run projection and serialization seam
5. `P2-X-001` - Normalize helper conventions and update docs/checklists

## Execution Order

- Start: `P2-BE-001`
- Then: `P2-FE-001` and `P2-FE-002` (can be parallel if write scope does not overlap)
- Then: `P2-BE-002`
- Finish: `P2-X-001`

## Guardrails

- only touch files declared in each ticket scope
- no public API/request/response changes
- no schema changes
- keep status semantics unchanged
- apply validation matrix from `X-REF-002`

## Exit Criteria

- at least 3 phase-2 tickets completed with validation evidence
- no behavior regression in key project/audit/workspace flows
- conventions doc/checklist updated for next phase

## Risks

- over-splitting without reducing coupling
- accidental behavior drift while splitting large components
- storage refactor bleeding into unrelated legacy paths

## Validation

- per-ticket validation required
- track `Executed`, `Not Run`, and `Residual Risk` per ticket
