import os
import sys
from pathlib import Path
from dotenv import load_dotenv

backend_path = Path(__file__).parent.parent
sys.path.append(str(backend_path))
load_dotenv(backend_path / ".env")

from google import genai

keys = os.getenv("GEMINI_API_KEYS", "").split(",")
key = keys[0].strip()

client = genai.Client(api_key=key)

print(f"Listing models for key: {key[-6:]}")
try:
    for model in client.models.list():
        print(f"Model: {model.name}, Supported Methods: {model.supported_generation_methods}")
except Exception as e:
    print(f"Error listing models: {e}")
