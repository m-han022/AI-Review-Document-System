import sqlite3
conn = sqlite3.connect('data/review_system.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(submission_document_version)")
columns = cursor.fetchall()
for col in columns:
    print(col)
conn.close()
