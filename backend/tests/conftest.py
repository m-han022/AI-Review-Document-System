import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool
from unittest.mock import MagicMock, patch

# Import app components
from app.main import app
from app.database import get_session, engine as real_engine
from app.storage import store

# --- Database Setup ---
# Use an in-memory SQLite database for tests
sqlite_url = "sqlite:///:memory:"

@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        yield session
    
    SQLModel.metadata.drop_all(engine)

@pytest.fixture(name="client")
def client_fixture(session: Session) -> Generator[TestClient, None, None]:
    # Override get_session dependency
    def get_session_override():
        return session
    
    app.dependency_overrides[get_session] = get_session_override
    
    # Also patch the engine used in storage.py and database.py if they use it directly
    with patch("app.database.engine", session.get_bind()):
        with patch("app.storage.engine", session.get_bind()):
            with patch("app.routers.grading.engine", session.get_bind()):
                with TestClient(app) as client:
                    yield client
    
    app.dependency_overrides.clear()

# --- Mocks ---

@pytest.fixture(autouse=True)
def mock_pdf_parser():
    """Mock PDF/PPTX text extraction and language detection."""
    with patch("app.routers.upload.extract_text_from_file") as mock_extract:
        mock_extract.return_value = "Mocked extracted text for testing."
        with patch("app.routers.upload.detect_language_from_text") as mock_detect:
            mock_detect.return_value = "ja"
            yield mock_extract, mock_detect

@pytest.fixture(autouse=True)
def mock_gemini():
    """Mock Gemini API client and response."""
    with patch("app.services.grading_engine.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Mock the response object
        mock_response = MagicMock()
        mock_response.text = '{"score": 85, "criteria_scores": {"review_tong_the": 20, "diem_tot": 20, "diem_xau": 25, "chinh_sach": 20}, "criteria_suggestions": {"vi": {}, "ja": {}}, "draft_feedback": {"vi": "Tốt", "ja": "Good"}, "slide_reviews": []}'
        mock_client.generate_content.return_value = mock_response
        
        yield mock_client

@pytest.fixture(autouse=True)
def mock_storage_dir(tmp_path):
    """Mock the uploads directory using a temporary path."""
    with patch("app.routers.upload.UPLOADS_DIR", tmp_path):
        with patch("app.config.UPLOADS_DIR", tmp_path):
            yield tmp_path
