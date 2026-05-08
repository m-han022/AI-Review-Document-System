import sqlite3
import os

db_path = 'data/review_system.db'
if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Tables in database:")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for table in tables:
        print(f" - {table[0]}")
    
    if ('evaluationset',) in tables:
        print("\nAll Active EvaluationSets:")
        cursor.execute("SELECT id, name, document_type, level, status FROM evaluationset WHERE status = 'active';")
        rows = cursor.fetchall()
        for row in rows:
            print(row)
    
    conn.close()
