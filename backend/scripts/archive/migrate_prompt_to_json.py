import json
import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, text
from app.database import engine

def migrate():
    print("Migrating Rubric prompts from string to JSON using raw SQL...")
    migrated_count = 0
    with Session(engine) as session:
        # Fetch all rows manually to bypass SQLModel's JSON deserialization
        result = session.exec(text("SELECT id, prompt FROM rubric")).fetchall()
        
        for row in result:
            rubric_id = row[0]
            prompt_val = row[1]
            
            if not prompt_val:
                continue
                
            # Check if it's already a valid JSON dict
            try:
                parsed = json.loads(prompt_val)
                if isinstance(parsed, dict):
                    continue # Already migrated
            except (json.JSONDecodeError, TypeError):
                pass
            
            # Not a valid JSON dict, meaning it's the raw string. Let's convert it.
            # We dump it to a JSON string representing a dict
            new_prompt_json = json.dumps({"ja": prompt_val}, ensure_ascii=False)
            
            # Update the row
            session.exec(text("UPDATE rubric SET prompt = :prompt WHERE id = :id"), params={"prompt": new_prompt_json, "id": rubric_id})
            migrated_count += 1
            print(f"Migrated rubric ID {rubric_id}")
        
        session.commit()
    
    print(f"Successfully migrated {migrated_count} rubrics.")

if __name__ == "__main__":
    migrate()
