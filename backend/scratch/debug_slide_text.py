import sqlite3
import json
import os

db_path = r"f:\00.work\01.brycen\workspace\AI-Review-Document-System\backend\data\review_system.db"

def check_extracted_text():
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get the latest version's extracted text
    cursor.execute("""
        SELECT dv.document_version_id, dv.document_id, dv.version, dv.extracted_text, d.document_name
        FROM document_versions dv
        JOIN documents d ON dv.document_id = d.document_id
        ORDER BY dv.created_at DESC
        LIMIT 1
    """)
    row = cursor.fetchone()
    
    if not row:
        print("No document versions found.")
        return

    v_id, d_id, version, text, name = row
    print(f"Checking Document: {name} (ID: {d_id}), Version: {version} (ID: {v_id})")
    print("-" * 50)
    
    if not text:
        print("Extracted text is EMPTY or NULL.")
        return

    # Find Slide 3 content
    start_marker = "[Slide 3]"
    next_marker = "[Slide 4]"
    
    start_idx = text.find(start_marker)
    if start_idx == -1:
        print(f"Marker '{start_marker}' not found in text.")
        # Print first 500 chars to see format
        print("First 500 chars of extracted text:")
        print(text[:500])
        return
        
    end_idx = text.find(next_marker, start_idx + len(start_marker))
    slide_content = text[start_idx + len(start_marker):end_idx].strip()
    
    print(f"Content found for Slide 3:")
    print(slide_content)
    print("-" * 50)
    
    # Check if there are tables or hidden text that might be missed
    print(f"Total length of extracted text: {len(text)} characters.")
    
    conn.close()

if __name__ == "__main__":
    check_extracted_text()
