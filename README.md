# AI Review Document System

## ðŸš€ Overview

Há»‡ thá»‘ng AI Review TÃ i Liá»‡u cho phÃ©p:

* Upload tÃ i liá»‡u (`PDF`, `PPTX`)
* Tá»± Ä‘á»™ng trÃ­ch xuáº¥t ná»™i dung
* Cháº¥m Ä‘iá»ƒm báº±ng AI (Google Gemini) qua Background Worker (Celery)
* Quáº£n lÃ½ nhiá»u tÃ i liá»‡u trong cÃ¹ng má»™t project
* LÆ°u lá»‹ch sá»­ version cá»§a tÃ i liá»‡u (Immutable/Append-only)
* So sÃ¡nh káº¿t quáº£ giá»¯a cÃ¡c phiÃªn báº£n

---

# ðŸ—ï¸ Architecture

```text
Project (Submission)
  â†’ Document
      â†’ Document Version
          â†’ Grading Run (Status: PENDING -> EXTRACTING -> GRADING -> COMPLETED/FAILED)
```

### NguyÃªn táº¯c cá»‘t lÃµi:
* **KhÃ´ng overwrite**: Má»i thay Ä‘á»•i ná»™i dung Ä‘á»u táº¡o Version má»›i.
* **Auditability**: Má»i láº§n cháº¥m Ä‘iá»ƒm Ä‘á»u Ä‘Æ°á»£c lÆ°u láº¡i thÃ nh má»™t Grading Run Ä‘á»™c láº­p.
* **Decoupling**: API nháº­n request, Worker thá»±c hiá»‡n cháº¥m Ä‘iá»ƒm.

### Upload & Project Rules
* **Project lÃ  master data**: pháº£i táº¡o project trÆ°á»›c khi upload.
* **Upload pháº£i chá»n project cÃ³ sáºµn**: khÃ´ng auto-create project ngáº§m tá»« filename.
* **Äá»‹nh dáº¡ng file báº¯t buá»™c**: Filename pháº£i khá»›p pattern `P\d+[-_].+` (VÃ­ dá»¥: `P001-ProjectName.pdf`).
* **Validation báº¯t buá»™c**: project_id parse tá»« filename (pháº§n `Pxxx`) pháº£i khá»›p project_id Ä‘Ã£ chá»n trÃªn UI.
* **project_description** lÃ  metadata project, khÃ´ng thay tháº¿ ná»™i dung tÃ i liá»‡u.
* **TÃ¡i sá»­ dá»¥ng ná»™i dung**: Há»‡ thá»‘ng dÃ¹ng binary hash Ä‘á»ƒ bá» qua trÃ­ch xuáº¥t text náº¿u cÃ¹ng má»™t file Ä‘Æ°á»£c upload láº¡i.

---

# ðŸ› ï¸ Modes of Operation

Há»‡ thá»‘ng há»— trá»£ 2 cháº¿ Ä‘á»™ cháº¡y chÃ­nh:

### 1. Dev Mode (Máº·c Ä‘á»‹nh)
PhÃ¹ há»£p cho phÃ¡t triá»ƒn local, gá»n nháº¹.
* **Database**: SQLite
* **Task Processing**: Synchronous (API xá»­ lÃ½ trá»±c tiáº¿p)
* **Storage**: Local filesystem

### 2. Production-like Mode
PhÃ¹ há»£p cho mÃ´i trÆ°á»ng tháº­t hoáº·c staging.
* **Database**: PostgreSQL (qua Docker)
* **Task Processing**: Asynchronous (Redis + Celery Worker)
* **Storage**: Docker Volumes

---

# âš™ï¸ Configuration (Environment Variables)

### Backend (`backend/.env`)

| Variable | Dev Value | Production Value | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | `your_key` | `your_key` | Google Gemini API Key |
| `DATABASE_URL` | (trá»‘ng) | `postgresql+psycopg2://...` | Connection string |
| `USE_CELERY` | `false` | `true` | Báº­t/táº¯t background worker |
| `CELERY_BROKER_URL` | `redis://...` | `redis://...` | Redis broker |
| `CELERY_RESULT_BACKEND` | `redis://...` | `redis://...` | Redis backend |

---

# ðŸš€ Running the System

