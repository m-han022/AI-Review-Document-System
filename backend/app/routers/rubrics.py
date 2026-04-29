from fastapi import APIRouter, HTTPException

from app.models import RubricListResponse, RubricVersionOut, RubricVersionPayload
from app.rubric import (
    activate_rubric_version,
    get_rubric_version_bundle,
    list_rubric_versions,
    save_rubric_version,
)

router = APIRouter()


@router.get("/rubrics", response_model=RubricListResponse)
async def list_rubrics():
    try:
        return RubricListResponse(rubrics=list_rubric_versions())
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/rubrics/{document_type}", response_model=RubricVersionOut)
async def get_active_rubric(document_type: str):
    try:
        return get_rubric_version_bundle(document_type)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/rubrics/{document_type}/{version}", response_model=RubricVersionOut)
async def get_rubric_version(document_type: str, version: str):
    try:
        return get_rubric_version_bundle(document_type, version)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/rubrics/{document_type}/{version}", response_model=RubricVersionOut)
async def upsert_rubric_version(document_type: str, version: str, payload: RubricVersionPayload):
    if payload.version != version:
        raise HTTPException(status_code=400, detail="Payload version must match URL version")
    try:
        return save_rubric_version(document_type, payload)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rubrics/{document_type}/{version}/activate", response_model=RubricVersionOut)
async def activate_rubric(document_type: str, version: str):
    try:
        return activate_rubric_version(document_type, version)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
