import os
from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy import inspect, text
from pathlib import Path
import json

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "review_system.db"

# Fallback to SQLite if DATABASE_URL is not provided
database_url = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# For SQLite, we need connect_args={"check_same_thread": False}
engine_args = {}
if database_url.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(database_url, **engine_args)

def _ensure_sqlite_column(table_name: str, column_name: str, column_type: str) -> None:
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name in existing_columns:
        return
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))


def _migrate_sqlite_schema() -> None:
    _ensure_sqlite_column("submission", "project_description", "VARCHAR")
    _ensure_sqlite_column("submission_document_version", "document_id", "INTEGER")
    _ensure_sqlite_column("rubric", "status", "VARCHAR DEFAULT 'active'")
    _ensure_sqlite_column("promptversion", "status", "VARCHAR DEFAULT 'active'")
    _ensure_sqlite_column("evaluationpolicy", "status", "VARCHAR DEFAULT 'active'")
    _ensure_sqlite_column("gradingrun", "document_version_id", "INTEGER")
    _ensure_sqlite_column("gradingrun", "document_version", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "rubric_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "total_score", "INTEGER")
    _ensure_sqlite_column("gradingrun", "prompt_version", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "prompt_level", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "policy_version", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "policy_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "required_rule_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "prompt_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "criteria_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "grading_schema_version", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "project_description_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "final_prompt_snapshot", "TEXT")
    _ensure_sqlite_column("gradingrun", "evaluation_set_id", "INTEGER")
    _ensure_sqlite_column("gradingrun", "required_rule_set_id", "INTEGER")
    _ensure_sqlite_column("evaluationset", "required_rule_set_id", "INTEGER")
    _ensure_sqlite_column("evaluationset", "version_label", "VARCHAR")


def _rebuild_document_version_table_if_needed() -> None:
    inspector = inspect(engine)
    if "submission_document_version" not in inspector.get_table_names():
        return

    row = None
    with engine.begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT sql
                FROM sqlite_master
                WHERE type = 'table'
                  AND name = 'submission_document_version'
                """
            )
        ).fetchone()

    schema_sql = row[0] if row else ""
    has_legacy_unique = "uq_submission_document_version" in schema_sql
    has_document_unique = "uq_document_version" in schema_sql
    has_document_fk = "FOREIGNKEY(document_id)" in schema_sql.replace(" ", "")
    if not has_legacy_unique and has_document_unique and has_document_fk:
        return

    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text("DROP TABLE IF EXISTS submission_document_version_new"))
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS submission_document_version_new (
                    id INTEGER NOT NULL,
                    submission_id INTEGER NOT NULL,
                    document_id INTEGER,
                    document_version VARCHAR NOT NULL,
                    filename VARCHAR NOT NULL,
                    original_filename VARCHAR NOT NULL,
                    file_path VARCHAR,
                    extracted_text VARCHAR NOT NULL,
                    content_hash VARCHAR NOT NULL,
                    language VARCHAR NOT NULL,
                    uploaded_at VARCHAR NOT NULL,
                    is_latest BOOLEAN NOT NULL,
                    PRIMARY KEY (id),
                    CONSTRAINT uq_document_version UNIQUE (document_id, document_version),
                    FOREIGN KEY(submission_id) REFERENCES submission (id),
                    FOREIGN KEY(document_id) REFERENCES submission_document (id)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO submission_document_version_new (
                    id,
                    submission_id,
                    document_id,
                    document_version,
                    filename,
                    original_filename,
                    file_path,
                    extracted_text,
                    content_hash,
                    language,
                    uploaded_at,
                    is_latest
                )
                SELECT
                    id,
                    submission_id,
                    document_id,
                    document_version,
                    filename,
                    original_filename,
                    file_path,
                    extracted_text,
                    content_hash,
                    language,
                    uploaded_at,
                    is_latest
                FROM submission_document_version
                """
            )
        )
        connection.execute(text("DROP TABLE submission_document_version"))
        connection.execute(text("ALTER TABLE submission_document_version_new RENAME TO submission_document_version"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submission_document_version_submission_id ON submission_document_version (submission_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submission_document_version_document_id ON submission_document_version (document_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submission_document_version_document_version ON submission_document_version (document_version)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submission_document_version_content_hash ON submission_document_version (content_hash)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submission_document_version_language ON submission_document_version (language)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_submission_document_version_is_latest ON submission_document_version (is_latest)"))
        connection.execute(text("PRAGMA foreign_keys=ON"))


def _migrate_document_versions() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    required_tables = {"submission", "submissioncontent", "submission_document", "submission_document_version", "gradingrun"}
    if not required_tables.issubset(set(table_names)):
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO submission_document (
                    submission_id,
                    document_type,
                    document_name,
                    created_at,
                    updated_at,
                    is_latest
                )
                SELECT
                    s.id,
                    COALESCE(NULLIF(s.document_type, ''), 'project-review'),
                    COALESCE(NULLIF(s.filename, ''), NULLIF(s.project_name, ''), s.project_id),
                    COALESCE(NULLIF(s.uploaded_at, ''), datetime('now')),
                    COALESCE(NULLIF(s.uploaded_at, ''), datetime('now')),
                    1
                FROM submission s
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM submission_document d
                    WHERE d.submission_id = s.id
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO submission_document_version (
                    submission_id,
                    document_id,
                    document_version,
                    filename,
                    original_filename,
                    file_path,
                    extracted_text,
                    content_hash,
                    language,
                    uploaded_at,
                    is_latest
                )
                SELECT
                    s.id,
                    (
                        SELECT d.id
                        FROM submission_document d
                        WHERE d.submission_id = s.id
                        ORDER BY d.id DESC
                        LIMIT 1
                    ),
                    'v1',
                    s.filename,
                    s.filename,
                    s.file_path,
                    COALESCE(sc.extracted_text, ''),
                    COALESCE(sc.content_hash, ''),
                    s.language,
                    s.uploaded_at,
                    1
                FROM submission s
                LEFT JOIN submissioncontent sc ON sc.submission_id = s.id
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM submission_document_version dv
                    WHERE dv.submission_id = s.id
                )
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE submission_document_version
                SET document_id = COALESCE(
                    document_id,
                    (
                        SELECT d.id
                        FROM submission_document d
                        WHERE d.submission_id = submission_document_version.submission_id
                        ORDER BY d.id DESC
                        LIMIT 1
                    )
                )
                WHERE document_id IS NULL
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE gradingrun
                SET
                    document_version_id = COALESCE(
                        document_version_id,
                        (
                            SELECT dv.id
                            FROM submission_document_version dv
                            WHERE dv.submission_id = gradingrun.submission_id
                              AND dv.is_latest = 1
                            ORDER BY dv.id DESC
                            LIMIT 1
                        )
                    ),
                    document_version = COALESCE(document_version, 'v1'),
                    total_score = COALESCE(total_score, score),
                    prompt_level = COALESCE(prompt_level, 'medium'),
                    prompt_version = COALESCE(prompt_version, 'legacy-v1'),
                    policy_version = COALESCE(policy_version, 'legacy-policy-v1')
                WHERE document_version_id IS NULL
                   OR document_version IS NULL
                   OR total_score IS NULL
                   OR prompt_level IS NULL
                   OR prompt_version IS NULL
                   OR policy_version IS NULL
                """
            )
        )


def _seed_required_rule_sets() -> None:
    from sqlmodel import select
    from app.models import RequiredRuleSet, EvaluationSet, GradingRun
    from app.services.prompt_composer import REQUIRED_RULES, stable_hash
    from app.services.prompt_policy import _now

    rules_content = json.dumps(REQUIRED_RULES, ensure_ascii=False)
    rules_hash = stable_hash(REQUIRED_RULES)
    with Session(engine) as session:
        active = session.exec(
            select(RequiredRuleSet).where(RequiredRuleSet.status == "active").order_by(RequiredRuleSet.id.desc())
        ).first()
        if not active:
            existing = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.hash == rules_hash)).first()
            if existing:
                existing.status = "active"
            else:
                session.add(
                    RequiredRuleSet(
                        version="system-rules-v1",
                        hash=rules_hash,
                        content=rules_content,
                        status="active",
                        created_at=_now(),
                    )
                )
            session.commit()

        active_row = session.exec(
            select(RequiredRuleSet).where(RequiredRuleSet.status == "active").order_by(RequiredRuleSet.id.desc())
        ).first()
        if active_row:
            eval_sets = session.exec(select(EvaluationSet).where(EvaluationSet.required_rule_set_id.is_(None))).all()
            for item in eval_sets:
                item.required_rule_set_id = active_row.id
                item.required_rules_version = item.required_rules_version or active_row.version
                item.required_rule_hash = item.required_rule_hash or active_row.hash

            gradings = session.exec(select(GradingRun).where(GradingRun.required_rule_set_id.is_(None))).all()
            for item in gradings:
                item.required_rule_set_id = active_row.id
                item.required_rule_hash = item.required_rule_hash or active_row.hash

            session.commit()


def create_db_and_tables():
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    
    if engine.url.drivername == "sqlite":
        _migrate_sqlite_schema()
        _migrate_document_versions()
        _rebuild_document_version_table_if_needed()
        _seed_required_rule_sets()
    from app.rubric import seed_rubrics_from_files

    seed_rubrics_from_files()

def get_session():
    with Session(engine) as session:
        yield session
