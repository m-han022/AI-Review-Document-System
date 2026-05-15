from datetime import datetime
from datetime import datetime
import csv
import io
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel
from app.config import UPLOADS_DIR
from app.models import (
    DocumentOut, DocumentVersionOut, GradingRunDetailOut, GradingRunHistoryOut, 
    SubmissionListResponse, SubmissionOut, ProjectCreate, ProjectUpdate, ProjectOut, 
    VersionComparisonOut, VersionDiffOut, DocumentListOut, VersionListOut, GradingListOut,
    SubmissionDocumentVersion
)
from app.services.excel_export import build_submissions_excel
from app.storage import store
from app.database import engine
from sqlmodel import Session
from app.services.evidence_pdf_service import ensure_evidence_pdf

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


class EvidenceStatusOut(BaseModel):
    version_id: int
    status: str
    message: str | None = None


def _resolve_submission_file(filename: str, file_path: str | None = None) -> Path:
    uploads_root = UPLOADS_DIR.resolve()
    fallback_path = (uploads_root / Path(filename).name).resolve()
    file_path_obj = Path(file_path).resolve() if file_path else fallback_path
    try:
        file_path_obj.relative_to(uploads_root)
        return file_path_obj
    except ValueError:
        # Legacy/test data may keep absolute temp paths outside uploads.
        # Fall back to the canonical uploads location for safe file serving.
        return fallback_path


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
    filename = submission.filename
    if (not file_path.exists() or not file_path.is_file()) and submission.latest_document_version_id:
        with Session(engine) as session:
            latest_version = session.get(SubmissionDocumentVersion, submission.latest_document_version_id)
            if latest_version:
                file_path = _resolve_submission_file(latest_version.original_filename, latest_version.file_path)
                filename = latest_version.original_filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"File for project {project_id} not found")

    return FileResponse(
        path=file_path,
        media_type=_media_type_for_file(filename),
        filename=filename,
        content_disposition_type="attachment" if disposition == "attachment" else "inline",
    )


@router.get("/versions/{document_version_id}/file", tags=["Projects"])
async def get_version_file(document_version_id: int, disposition: str = "inline"):
    """Serves the file associated with a specific document version."""
    with Session(engine) as session:
        version = session.get(SubmissionDocumentVersion, document_version_id)
        if not version:
            raise HTTPException(status_code=404, detail=f"Version {document_version_id} not found")
        
        file_path = _resolve_submission_file(version.original_filename, version.file_path)
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail=f"File for version {document_version_id} not found")

        return FileResponse(
            path=file_path,
            media_type=_media_type_for_file(version.original_filename),
            filename=version.original_filename,
            content_disposition_type="attachment" if disposition == "attachment" else "inline",
        )


@router.get("/versions/{document_version_id}/evidence-file", tags=["Projects"])
async def get_version_evidence_file(document_version_id: int, disposition: str = "inline"):
    with Session(engine) as session:
        version = session.get(SubmissionDocumentVersion, document_version_id)
        if not version:
            raise HTTPException(status_code=404, detail=f"Version {document_version_id} not found")

        evidence_path = Path(version.evidence_pdf_path).resolve() if version.evidence_pdf_path else None
        if evidence_path and evidence_path.exists() and evidence_path.is_file():
            return FileResponse(
                path=evidence_path,
                media_type="application/pdf",
                filename=f"{Path(version.original_filename).stem}.pdf",
                content_disposition_type="attachment" if disposition == "attachment" else "inline",
            )

        source_path = _resolve_submission_file(version.original_filename, version.file_path)
        pdf_path, status, error = ensure_evidence_pdf(str(source_path), document_version_id)
        version.evidence_pdf_path = pdf_path
        version.evidence_pdf_status = status
        version.evidence_pdf_error = error
        session.add(version)
        session.commit()

        if status != "COMPLETED" or not pdf_path:
            raise HTTPException(
                status_code=422,
                detail={"error_code": "EVIDENCE_PDF_UNAVAILABLE", "message": error or "Evidence PDF unavailable"},
            )

        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=f"{Path(version.original_filename).stem}.pdf",
            content_disposition_type="attachment" if disposition == "attachment" else "inline",
        )


