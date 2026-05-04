import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def log_step(step, status, details=None):
    print(f"--- [Step {step}] {status} ---")
    if details:
        try:
            print(json.dumps(details, indent=2))
        except:
            print("  (Could not print details due to encoding)")

def run_regression():
    results = []
    pid = "REGRESSION-API-TEST-8"
    
    # 1. Create project
    try:
        r = requests.post(f"{BASE_URL}/api/projects", json={"project_id": pid, "project_name": "Regression API Test"})
        log_step(1, "Create Project", r.json())
        results.append({"step": 1, "action": "Create Project", "status": r.status_code})
    except Exception as e:
        log_step(1, "Create Project FAILED", str(e))
        return

    # 2. Upload Doc A
    try:
        files = {"file": ("doc_a.pptx", open("regression.pptx", "rb"), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
        data = {"project_id": pid, "document_name": "Doc A"}
        r = requests.post(f"{BASE_URL}/api/upload", data=data, files=files)
        v1_a_id = r.json().get("document_version_id")
        log_step(2, "Upload Doc A", r.json())
        results.append({"step": 2, "action": "Upload Doc A", "status": r.status_code})
    except Exception as e:
        log_step(2, "Upload Doc A FAILED", str(e))
        return

    # 3. Grade Doc A
    try:
        r = requests.post(f"{BASE_URL}/api/grade", json={"document_version_id": v1_a_id})
        log_step(3, "Grade Doc A", r.json())
        results.append({"step": 3, "action": "Grade Doc A", "status": r.status_code})
    except Exception as e:
        log_step(3, "Grade Doc A FAILED", str(e))
        return

    # 4. Verify Project Summary (COMPLETED)
    try:
        r = requests.get(f"{BASE_URL}/api/projects")
        projects = r.json()
        project = next((p for p in projects if p["project_id"] == pid), None)
        log_step(4, "Verify Project Summary", project)
        assert project["latest_status"] == "completed"
        results.append({"step": 4, "action": "Verify Project Status (Completed)", "status": "PASS"})
    except Exception as e:
        log_step(4, "Verify Project Status FAILED", str(e))
        results.append({"step": 4, "action": "Verify Project Status (Completed)", "status": "FAIL", "error": str(e)})

    # 5. Upload Doc B
    try:
        files = {"file": ("doc_b.pptx", open("regression.pptx", "rb"), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
        data = {"project_id": pid, "document_name": "Doc B"}
        r = requests.post(f"{BASE_URL}/api/upload", data=data, files=files)
        v1_b_id = r.json().get("document_version_id")
        log_step(5, "Upload Doc B", r.json())
        results.append({"step": 5, "action": "Upload Doc B", "status": r.status_code})
    except Exception as e:
        log_step(5, "Upload Doc B FAILED", str(e))
        return

    # 6. Grade Doc B
    try:
        r = requests.post(f"{BASE_URL}/api/grade", json={"document_version_id": v1_b_id})
        log_step(6, "Grade Doc B", r.json())
        results.append({"step": 6, "action": "Grade Doc B", "status": r.status_code})
    except Exception as e:
        log_step(6, "Grade Doc B FAILED", str(e))
        return

    # 7. Upload Doc A v2
    try:
        files = {"file": ("doc_a_v2.pptx", open("regression.pptx", "rb"), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
        data = {"project_id": pid, "document_name": "Doc A"}
        r = requests.post(f"{BASE_URL}/api/upload", data=data, files=files)
        log_step(7, "Upload Doc A v2", r.json())
        results.append({"step": 7, "action": "Upload Doc A v2", "status": r.status_code})
    except Exception as e:
        log_step(7, "Upload Doc A v2 FAILED", str(e))
        return

    # 8. Check Final Statuses
    # Check Project Summary
    r_proj = requests.get(f"{BASE_URL}/api/projects")
    project = next((p for p in r_proj.json() if p["project_id"] == pid), None)
    log_step(8.1, "Final Project Summary", project)
    
    # Check Documents List Summary
    r_docs = requests.get(f"{BASE_URL}/api/projects/{pid}/documents-summary")
    docs = r_docs.json()
    log_step(8.2, "Final Documents List Summary", docs)
    
    doc_a = next(d for d in docs if d["document_name"] == "Doc A")
    doc_b = next(d for d in docs if d["document_name"] == "Doc B")
    
    # Doc B must be COMPLETED
    assert doc_b["latest_status"] == "completed"
    # Doc A must be PENDING (default when no run exists)
    assert doc_a["latest_status"] == "pending"
    # Project status should still be 'completed' because it preserves Doc B's status
    assert project["latest_status"] == "completed"
    
    results.append({"step": 8, "action": "Verify Final Statuses", "status": "PASS"})

    # Print Summary Table
    print("\n" + "="*50)
    print(f"{'Step':<5} | {'Action':<30} | {'Status':<10} | {'Details'}")
    print("-" * 80)
    for res in results:
        details = res.get("error", "")
        print(f"{res['step']:<5} | {res['action']:<30} | {res['status']:<10} | {details}")
    print("="*80)

if __name__ == "__main__":
    run_regression()
