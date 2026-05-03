import sys
import os
sys.path.append(os.path.join(os.getcwd(), "backend"))

from fastapi.testclient import TestClient
from app.main import app
import traceback

client = TestClient(app)

try:
    print("Requesting /api/projects...")
    response = client.get("/api/projects")
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print("Response body:", response.text)
except Exception:
    print("Caught exception:")
    traceback.print_exc()
