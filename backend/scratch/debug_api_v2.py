import requests
import json

urls = [
    "http://localhost:8000/api/mgmt/defaults/global",
    "http://localhost:8000/api/mgmt/rubrics",
    "http://localhost:8000/api/health"
]

for url in urls:
    try:
        response = requests.get(url)
        print(f"URL: {url} -> Status: {response.status_code}")
    except Exception as e:
        print(f"URL: {url} -> Error: {e}")
