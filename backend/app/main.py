from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from app.config import settings
from app.database import create_db_and_tables
from app.services.gemini_manager import get_gemini_client
from google.genai import types

app = FastAPI(title=settings.api_title)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from app.routers import exports, grading, rubrics, submissions, upload, management, management_legacy

app.include_router(upload.router, prefix="/api")
app.include_router(grading.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(rubrics.router, prefix="/api")
app.include_router(management.router, prefix="/api/mgmt")
app.include_router(management_legacy.router, prefix="/api")

@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy"}


@app.get("/api/health/gemini")
async def gemini_health_check():
    if not settings.gemini_api_keys:
        return {
            "ok": False,
            "status": "unhealthy",
            "reason": "no_api_keys_configured",
            "model": settings.gemini_model,
            "keys_configured": 0,
        }

    try:
        client = get_gemini_client()
        response = client.generate_content(
            model=settings.gemini_model,
            contents='Reply exactly: {"ok":true}',
            config=types.GenerateContentConfig(temperature=0),
        )
        return {
            "ok": True,
            "status": "healthy",
            "model": settings.gemini_model,
            "keys_configured": len(settings.gemini_api_keys),
            "response_preview": (getattr(response, "text", "") or "")[:120],
        }
    except Exception as exc:
        return {
            "ok": False,
            "status": "unhealthy",
            "model": settings.gemini_model,
            "keys_configured": len(settings.gemini_api_keys),
            "error": str(exc),
        }

@app.get("/")
async def root():
    return {
        "message": settings.api_title,
        "docs": "/docs",
        "version": settings.api_version
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
