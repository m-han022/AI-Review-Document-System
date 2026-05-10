import sqlite3
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = r'f:\00.work\01.brycen\workspace\AI-Review-Document-System\backend\data\review_system.db'

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Find project ID 12 (P012)
project_id = 'P012'
cursor.execute("SELECT id FROM submission WHERE project_id = ?", (project_id,))
project = cursor.fetchone()

if project:
    # Find latest grading run
    cursor.execute("""
        SELECT gr.* 
        FROM gradingrun gr
        JOIN submission_document_version v ON gr.document_version_id = v.id
        WHERE v.submission_id = ?
        ORDER BY gr.graded_at DESC LIMIT 1
    """, (project['id'],))
    run = cursor.fetchone()
    
    if run:
        print(f"Latest Grading Run ID: {run['id']}")
        print(f"Status: {run['status']}")
        
        # Query slide reviews
        cursor.execute("SELECT * FROM gradingslidereview WHERE grading_run_id = ? ORDER BY slide_number", (run['id'],))
        slide_reviews = cursor.fetchall()
        
        for sr in slide_reviews:
            if sr['slide_number'] == 3:
                print(f"\n--- Slide {sr['slide_number']} Review ---")
                print(f"Status: {sr['status']}")
                print("Title:", json.dumps(sr['title'], indent=2, ensure_ascii=False))
                print("Summary:", json.dumps(sr['summary'], indent=2, ensure_ascii=False))
                print("Issues:", json.dumps(sr['issues'], indent=2, ensure_ascii=False))
                print("Suggestions:", json.dumps(sr['suggestions'], indent=2, ensure_ascii=False))
    else:
        print("No grading runs found for this project.")

conn.close()
