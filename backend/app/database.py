from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy import inspect, text
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "review_system.db"

sqlite_url = f"sqlite:///{DB_PATH}"

engine = create_engine(
    sqlite_url, 
    connect_args={"check_same_thread": False},
)

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
    _ensure_sqlite_column("gradingrun", "prompt_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "criteria_hash", "VARCHAR")
    _ensure_sqlite_column("gradingrun", "grading_schema_version", "VARCHAR")


def create_db_and_tables():
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _migrate_sqlite_schema()
    from app.rubric import seed_rubrics_from_files

    seed_rubrics_from_files()

def get_session():
    with Session(engine) as session:
        yield session
