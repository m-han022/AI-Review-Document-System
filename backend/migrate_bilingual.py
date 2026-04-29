"""
Migration script: Convert old string-based draft_feedback and criteria_suggestions
to JSON-compatible format in the SQLite database.

Old data has these columns as plain text strings. The new schema expects JSON objects.
SQLAlchemy's JSON column type will crash when trying to json.loads() a plain string.
"""
import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "submissions.db"


def migrate():
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}, nothing to migrate.")
        return

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("SELECT project_id, draft_feedback, criteria_suggestions, language FROM submission")
    rows = cursor.fetchall()

    if not rows:
        print("No submissions found. Nothing to migrate.")
        conn.close()
        return

    migrated = 0
    for project_id, draft_feedback, criteria_suggestions, language in rows:
        needs_update = False
        new_feedback = draft_feedback
        new_suggestions = criteria_suggestions

        # --- Migrate draft_feedback ---
        if draft_feedback is not None:
            try:
                parsed = json.loads(draft_feedback)
                # Already valid JSON - check if it's a bilingual dict
                if isinstance(parsed, str):
                    # It was a JSON-encoded string, wrap it
                    lang_key = language if language in ("vi", "ja") else "vi"
                    new_feedback = json.dumps({lang_key: parsed}, ensure_ascii=False)
                    needs_update = True
                elif isinstance(parsed, dict):
                    # Already a dict, good
                    pass
                else:
                    # Unexpected type, wrap as string
                    lang_key = language if language in ("vi", "ja") else "vi"
                    new_feedback = json.dumps({lang_key: str(parsed)}, ensure_ascii=False)
                    needs_update = True
            except (json.JSONDecodeError, TypeError):
                # Plain string that is not valid JSON - wrap it
                if draft_feedback.strip():
                    lang_key = language if language in ("vi", "ja") else "vi"
                    new_feedback = json.dumps({lang_key: draft_feedback}, ensure_ascii=False)
                    needs_update = True
                else:
                    # Empty string - set to null
                    new_feedback = None
                    needs_update = True

        # --- Migrate criteria_suggestions ---
        if criteria_suggestions is not None:
            try:
                parsed = json.loads(criteria_suggestions)
                if isinstance(parsed, dict):
                    # Check if it's already bilingual or criteria-level
                    # If keys are like "vi"/"ja", it's bilingual wrapper - fine
                    # If keys are criterion keys with string values, wrap in lang
                    first_val = next(iter(parsed.values()), None) if parsed else None
                    if isinstance(first_val, str):
                        # Old format: {"criterion_key": "suggestion text", ...}
                        # Wrap in language key
                        lang_key = language if language in ("vi", "ja") else "vi"
                        new_suggestions = json.dumps({lang_key: parsed}, ensure_ascii=False)
                        needs_update = True
                    # else: already nested/complex, leave as-is
            except (json.JSONDecodeError, TypeError):
                if criteria_suggestions.strip():
                    lang_key = language if language in ("vi", "ja") else "vi"
                    new_suggestions = json.dumps({lang_key: criteria_suggestions}, ensure_ascii=False)
                    needs_update = True
                else:
                    new_suggestions = None
                    needs_update = True

        if needs_update:
            cursor.execute(
                "UPDATE submission SET draft_feedback = ?, criteria_suggestions = ? WHERE project_id = ?",
                (new_feedback, new_suggestions, project_id),
            )
            migrated += 1
            print(f"  Migrated: {project_id}")

    conn.commit()
    conn.close()
    print(f"\nDone. Migrated {migrated}/{len(rows)} submissions.")


if __name__ == "__main__":
    migrate()
