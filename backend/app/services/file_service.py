from __future__ import annotations
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from app.config import UPLOADS_DIR

class FileStorageService:
    def __init__(self, uploads_dir: Path = UPLOADS_DIR):
        self.uploads_dir = uploads_dir
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

    def get_unique_path(self, filename: str) -> Path:
        safe_name = Path(filename).name
        candidate = self.uploads_dir / safe_name
        if not candidate.exists():
            return candidate

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        stem = Path(safe_name).stem
        suffix = Path(safe_name).suffix
        return self.uploads_dir / f"{stem}__{timestamp}{suffix}"

    def save_file(self, filename: str, content: bytes) -> Path:
        path = self.get_unique_path(filename)
        with open(path, "wb") as f:
            f.write(content)
        return path

    def calculate_hash(self, text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()

    def cleanup_file(self, path: str | Path) -> None:
        p = Path(path)
        if p.exists():
            try:
                p.unlink()
            except OSError:
                pass

    def get_relative_path(self, absolute_path: str | Path) -> str:
        try:
            return str(Path(absolute_path).relative_to(self.uploads_dir))
        except ValueError:
            return str(absolute_path)

    def get_absolute_path(self, relative_path: str) -> Path:
        p = Path(relative_path)
        if p.is_absolute():
            return p
        return self.uploads_dir / p
