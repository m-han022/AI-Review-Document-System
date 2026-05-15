import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import DB_PATH, create_db_and_tables


if __name__ == "__main__":
    create_db_and_tables()
    print(f"Document version migration completed for {DB_PATH}")
