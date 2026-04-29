import json
from pathlib import Path
from sqlmodel import Session, select, create_engine, SQLModel
from app.models import Rubric
from app.database import DB_PATH, engine

RUBRICS_DIR = Path(__file__).resolve().parent.parent / "app" / "rubrics"
ACTIVE_VERSIONS_FILE = RUBRICS_DIR / "active_versions.json"

def migrate():
    if not RUBRICS_DIR.exists():
        print("Rubrics directory not found. Skipping migration.")
        return

    # Ensure tables are created
    SQLModel.metadata.create_all(engine)

    active_versions = {}
    if ACTIVE_VERSIONS_FILE.exists():
        with open(ACTIVE_VERSIONS_FILE, "r", encoding="utf-8") as f:
            active_versions = json.load(f)

    with Session(engine) as session:
        for doc_type_dir in RUBRICS_DIR.iterdir():
            if not doc_type_dir.is_dir():
                continue
            
            doc_type = doc_type_dir.name
            active_version_name = active_versions.get(doc_type)

            for version_dir in doc_type_dir.iterdir():
                if not version_dir.is_dir():
                    continue
                
                version_name = version_dir.name
                meta_path = version_dir / "meta.json"
                prompt_path = version_dir / "prompt.md"
                if not prompt_path.exists():
                    prompt_path = version_dir / "ja.md"
                
                if not meta_path.exists() or not prompt_path.exists():
                    continue
                
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                
                prompt = prompt_path.read_text(encoding="utf-8").strip()
                
                # Build criteria
                criteria = []
                keys = meta.get("criteria_keys", [])
                max_scores = meta.get("max_scores", {})
                labels = meta.get("criteria_labels", {})
                
                for key in keys:
                    criteria.append({
                        "key": key,
                        "max_score": max_scores.get(key, 25),
                        "labels": labels.get(key, {"vi": key, "ja": key})
                    })

                # Check if already exists
                statement = select(Rubric).where(Rubric.document_type == doc_type, Rubric.version == version_name)
                existing = session.exec(statement).first()
                
                if not existing:
                    rubric = Rubric(
                        document_type=doc_type,
                        version=version_name,
                        active=(version_name == active_version_name),
                        criteria=criteria,
                        prompt=prompt
                    )
                    session.add(rubric)
                    print(f"Migrated {doc_type} {version_name}")
                else:
                    print(f"Skipped {doc_type} {version_name} (already exists)")
        
        session.commit()

if __name__ == "__main__":
    migrate()
