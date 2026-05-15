# Scripts AGENTS

## Scope

Ãp dá»¥ng cho `scripts/` á»Ÿ repo root.

File nÃ y Ä‘iá»u chá»‰nh cÃ¡ch quáº£n lÃ½ dev scripts, presentation generators, vÃ  script hygiene.

## Canonical Scripts

- `dev-start-sync.ps1`: local sync mode máº·c Ä‘á»‹nh
- `dev-start-async.ps1`: local async mode
- `dev-stop.ps1`: stop local processes

## Presentation Generators

- `generate_project_intro_ppt.py`
- `generate_evaluation_baseline_ppt.py`
- `generate_evaluation_baseline_ppt_safe.py`
- `generate_future_business_direction_ppt.py`
- `generate_future_business_direction_exec_ppt.py`
- `generate_future_business_direction_exec_vi_ppt.py`

Generated outputs pháº£i Ä‘i vÃ o `artifacts/`.

## Rules

- KhÃ´ng thÃªm script má»›i náº¿u chá»‰ lÃ  biáº¿n thá»ƒ nhá» cá»§a script hiá»‡n cÃ³; Æ°u tiÃªn thÃªm option/argument.
- KhÃ´ng Ä‘á»ƒ generated artifacts trong `scripts/`.
- Script má»›i pháº£i ghi rÃµ:
  - purpose
  - input/source of truth
  - output location
- Script bá»‹ thay tháº¿ hoáº·c one-off nÃªn chuyá»ƒn sang `archive/` hoáº·c module archive tÆ°Æ¡ng á»©ng, khÃ´ng xÃ³a ngay náº¿u chÆ°a cháº¯c.

## Forbidden Actions

- KhÃ´ng táº¡o script trÃ¹ng chá»©c nÄƒng khi cÃ³ thá»ƒ gá»™p.
- KhÃ´ng Ä‘á»ƒ script runtime chÃ­nh phá»¥ thuá»™c vÃ o artifact/manual step khÃ´ng Ä‘Æ°á»£c tÃ i liá»‡u hÃ³a.
- KhÃ´ng thÃªm script â€œdebug táº¡mâ€ vÃ o flow chÃ­nh cá»§a repo.

