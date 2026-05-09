import requests
import json

url = "http://localhost:8000/api/mgmt/defaults/global"
try:
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Top level keys: {list(data.keys())}")
    if "rubric_templates" in data:
        print(f"Rubric templates keys: {list(data['rubric_templates'].keys())}")
    else:
        print("rubric_templates key MISSING from response!")
except Exception as e:
    print(f"Error connecting to {url}: {e}")
