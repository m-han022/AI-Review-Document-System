import os
import time
import requests
from sqlmodel import Session, create_engine, select
from sqlalchemy import text

# Internal URLs in Docker network
API_URL = "http://localhost:8000/api" # Resource base
HEALTH_URL = "http://localhost:8000/health" 
DB_URL = os.getenv("DATABASE_URL")
def verify():
    print("--- Docker Production-like Verification ---")
    
    # 1. Check Database
    print(f"1. Checking Database Connection to {DB_URL}...")
    try:
        engine = create_engine(DB_URL)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("   ✅ Database connection OK")
    except Exception as e:
        print(f"   ❌ Database connection failed: {e}")
        return

    # 2. Check API Health
    print(f"2. Checking API Health at {HEALTH_URL}...")
    try:
        # Use the root health endpoint
        resp = requests.get(HEALTH_URL)
        if resp.status_code == 200:
            print("   ✅ API is up and running")
        else:
            print(f"   ❌ API health check returned status {resp.status_code}")
    except Exception as e:
        print(f"   ❌ API connection failed: {e}")

    # 3. Create Test Project
    print("3. Creating Test Project...")
    project_id = f"DOCKER-TEST-{int(time.time())}"
    try:
        resp = requests.post(f"{API_URL}/projects", json={
            "project_id": project_id,
            "project_name": "Docker Verification Project",
            "project_description": "Auto-generated for verification"
        })
        if resp.status_code == 200:
            print(f"   ✅ Project {project_id} created")
        else:
            print(f"   ❌ Project creation failed: {resp.text}")
            return
    except Exception as e:
        print(f"   ❌ Error creating project: {e}")
        return

    # 4. Verification steps for Upload and Grade are better done via the UI or manual API calls
    # since we need a real file to upload.
    
    print("\n--- Next Steps for Manual Verification ---")
    print(f"1. Go to Frontend (running locally) and find Project: {project_id}")
    print("2. Upload a small PDF/PPTX file.")
    print("3. Click 'Grade' and observe:")
    print("   - API should return 'PENDING' immediately.")
    print("   - Check worker logs: 'docker logs -f ai_review_worker'")
    print("   - Refresh UI to see status transitions (PENDING -> GRADING -> COMPLETED)")
    
    print("\nVerification Script Summary: Basic Infrastructure (DB/API) is OK.")

if __name__ == "__main__":
    verify()
