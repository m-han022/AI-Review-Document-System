import sqlite3

def analyze_grading_runs():
    try:
        db_path = 'backend/data/review_system.db'
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("--- Table Info (gradingrun) ---")
        cursor.execute("PRAGMA table_info(gradingrun)")
        for row in cursor.fetchall():
            print(row)
            
        print("\n--- Recent Runs (Detailed) ---")
        cursor.execute("SELECT id, status, error_message, started_at, graded_at FROM gradingrun ORDER BY id DESC LIMIT 20")
        for row in cursor.fetchall():
            print(row)
            
        print("\n--- Stuck Runs (Not COMPLETED or FAILED) ---")
        cursor.execute("SELECT id, status, started_at FROM gradingrun WHERE status NOT IN ('COMPLETED', 'FAILED', 'completed', 'failed')")
        for row in cursor.fetchall():
            print(row)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_grading_runs()
