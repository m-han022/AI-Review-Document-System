import requests
import json

url = "http://localhost:8000/api/mgmt/defaults/v2/global"
try:
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    print("Response Body:")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
