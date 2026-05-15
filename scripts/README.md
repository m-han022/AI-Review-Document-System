# Scripts Guide

## Canonical local dev scripts

- `start-dev.ps1`: local sync mode, safe default for day-to-day development.
- `start-dev-async.ps1`: local async mode with Redis + Celery worker expectations.
- `stop-dev.ps1`: stop local frontend/backend/worker; use `-StopRedis` to stop Docker Redis too.

## Presentation generators

- `generate_project_intro_ppt.py`: project introduction deck.
- `generate_evaluation_baseline_ppt.py`: baseline business expansion deck.
- `generate_evaluation_baseline_ppt_safe.py`: safer viewer-compatible variant of the baseline deck.
- `generate_future_business_direction_ppt.py`: full future business direction deck.
- `generate_future_business_direction_exec_ppt.py`: short executive deck.
- `generate_future_business_direction_exec_vi_ppt.py`: Vietnamese executive deck.

## Notes

- Generated `.pptx` outputs belong in the repo-level `artifacts/` directory, not under `scripts/`.
- One-off backend migration and verification helpers that are no longer part of the main workflow were moved to `backend/scripts/archive/`.
