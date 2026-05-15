# X-REF-002 - Define Refactor Validation Matrix

## Status

- Done

## Goal

Chuan hoa validation matrix de moi ticket refactor biet phai chay gi, o dau, va residual risk la gi neu khong chay duoc.

## Scope

- backend validation categories
- frontend validation categories
- smoke flow categories
- rules cho `not run / blocked / partial`

## Out Of Scope

- them framework test moi
- mo rong coverage lon

## Current Problem

- rule validation da co o AGENTS nhung chua chuyen thanh matrix thuc thi dung lai cho tung ticket

## Target State

- co mot matrix chuan dung lai cho moi ticket refactor
- co mau ghi ket qua validation va residual risk thong nhat

## Constraints

- khong doi runtime behavior
- khong them dependency moi

## Validation Matrix

### 1) Backend-focused ticket

- Required:
- `PYTHONPATH=backend pytest <targeted tests>`
- API smoke cho endpoint bi anh huong
- Optional:
- broader pytest module/package
- Not Applicable:
- frontend build/typecheck neu write scope khong cham frontend

### 2) Frontend-focused ticket

- Required:
- `npm run build`
- Smoke manual cho man hinh bi anh huong
- Optional:
- targeted component test neu da co test file
- Not Applicable:
- backend pytest neu write scope khong cham backend

### 3) Cross-cutting ticket (BE + FE + contract wiring)

- Required:
- `PYTHONPATH=backend pytest <targeted tests>`
- `npm run build`
- smoke end-to-end path tu UI -> API -> persisted state
- Optional:
- extended backend test subset
- Not Applicable:
- none by default

### 4) Data/schema/migration-related ticket

- Required:
- migration/smoke command theo huong dan module
- targeted API tests cho path doc/ghi bi cham
- Optional:
- backfill verification script output
- Not Applicable:
- frontend smoke neu migration khong anh huong route/shape UI

## Reporting Format For Each Ticket

Khi dong ticket, phai ghi ro:

- `Executed`:
- command da chay
- ket qua pass/fail
- `Not Run`:
- command nao chua chay
- ly do
- `Residual Risk`:
- rui ro con lai do phan not-run
- `Manual Smoke`:
- danh sach thao tac da check

## Lightweight Template Snippet

- Executed:
- `...`
- Not Run:
- `...`
- Residual Risk:
- `...`
- Manual Smoke:
- `...`

## Validation

- reviewed against:
- `backend/AGENTS.md`
- `frontend/AGENTS.md`
- root `AGENTS.md` refactor workflow rules

## Risk

- matrix qua tong quat se mat tac dung
- giam risk bang cach bat buoc ghi command va residual risk theo tung ticket

## Rollback

- khong can rollback runtime (documentation-only change)

## Dependencies

- none

## Acceptance Criteria

- co validation matrix ro cho backend/frontend/cross-cutting
- co format ghi `not run` va residual risk thong nhat
- ticket co the duoc dung lai truc tiep cho cac phase tiep theo
