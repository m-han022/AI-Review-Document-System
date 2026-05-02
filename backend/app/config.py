import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.base_dir = Path(__file__).resolve().parent.parent
        self.data_dir = self.base_dir / "data"
        self.uploads_dir = self.base_dir / "uploads"

        self.data_dir.mkdir(exist_ok=True)
        self.uploads_dir.mkdir(exist_ok=True)

        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        raw_multi_keys = os.getenv("GEMINI_API_KEYS", "")
        self.gemini_api_keys = [
            key.strip()
            for key in raw_multi_keys.split(",")
            if key.strip()
        ]
        if not self.gemini_api_keys and self.gemini_api_key:
            self.gemini_api_keys = [self.gemini_api_key]

        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview").strip()
        self.api_title = os.getenv("API_TITLE", "AI Review Document API").strip()
        self.api_version = os.getenv("API_VERSION", "1.0.0").strip()
        self.allowed_origins = self._build_allowed_origins()

    def _build_allowed_origins(self) -> List[str]:
        default_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

        extra_origins = []
        frontend_url = os.getenv("FRONTEND_URL", "").strip()
        if frontend_url:
            extra_origins.extend(
                origin.strip()
                for origin in frontend_url.split(",")
                if origin.strip()
            )

        cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
        if cors_origins:
            extra_origins.extend(
                origin.strip()
                for origin in cors_origins.split(",")
                if origin.strip()
            )

        unique_origins = []
        for origin in [*default_origins, *extra_origins]:
            if origin not in unique_origins:
                unique_origins.append(origin)
        return unique_origins


settings = Settings()

BASE_DIR = settings.base_dir
DATA_DIR = settings.data_dir
UPLOADS_DIR = settings.uploads_dir
SUBMISSIONS_FILE = DATA_DIR / "submissions.json"
