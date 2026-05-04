from datetime import datetime
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from app.config import UPLOADS_DIR
from app.models import DocumentOut, DocumentVersionOut, GradingRunDetailOut, GradingRunHistoryOut, SubmissionListResponse, SubmissionOut, ProjectCreate, ProjectUpdate, ProjectOut, VersionComparisonOut, DocumentListOut
from app.services.excel_export import build_submissions_excel
from app.storage import store

router = APIRouter()


def _submission_out(sub) -> SubmissionOut:
    return SubmissionOut(
        project_id=sub.project_id,
        project_name=sub.project_name,
        filename=sub.filename,
        document_type=sub.document_type,
        uploaded_at=sub.uploaded_at,
        language="vi" if sub.language == "vi" else "ja",
        status=sub.status,
        project_description=sub.project_description,
        latest_document_version_id=sub.latest_document_version_id,
        latest_document_version=sub.latest_document_version,
        latest_document_id=sub.latest_document_id,
        latest_document_name=sub.latest_document_name,
        latest_score=sub.latest_run.score if sub.latest_run else None,
        latest_prompt_level=sub.latest_run.prompt_level if sub.latest_run else None,
        latest_graded_at=sub.latest_run.graded_at if sub.latest_run else None,
        latest_run=sub.latest_run,
        run_history=sub.run_history or [],
    )


@router.get("/submissions", response_model=SubmissionListResponse, tags=["Submissions"])
async def list_submissions(limit: int = 100, offset: int = 0):
    paged_subs, total, ungraded = store.list(limit=limit, offset=offset)
    submissions_out = [_submission_out(sub) for sub in paged_subs]

    return SubmissionListResponse(
        submissions=submissions_out,
        total=total,
        ungraded_count=ungraded,
    )


@router.get("/projects", response_model=list[ProjectOut], tags=["Projects"])
async def list_projects(limit: int = 100, offset: int = 0):
    """Returns a summarized list of projects for the dashboard."""
    return store.list_projects_summary(limit=limit, offset=offset)


@router.get("/submissions/{project_id}", response_model=SubmissionOut, tags=["Submissions"])
@router.get("/projects/{project_id}", response_model=SubmissionOut, tags=["Projects"])
async def get_submission(project_id: str):
    submission = store.get(project_id)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    return _submission_out(submission)


@router.get("/submissions/{project_id}/documents", response_model=list[DocumentOut], tags=["Submissions"])
@router.get("/projects/{project_id}/documents", response_model=list[DocumentOut], tags=["Projects"])
async def list_submission_documents(project_id: str):
    documents = store.list_documents(project_id)
    if not documents and not store.get(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return documents


@router.get("/submissions/{project_id}/versions", response_model=list[DocumentVersionOut], tags=["Submissions"])
@router.get("/projects/{project_id}/versions", response_model=list[DocumentVersionOut], tags=["Projects"])
async def list_submission_versions(project_id: str):
    versions = store.list_document_versions(project_id)
    if not versions and not store.get(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return versions


@router.get("/submissions/{project_id}/grading-runs", response_model=list[GradingRunHistoryOut], tags=["Submissions"])
@router.get("/projects/{project_id}/grading-runs", response_model=list[GradingRunHistoryOut], tags=["Projects"])
async def list_submission_grading_runs(project_id: str):
    runs = store.list_grading_runs(project_id)
    if not runs and not store.get(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return runs


@router.get("/grading-runs/{grading_run_id}", response_model=GradingRunDetailOut)
async def get_grading_run_detail(grading_run_id: int):
    detail = store.get_grading_run_detail(grading_run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Grading run {grading_run_id} not found")
    return detail




class DeleteProjectsRequest(BaseModel):
    project_ids: list[str]


def _resolve_submission_file(filename: str, file_path: str | None = None) -> Path:
    uploads_root = UPLOADS_DIR.resolve()
    file_path_obj = Path(file_path).resolve() if file_path else (uploads_root / Path(filename).name).resolve()
    try:
        file_path_obj.relative_to(uploads_root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid file path") from exc
    return file_path_obj


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

    file_path = _resolve_submission_file(submission.filename, submission.file_path)
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


@router.post("/projects", response_model=SubmissionOut, tags=["Projects"])
async def create_project(request: ProjectCreate):
    """Create a new project master record."""
    try:
        submission_record = store.create_project(
            project_id=request.project_id,
            project_name=request.project_name,
            project_description=request.project_description,
        )
        return _submission_out(submission_record)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/projects/{project_id}", response_model=SubmissionOut, tags=["Projects"])
async def update_project(project_id: str, request: ProjectUpdate):
    """Update project metadata (name, description)."""
    submission_record = store.update_project(
        project_id=project_id,
        project_name=request.project_name,
        project_description=request.project_description,
    )
    if not submission_record:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return _submission_out(submission_record)

# New Hierarchical API Aliases (supporting Project -> Document -> Version flow)

@router.get("/projects/{project_id}/documents-summary", response_model=list[DocumentListOut], tags=["Projects"])
async def list_project_documents_summary(project_id: str):
    """Returns summary of documents for the new hierarchical UI."""
    return store.list_documents_summary(project_id)

@router.get("/documents/{document_id}/versions", response_model=list[dict], tags=["Projects"])
async def list_document_versions_hierarchical(document_id: int):
    """Returns list of versions for a document."""
    return store.list_versions_by_document(document_id)

@router.get("/versions/{document_version_id}/gradings", response_model=list[dict], tags=["Projects"])
async def list_version_gradings_hierarchical(document_version_id: int):
    """Returns list of grading runs for a version."""
    return store.list_gradings_by_version(document_version_id)

@router.get("/documents/{document_id}/compare", response_model=VersionComparisonOut, tags=["Projects"])
async def compare_document_versions(document_id: int, base_version_id: int, compare_version_id: int):
    """Compare two versions of a document."""
    try:
        return store.compare_versions(document_id, base_version_id, compare_version_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