### 1. Development Mode

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --reload-dir app --reload-exclude "data/*" --reload-exclude "uploads/*"

# Frontend
cd frontend
npm install
npm run dev
```

### Local Dev Scripts (Recommended on Windows)

For local development, prefer the repo scripts instead of enabling Celery by default.

#### Sync local mode (safe default)

```powershell
cd e:\workspace\AI-Review-Document-System
.\scripts\dev-start-sync.ps1
```

- Forces `USE_CELERY=false` for the local backend process.
- Prevents orphaned `PENDING` grading runs when Redis / Celery worker are not running.
- Recommended for normal UI/API development.

#### Async local mode (explicit)

```powershell
cd e:\workspace\AI-Review-Document-System
.\scripts\dev-start-async.ps1
```

- Starts local frontend/backend in async mode.
- Expects Redis on `localhost:6379`.
- If Redis is missing and Docker is available, the script starts the `redis` service from `docker-compose.yml`.
- Also starts a local Celery worker process.

#### Stop local processes

```powershell
.\scripts\dev-stop.ps1
```

To stop Redis started through Docker as well:

```powershell
.\scripts\dev-stop.ps1 -StopRedis
```

### 2. Production-like Mode (Docker)

```bash
# Khá»Ÿi Ä‘á»™ng toÃ n bá»™ stack (DB, Redis, Backend, Worker)
docker-compose up -d --build
```

### 3. Database Management

```bash
# Táº¡o migration má»›i
cd backend
alembic revision --autogenerate -m "description"

# Update database lÃªn báº£n má»›i nháº¥t
alembic upgrade head

# Migrate dá»¯ liá»‡u tá»« SQLite sang PostgreSQL
python backend/scripts/migrate_sqlite_to_postgres.py
```

### 4. Running Worker manually (náº¿u khÃ´ng dÃ¹ng Docker)

```bash
cd backend
celery -A app.celery_app worker --loglevel=info --pool=solo
```

---

# ðŸ§ª Testing

```bash
# Cháº¡y toÃ n bá»™ test suite
cd backend
$env:PYTHONPATH="."
pytest
```

## Evaluation Bundle V2 Cutover Gate (Phase 4)

```powershell
cd backend
$env:PYTHONPATH='.'

# 1) Migration hardening audit (dry-run)
python scripts/evaluation_bundle_v2_migration_hardening.py --output artifacts/evaluation_bundle_v2_migration_report.pre_cutover.json

# 2) Parity report (all active scopes)
python scripts/evaluation_bundle_v2_parity_report.py --all-active-scopes --output artifacts/evaluation_bundle_v2_parity_report.pre_cutover.json

# 3) Go/No-Go gate
python scripts/evaluation_bundle_v2_pre_cutover_gate.py `
  --migration-report artifacts/evaluation_bundle_v2_migration_report.pre_cutover.json `
  --parity-report artifacts/evaluation_bundle_v2_parity_report.pre_cutover.json
```

Expected:
- Gate must return `"PASS"`.
- `mismatched = 0`.
- `active_scope_violations = 0`.

## Official Operation (Local/Internal)

Source of truth: pháº§n "Official Operation (Local/Internal)" trong chÃ­nh `README.md` nÃ y.

Mandatory before internal operation/demo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-verify-v2.ps1
```

Rule:
- Only operate when result is `PASS`.

Go/No-Go criteria (mandatory):
- `mismatched = 0` in parity report.
- `invalid_status_count = 0` in migration hardening report.
- `active_scope_violations = 0` in migration hardening report.

---

# ðŸŒ API (High-level)

* `GET /projects`: Danh sÃ¡ch dá»± Ã¡n
* `POST /api/upload`: Upload tÃ i liá»‡u má»›i (táº¡o Version má»›i)
* `POST /api/grade`: Báº¯t Ä‘áº§u cháº¥m Ä‘iá»ƒm (Náº¿u dÃ¹ng Celery sáº½ tráº£ vá» PENDING ngay)
* `GET /versions/{id}/gradings`: Láº¥y lá»‹ch sá»­ cháº¥m Ä‘iá»ƒm
* `GET /api/audit/export`: Export danh sÃ¡ch audit run (CSV, read-only)
* `GET /api/documents/{document_id}/versions/diff/export`: Export version diff (CSV, read-only)

