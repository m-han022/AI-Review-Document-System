import sqlite3
from pathlib import Path

db_path = Path("f:/00.work/01.brycen/workspace/AI-Review-Document-System/backend/data/review_system.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, gemini_model FROM gradingrun ORDER BY id DESC LIMIT 5")
rows = cursor.fetchall()
for row in rows:
    print(f"Run ID: {row[0]}, Model: {row[1]}")

conn.close()
