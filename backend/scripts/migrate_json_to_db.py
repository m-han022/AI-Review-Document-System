import json
import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.config import SUBMISSIONS_FILE
from app.models import Submission
from app.storage import store
from app.database import create_db_and_tables

def migrate():
    if not SUBMISSIONS_FILE.exists():
        print("No submissions.json found. Nothing to migrate.")
        return

    print(f"Loading data from {SUBMISSIONS_FILE}...")
    with open(SUBMISSIONS_FILE, "r", encoding="utf-8-sig") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print("Error decoding JSON.")
            return

    print("Creating database and tables...")
    create_db_and_tables()

    count = 0
    for project_id, record in data.items():
        try:
            # Pydantic model can handle the dict
            submission = Submission(**record)
            store.upsert(submission)
            count += 1
            print(f"Migrated: {project_id}")
        except Exception as e:
            print(f"Failed to migrate {project_id}: {e}")

    print(f"Successfully migrated {count} submissions.")
    
    # Rename old file
    backup_file = SUBMISSIONS_FILE.with_suffix(".json.bak")
    SUBMISSIONS_FILE.rename(backup_file)
    print(f"Original file renamed to {backup_file}")

if __name__ == "__main__":
    migrate()
