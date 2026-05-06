from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from time import monotonic
from app.config import settings
from app.database import create_db_and_tables
from app.observability import log_event, set_request_id, setup_logging
from app.metrics import observe_api_request_seconds
from app.services.gemini_manager import get_gemini_client
from google.genai import types

app = FastAPI(title=settings.api_title)

setup_logging()

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = set_request_id(request.headers.get("X-Request-ID"))
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


class ApiLatencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started = monotonic()
        response = await call_next(request)
        route_path = getattr(request.scope.get("route"), "path", request.url.path)
        observe_api_request_seconds(
            monotonic() - started,
            method=request.method,
            route=route_path,
            status_code=response.status_code,
        )
        return response

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    log_event("startup_completed", service="backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(ApiLatencyMiddleware)

# Include routers
from app.routers import exports, grading, rubrics, submissions, upload, management, management_legacy, metrics, audit

app.include_router(upload.router, prefix="/api")
app.include_router(grading.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(rubrics.router, prefix="/api")
app.include_router(management.router, prefix="/api/mgmt")
app.include_router(management_legacy.router, prefix="/api")
app.include_router(metrics.router)
app.include_router(audit.router, prefix="/api")

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
