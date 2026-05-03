import sys
import os
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.storage import store
import traceback

try:
    print("Attempting to list projects...")
    results = store.list()
    print(f"Success! Found {len(results[0])} projects.")
except Exception:
    print("Caught exception:")
    traceback.print_exc()