---

# ðŸ“„ CSV Export Columns

## 1) Audit Export CSV

Endpoint: `GET /api/audit/export`

| Column | Meaning |
| :--- | :--- |
| `project_id` | MÃ£ project |
| `document_id` | ID document |
| `document_version_id` | ID version tÃ i liá»‡u |
| `grading_run_id` | ID grading run |
| `score` | Äiá»ƒm tá»•ng (Æ°u tiÃªn `total_score`, fallback `score`) |
| `status` | Tráº¡ng thÃ¡i run (`PENDING/EXTRACTING/GRADING/COMPLETED/FAILED`) |
| `prompt_level` | Má»©c Ä‘Ã¡nh giÃ¡ (`low/medium/high`) |
| `evaluation_set_id` | ID bá»™ tiÃªu chuáº©n cháº¥m Ä‘Ã£ dÃ¹ng |
| `graded_at` | Thá»i Ä‘iá»ƒm cháº¥m (ISO datetime) |

## 2) Version Diff Export CSV

Endpoint: `GET /api/documents/{document_id}/versions/diff/export`

| Column | Meaning |
| :--- | :--- |
| `row_type` | Loáº¡i dÃ²ng: `summary` / `criteria` / `warning` |
| `document_id` | ID document |
| `version_a_id` | ID version A |
| `version_b_id` | ID version B |
| `run_a_id` | ID run dÃ¹ng cho version A |
| `run_b_id` | ID run dÃ¹ng cho version B |
| `score_a` | Äiá»ƒm version A (dÃ²ng `summary`) |
| `score_b` | Äiá»ƒm version B (dÃ²ng `summary`) |
| `score_delta` | ChÃªnh lá»‡ch Ä‘iá»ƒm (dÃ²ng `summary`) |
| `score_direction` | HÆ°á»›ng thay Ä‘á»•i Ä‘iá»ƒm: `up/down/same` (dÃ²ng `summary`) |
| `prompt_level_changed` | CÃ³ Ä‘á»•i má»©c Ä‘Ã¡nh giÃ¡ hay khÃ´ng (dÃ²ng `summary`) |
| `evaluation_set_changed` | CÃ³ Ä‘á»•i bá»™ tiÃªu chuáº©n hay khÃ´ng (dÃ²ng `summary`) |
| `same_evaluation_context` | CÃ³ cÃ¹ng ngá»¯ cáº£nh Ä‘Ã¡nh giÃ¡ hay khÃ´ng (dÃ²ng `summary`) |
| `criterion_key` | MÃ£ tiÃªu chÃ­ (dÃ²ng `criteria`) |
| `criterion_a` | Äiá»ƒm tiÃªu chÃ­ á»Ÿ version A (dÃ²ng `criteria`) |
| `criterion_b` | Äiá»ƒm tiÃªu chÃ­ á»Ÿ version B (dÃ²ng `criteria`) |
| `criterion_delta` | ChÃªnh lá»‡ch theo tiÃªu chÃ­ (dÃ²ng `criteria`) |
| `criterion_direction` | HÆ°á»›ng thay Ä‘á»•i theo tiÃªu chÃ­: `up/down/same` (dÃ²ng `criteria`) |
| `warning` | Cáº£nh bÃ¡o context compare (dÃ²ng `warning`) |

---

# ðŸ§¾ API Export Documentation

## `GET /api/audit/export`

Query params:

* `project_id` (required)
* `document_id` (optional)
* `version_id` (optional)
* `format` = `csv` (initial)
* `status` (optional)
* `from_time` (optional, ISO datetime)
* `to_time` (optional, ISO datetime)

Behavior:

* Read-only, khÃ´ng mutation.
* Streaming CSV response Ä‘á»ƒ trÃ¡nh memory spike.
* Backend paginate ná»™i bá»™ khi Ä‘á»c dá»¯ liá»‡u lá»›n.

## `GET /api/documents/{document_id}/versions/diff/export`

Query params:

* `version_id_a` (required)
* `version_id_b` (required)
* `run_id_a` (optional)
* `run_id_b` (optional)

Behavior:

* Read-only, khÃ´ng mutation.
* Export Ä‘Ãºng structured diff (khÃ´ng dÃ¹ng raw LLM text).
* CSV gá»“m `summary + criteria + warning`.

