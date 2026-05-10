import sqlite3
import json
import os
import sys

# Set stdout to utf-8
sys.stdout.reconfigure(encoding='utf-8')

db_path = r'f:\00.work\01.brycen\workspace\AI-Review-Document-System\backend\data\review_system.db'

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

project_id = 'P012'
cursor.execute("SELECT * FROM submission WHERE project_id = ?", (project_id,))
project = cursor.fetchone()

if not project:
    print(f"Project {project_id} not found.")
else:
    print(f"Found project: {project['project_name']} (ID: {project['id']})")
    
    cursor.execute("SELECT * FROM submission_document WHERE submission_id = ?", (project['id'],))
    documents = cursor.fetchall()
    
    for doc in documents:
        print(f"\nDocument: {doc['document_name']} (Type: {doc['document_type']})")
        
        cursor.execute("SELECT * FROM submission_document_version WHERE document_id = ? AND is_latest = 1", (doc['id'],))
        version = cursor.fetchone()
        
        if version:
            print(f"Latest Version ID: {version['id']}")
            print(f"Filename: {version['filename']}")
            
            extracted_text = version['extracted_text']
            
            print("\n--- Start of Extracted Text ---")
            print(extracted_text)
            print("--- End of Extracted Text ---")

conn.close()