@router.get("/versions/{document_version_id}/evidence-status", response_model=EvidenceStatusOut, tags=["Projects"])
async def get_version_evidence_status(document_version_id: int):
    with Session(engine) as session:
        version = session.get(SubmissionDocumentVersion, document_version_id)
        if not version:
            raise HTTPException(status_code=404, detail=f"Version {document_version_id} not found")
        return EvidenceStatusOut(
            version_id=document_version_id,
            status=version.evidence_pdf_status or "PENDING",
            message=version.evidence_pdf_error,
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

@router.get("/documents/{document_id}/versions", response_model=list[VersionListOut], tags=["Projects"])
async def list_document_versions_hierarchical(document_id: int):
    """Returns list of versions for a document."""
    return store.list_versions_by_document(document_id)

@router.get("/versions/{document_version_id}/gradings", response_model=list[GradingListOut], tags=["Projects"])
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


@router.get("/documents/{document_id}/versions/diff", response_model=VersionDiffOut, tags=["Projects"])
async def diff_document_versions(
    document_id: int,
    version_id_a: int,
    version_id_b: int,
    run_id_a: int | None = None,
    run_id_b: int | None = None,
):
    try:
        return store.diff_versions(
            document_id=document_id,
            version_id_a=version_id_a,
            version_id_b=version_id_b,
            run_id_a=run_id_a,
            run_id_b=run_id_b,
        )
    except ValueError as e:
        code = str(e)
        status_code = 422
        if code in {"DOCUMENT_NOT_FOUND", "VERSION_NOT_FOUND", "RUN_NOT_FOUND"}:
            status_code = 404
        raise HTTPException(
            status_code=status_code,
            detail={"error_code": code},
        )


@router.get("/documents/{document_id}/versions/diff/export", tags=["Projects"])
async def export_diff_document_versions_csv(
    document_id: int,
    version_id_a: int,
    version_id_b: int,
    run_id_a: int | None = None,
    run_id_b: int | None = None,
):
    try:
        diff = store.diff_versions(
            document_id=document_id,
            version_id_a=version_id_a,
            version_id_b=version_id_b,
            run_id_a=run_id_a,
            run_id_b=run_id_b,
        )
    except ValueError as e:
        code = str(e)
        status_code = 422
        if code in {"DOCUMENT_NOT_FOUND", "VERSION_NOT_FOUND", "RUN_NOT_FOUND"}:
            status_code = 404
        raise HTTPException(
            status_code=status_code,
            detail={"error_code": code},
        )

    def write_row(writer, values: list[object]):
        writer.writerow(values)

    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        write_row(
            writer,
            [
                "row_type",
                "document_id",
                "version_a_id",
                "version_b_id",
                "run_a_id",
                "run_b_id",
                "score_a",
                "score_b",
                "score_delta",
                "score_direction",
                "prompt_level_changed",
                "evaluation_set_changed",
                "same_evaluation_context",
                "criterion_key",
                "criterion_a",
                "criterion_b",
                "criterion_delta",
                "criterion_direction",
                "warning",
            ],
        )
        write_row(
            writer,
            [
                "summary",
                diff.document_id,
                diff.version_a.id,
                diff.version_b.id,
                diff.run_a.id,
                diff.run_b.id,
                diff.score_diff.a_score if diff.score_diff.a_score is not None else "",
                diff.score_diff.b_score if diff.score_diff.b_score is not None else "",
                diff.score_diff.delta,
                diff.score_diff.direction,
                diff.meta_diff.prompt_level_changed,
                diff.meta_diff.evaluation_set_changed,
                diff.comparison_validity.same_evaluation_context,
                "",
                "",
                "",
                "",
                "",
                "",
            ],
        )
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for row in diff.criteria_diff:
            write_row(
                writer,
                [
                    "criteria",
                    diff.document_id,
                    diff.version_a.id,
                    diff.version_b.id,
                    diff.run_a.id,
                    diff.run_b.id,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    row.criterion_key,
                    row.a if row.a is not None else "",
                    row.b if row.b is not None else "",
                    row.delta,
                    row.direction,
                    "",
                ],
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

        for warning in diff.comparison_validity.warnings:
            write_row(
                writer,
                [
                    "warning",
                    diff.document_id,
                    diff.version_a.id,
                    diff.version_b.id,
                    diff.run_a.id,
                    diff.run_b.id,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    warning,
                ],
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"version_diff_{document_id}_{version_id_a}_vs_{version_id_b}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