---

# ðŸ”’ Safety & Rollback

* Dá»¯ liá»‡u trong `backend/data/review_system.db` lÃ  nguá»“n SQLite máº·c Ä‘á»‹nh.
* LuÃ´n backup thÆ° má»¥c `backend/uploads` vÃ  `backend/data` trÆ°á»›c khi migrate.
* Náº¿u PostgreSQL gáº·p sá»± cá»‘, gá»¡ biáº¿n `DATABASE_URL` Ä‘á»ƒ quay láº¡i dÃ¹ng SQLite.

---

# ðŸ Summary

```text
System = Versioned + Immutable + Auditable + Async (Production)
```

---

# ðŸ“Œ Current Product State (Latest)

- Phase 1â€“5 completed and stable.
- Core architecture stable: `Project -> Document -> Version -> GradingRun`.
- i18n dictionaries (VI/JA) are clean:
  - Missing keys: 0
  - Used-key missing: 0
  - Potential mojibake (VI/JA): 0
- Operational modules implemented and stable:
  - Enterprise AI Review Operations Dashboard (KPIs, Risk Watchlist)
  - Advanced Project Context (project_description) supported in AI prompts
  - Audit Dashboard & Version Diff
  - Export CSV (Audit & Diff)

---

# ðŸ›¡ï¸ Operational Truth Guardrail

All dashboard/UI/UX refinements must be grounded in **real existing system data**.

Allowed:
- reorganize existing data
- derive insights directly from current state/API/metrics
- improve operational clarity, governance visibility, decision support

Not allowed:
- fake AI insights/predictions
- fake governance/risk scoring
- recommendation logic without backend source
- analytics requiring non-existing APIs
- workflow changes that alter business behavior

Before adding any new UI block:
1. map to existing API/metric/state source
2. evaluate regression risk
3. confirm no large backend rewrite needed

---

# âœ… Release Validation Gate

For UI polish and documentation-aligned releases:

```bash
npm run build
npm run check:i18n
```

Expected:
- Missing in vi/ja = 0
- Used keys missing in dictionary = 0
- Potential mojibake vi/ja = 0

---

# ðŸ”„ Runtime Behavior (Current)

## Review Flow (Auto Mode)

- á»ž mÃ n Upload, há»‡ thá»‘ng hiá»ƒn thá»‹ bá»™ Ä‘Ã¡nh giÃ¡ theo cháº¿ Ä‘á»™ `[Auto]`.
- User váº­n hÃ nh thÆ°á»ng khÃ´ng cáº§n chá»n `Evaluation Set` thá»§ cÃ´ng Ä‘á»ƒ cháº¡y review.
- Backend sáº½ tá»± resolve bá»™ Ä‘Ã¡nh giÃ¡ active phÃ¹ há»£p theo `(document_type, prompt_level)`.

## Evaluation Set Auto-Ensure

- Náº¿u request review khÃ´ng truyá»n `evaluation_set_id`, backend sáº½ tá»± tÃ¬m active set theo scope.
- Náº¿u chÆ°a cÃ³ active set, backend thá»­ auto-ensure theo scope hiá»‡n táº¡i Ä‘á»ƒ giáº£m giÃ¡n Ä‘oáº¡n váº­n hÃ nh.
- Náº¿u scope chÆ°a Ä‘á»§ cáº¥u hÃ¬nh nÃ¢ng cao, há»‡ thá»‘ng váº«n Æ°u tiÃªn backward-compatible behavior Ä‘á»ƒ khÃ´ng phÃ¡ luá»“ng review cÅ©.

## Auditability

- Má»—i láº§n cháº¥m váº«n táº¡o `GradingRun` má»›i.
- Metadata cáº¥u hÃ¬nh thá»±c táº¿ dÃ¹ng Ä‘á»ƒ cháº¥m váº«n Ä‘Æ°á»£c lÆ°u trong `GradingRun` (khi cÃ³).

---

# ðŸ” Legacy API Mapping

CÃ¡c API cÅ© váº«n Ä‘Æ°á»£c giá»¯ Ä‘á»ƒ tÆ°Æ¡ng thÃ­ch ngÆ°á»£c, nhÆ°ng pháº£i map sang flow má»›i:

```text
project -> document -> version -> grading
```

