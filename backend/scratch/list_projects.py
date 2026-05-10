import sqlite3
import os

db_path = r'f:\00.work\01.brycen\workspace\AI-Review-Document-System\backend\data\review_system.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT project_id, project_name FROM submission")
rows = cursor.fetchall()
print("All projects in database:")
for row in rows:
    print(f" - ID: {row['project_id']}, Name: {row['project_name']}")

conn.close()
