import sqlite3
import json
from pathlib import Path

db_path = Path("f:/00.work/01.brycen/workspace/AI-Review-Document-System/backend/data/review_system.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get the latest grading run for Project012 v3
cursor.execute("""
    SELECT r.id, r.score, r.draft_feedback, r.status
    FROM gradingrun r
    JOIN documentversion v ON r.document_version_id = v.id
    JOIN document d ON v.document_id = d.id
    JOIN submission s ON d.submission_id = s.id
    WHERE s.project_id = 'P012' AND v.document_version = 'v3'
    ORDER BY r.id DESC LIMIT 1
""")
run = cursor.fetchone()

if not run:
    print("No grading run found for P012 v3.")
else:
    run_id, score, draft_feedback, status = run
    print(f"--- GRADING RUN ID: {run_id} (Status: {status}) ---")
    print(f"Overall Score: {score}")
    
    # 1. Overall Evaluation (Draft Feedback)
    feedback = json.loads(draft_feedback) if draft_feedback else {}
    print("\n[TAB 1: ĐÁNH GIÁ TỔNG THỂ]")
    print(f"VI: {feedback.get('vi', 'N/A')[:500]}...")

    # 2. Criteria Analysis
    print("\n[TAB 2: PHÂN TÍCH TIÊU CHÍ]")
    cursor.execute("SELECT key, score, suggestion FROM criteriaresult WHERE grading_run_id = ?", (run_id,))
    criteria = cursor.fetchall()
    for key, c_score, c_sugg in criteria:
        sugg_data = json.loads(c_sugg) if c_sugg else {}
        print(f"- {key}: {c_score}/100 | Gợi ý: {sugg_data.get('vi', 'N/A')[:100]}...")

    # 3. Detailed Review (Slide Reviews)
    print("\n[TAB 3: ĐÁNH GIÁ CHI TIẾT]")
    cursor.execute("SELECT slide_number, status, title, summary, issues, suggestions FROM slidereview WHERE grading_run_id = ?", (run_id,))
    slides = cursor.fetchall()
    for s_num, s_status, s_title, s_sum, s_iss, s_sug in slides:
        title_data = json.loads(s_title) if s_title else {}
        summary_data = json.loads(s_sum) if s_sum else {}
        issues_data = json.loads(s_iss) if s_iss else []
        print(f"Slide {s_num} [{s_status}]: {title_data.get('vi', 'N/A')}")
        print(f"  Tóm tắt: {summary_data.get('vi', 'N/A')}")
        print(f"  Vấn đề: {issues_data}")

conn.close()
