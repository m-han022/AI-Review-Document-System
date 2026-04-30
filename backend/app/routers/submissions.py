from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from app.config import UPLOADS_DIR
from app.models import SubmissionListResponse, SubmissionOut
from app.services.excel_export import build_submissions_excel
from app.storage import store

router = APIRouter()


@router.get("/submissions", response_model=SubmissionListResponse)
async def list_projects(limit: int = 100, offset: int = 0):
    paged_subs, total, ungraded = store.list(limit=limit, offset=offset)
    
    submissions_out = [
        SubmissionOut(
            project_id=sub.project_id,
            project_name=sub.project_name,
            filename=sub.filename,
            document_type=sub.document_type,
            uploaded_at=sub.uploaded_at,
            language=sub.language,
            status=sub.status,
            latest_run=sub.latest_run,
        )
        for sub in paged_subs
    ]

    return SubmissionListResponse(
        submissions=submissions_out,
        total=total,
        ungraded_count=ungraded,
    )


@router.get("/submissions/{project_id}", response_model=SubmissionOut)
async def get_submission(project_id: str):
    submission = store.get(project_id)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    return SubmissionOut(
        project_id=submission.project_id,
        project_name=submission.project_name,
        filename=submission.filename,
        document_type=submission.document_type,
        uploaded_at=submission.uploaded_at,
        language=submission.language,
        status=submission.status,
        latest_run=submission.latest_run,
        run_history=submission.run_history or [],
    )


class DeleteProjectsRequest(BaseModel):
    project_ids: list[str]


def _resolve_submission_file(filename: str) -> Path:
    uploads_root = UPLOADS_DIR.resolve()
    file_path = (uploads_root / Path(filename).name).resolve()
    try:
        file_path.relative_to(uploads_root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid file path") from exc
    return file_path


def _media_type_for_file(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return "application/pdf"
    if suffix == ".pptx":
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    return "application/octet-stream"


@router.get("/submissions/{project_id}/file")
async def get_submission_file(project_id: str, disposition: str = "inline"):
    submission = store.get(project_id)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    file_path = _resolve_submission_file(submission.filename)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"File for project {project_id} not found")

    return FileResponse(
        path=file_path,
        media_type=_media_type_for_file(submission.filename),
        filename=submission.filename,
        content_disposition_type="attachment" if disposition == "attachment" else "inline",
    )


@router.get("/submissions/export.xlsx")
async def export_submissions_excel():
    workbook_bytes = build_submissions_excel(store.get_all_for_export())
    filename = f"submissions_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return Response(
        content=workbook_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.delete("/submissions/{project_id}")
async def delete_project(project_id: str):
    """Delete a single project submission"""
    success = store.delete(project_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return {"message": f"Project {project_id} deleted successfully"}


@router.post("/submissions/bulk-delete")
async def bulk_delete_projects(request: DeleteProjectsRequest):
    """Delete multiple project submissions"""
    if not request.project_ids:
        raise HTTPException(status_code=400, detail="No project IDs provided")
    
    results = store.delete_many(request.project_ids)
    deleted = [pid for pid, success in results.items() if success]
    failed = [pid for pid, success in results.items() if not success]
    
    return {
        "message": f"Deleted {len(deleted)} project(s)",
        "deleted": deleted,
        "failed": failed,
    }