Quy táº¯c báº¯t buá»™c:

* Upload legacy váº«n pháº£i gáº¯n vá»›i `project_id` Ä‘Ã£ tá»“n táº¡i.
* KhÃ´ng auto-create project tá»« upload/filename.
* Grading legacy endpoint váº«n cháº¥m theo `document_version` (khÃ´ng cháº¥m trá»±c tiáº¿p project).

---

# âš™ï¸ Evaluation Set Operation (Current)

## Scope Rule

- 1 scope = `(document_type + prompt_level)`.
- Má»—i scope chá»‰ cÃ³ 1 `active Evaluation Set` dÃ¹ng cho cÃ¡c láº§n cháº¥m má»›i.

## Auto Runtime

- á»ž mÃ n Upload, user váº­n hÃ nh thÆ°á»ng khÃ´ng báº¯t buá»™c chá»n `evaluation_set_id` thá»§ cÃ´ng.
- Backend sáº½ tá»± resolve bá»™ active theo `(document_type, prompt_level)`.
- Náº¿u chÆ°a cÃ³ active set, backend thá»­ auto-ensure theo scope Ä‘á»ƒ giáº£m giÃ¡n Ä‘oáº¡n váº­n hÃ nh.

## Audit Rule

- Má»—i `GradingRun` váº«n lÆ°u metadata cáº¥u hÃ¬nh Ä‘Ã£ dÃ¹ng (khi cÃ³) Ä‘á»ƒ truy váº¿t/audit.

---

# ðŸ§­ Quick Start (Business Flow)

1. Táº¡o Project.
2. Chá»n loáº¡i tÃ i liá»‡u + má»©c Ä‘á»™ Ä‘Ã¡nh giÃ¡.
3. Upload tÃ i liá»‡u vÃ o Project Ä‘Ã£ cÃ³.
4. Báº¥m review vÃ  xem káº¿t quáº£ chi tiáº¿t.
5. Náº¿u cáº§n thay chuáº©n cháº¥m, táº¡o bá»™ tiÃªu chuáº©n má»›i tá»« bá»™ hiá»‡n táº¡i vÃ  kÃ­ch hoáº¡t.

---

# âœ… UAT / Release Gate

- Cháº¡y gate báº¯t buá»™c: `powershell -ExecutionPolicy Bypass -File scripts/dev-verify-v2.ps1`
- Chá»‰ váº­n hÃ nh khi káº¿t quáº£ cuá»‘i lÃ  `PASS`
- Náº¿u gate fail: dá»«ng váº­n hÃ nh vÃ  xá»­ lÃ½ theo log tá»« migration/parity/pre-cutover

---

# ðŸ› ï¸ Troubleshooting

### Python 3.14 + Windows Installation Issue
If `pip install -r requirements.txt` fails at `watchfiles` on Windows with Python 3.14:
1. Use `backend/requirements_temp.txt` (filtered version) or manually install dependencies excluding `watchfiles`.
2. Run backend without `--reload` if `watchfiles` is missing: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.

### Windows NPM Permission Issue (`EPERM ... lstat C:\Users\...`)
If `npm run dev` fails with `EPERM` related to user profile path resolution, use the project dev scripts instead:

```powershell
cd e:\workspace\AI-Review-Document-System
.\scripts\dev-start-sync.ps1
```

Stop backend/frontend and local Celery worker:

```powershell
.\scripts\dev-stop.ps1
```

If you used async local mode and want to stop Docker Redis too:

```powershell
.\scripts\dev-stop.ps1 -StopRedis
```

The fallback script starts:
- Backend: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Frontend: `node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173`
- Default local mode is synchronous (`USE_CELERY=false`) to avoid stuck `PENDING` runs.
- For explicit async local testing, use `.\scripts\dev-start-async.ps1`.

---

# Patch Notes (2026-05-13)

## Cache Signature Update

Current grading cache signature includes:

- project_id
- content_hash
- document_version_id
- rubric_version
- prompt_version
- prompt_level
- prompt_hash
- policy_hash
- required_rule_hash
- binary_hash

## Verification Gate Add-on

- Verify repeated grading under same evaluation context resolves against `COMPLETED` cache candidate correctly.
- Keep append-only audit behavior: each grading action must preserve history.

