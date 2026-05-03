import sys
import os
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.config import settings

print(f"Allowed Origins: {settings.allowed_origins}")
