from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Depends, Request
from app.storage import store
from app.models import GradeResponse, GradeRequest, SubmissionDocumentVersion, Submission, EvaluationSet, SlideReviewOut
from app.database import engine, get_session
from app.config import settings
from app.celery_app import celery_app
from app.tasks import grade_document_version_task
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.grading_service import GradingService
from app.services.prompt_policy import normalize_prompt_level
from app.metrics import inc_counter
from app.observability import log_error, log_event
from sqlmodel import Session, select

router = APIRouter()

def get_grading_service(session: Session = Depends(get_session)) -> GradingService:
    sub_repo = SubmissionRepository(session)
    grading_repo = GradingRepository(session)
    return GradingService(sub_repo, grading_repo)

from app.services.evaluation_set_service import ensure_active_evaluation_set

def _ensure_active_evaluation_set(session: Session, document_type: str, level: str) -> EvaluationSet:
    return ensure_active_evaluation_set(session, document_type, level)


def _assert_async_runtime_ready() -> None:
    try:
        broker_connection = celery_app.connection_for_read()
        broker_connection.ensure_connection(max_retries=1)
        broker_connection.release()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Async grading is enabled but the Celery broker is not reachable. "
                "Start Redis or disable USE_CELERY for local development."
            ),
        ) from exc

    try:
        inspector = celery_app.control.inspect(timeout=0.5)
        ping_result = inspector.ping() or {}
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Async grading is enabled but Celery worker inspection failed. "
                "Start a Celery worker or disable USE_CELERY for local development."
            ),
        ) from exc

    if not ping_result:
        raise HTTPException(
            status_code=503,
            detail=(
                "Async grading is enabled but no Celery worker is responding. "
                "Start a Celery worker or disable USE_CELERY for local development."
            ),
        )

async def _perform_grading(
    service: GradingService,
    request: Request,
    project_id: str,
    document_version_id: int | None = None,
    prompt_level: str = "medium",
    rubric_version: str | None = None,
    evaluation_set_id: int | None = None,
    force: bool = False,
) -> GradeResponse:
    req_id = request.headers.get("X-Request-ID")
    log_event(
        "grading_request_received",
        project_id=project_id,
        document_version_id=document_version_id,
        prompt_level=prompt_level,
        evaluation_set_id=evaluation_set_id,
        force=force,
    )
    
    submission = service.submission_repo.get_submission(project_id)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")

    # 1. Resolve versions to grade
    target_versions: list[SubmissionDocumentVersion] = []
    if document_version_id is not None:
        v = service.submission_repo.get_document_version_by_id(document_version_id)
        if not v:
            raise HTTPException(status_code=404, detail=f"Version not found: {document_version_id}")
        target_versions = [v]
    else:
        # Batch mode: Get all latest versions for all documents in project
        target_versions = service.submission_repo.get_all_latest_document_versions(submission.id)
        if not target_versions:
             raise HTTPException(status_code=404, detail="No documents found in project to grade")

    try:
        last_result = None
        triggered_count = 0

        for version in target_versions:
            doc = service.submission_repo.get_document_for_version(version)
            document_type = doc.document_type if doc else "project-review"
            
            # Resolve evaluation set for this specific document_type
            current_eval_set_id = evaluation_set_id
            if current_eval_set_id is None:
                auto_set = _ensure_active_evaluation_set(
                    service.submission_repo.session,
                    document_type,
                    prompt_level,
                )
                current_eval_set_id = auto_set.id if auto_set else None

            if current_eval_set_id is None:
                log_event("grading_skipped_no_eval_set", project_id=project_id, document_type=document_type, version_id=version.id)
                continue

            # Check if we should use Celery
            if settings.use_celery:
                _assert_async_runtime_ready()
                # Dispatch task for each document
                run = service.create_pending_run(
                    submission_id=submission.id,
                    document_version_id=version.id,
                    document_version=version.document_version,
                    rubric_version=rubric_version or "latest",
                    prompt_level=prompt_level,
                    content_hash=version.content_hash,
                    evaluation_set_id=current_eval_set_id,
                )
                
                grade_document_version_task.delay(
                    project_id=project_id,
                    document_version_id=version.id,
                    grading_run_id=run.id,
                    prompt_level=prompt_level,
                    rubric_version=rubric_version,
                    evaluation_set_id=current_eval_set_id,
                    force=force,
                    request_id=req_id,
                )
                triggered_count += 1
                last_result = GradeResponse(
                    project_id=project_id,
                    project_name=submission.project_name,
                    run_id=run.id,
                    status="PENDING",
                    document_version_id=version.id,
                    document_version=version.document_version,
                    prompt_level=prompt_level,
                    evaluation_set_id=current_eval_set_id,
                    language=submission.language,
                )
            else:
                # Synchronous execution (looping might be slow)
                result_data = service.run_grading(
                    project_id=project_id,
                    document_version_id=version.id,
                    prompt_level=prompt_level,
                    rubric_version=rubric_version,
                    evaluation_set_id=current_eval_set_id,
                    force=force
                )
                triggered_count += 1
                last_result = GradeResponse(
                    project_id=project_id,
                    project_name=submission.project_name,
                    run_id=result_data.get("run_id") or result_data.get("grading_run_id"),
                    score=result_data.get("score"),
                    status=result_data.get("status", "COMPLETED"),
                    document_version_id=result_data.get("document_version_id"),
                    document_version=result_data.get("document_version"),
                    rubric_version=result_data.get("rubric_version"),
                    evaluation_set_id=result_data.get("evaluation_set_id"),
                    language=submission.language,
                )
        
        if triggered_count == 0:
             raise HTTPException(
                status_code=422,
                detail="Could not trigger grading for any documents. Ensure evaluation sets are active."
            )

        return last_result

    except ValueError as e:
        log_error(
            "grading_validation_failed",
            error_code="GRADING_VALIDATION_FAILED",
            project_id=project_id,
            document_version_id=document_version_id,
            detail=str(e),
        )
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        log_error(
            "grading_failed",
            error_code="GRADING_FAILED",
            project_id=project_id,
            document_version_id=document_version_id,
            detail=str(e),
        )
        raise HTTPException(
            status_code=502,
            detail=f"Grading failed: {str(e)}",
        )

@router.post("/grade/{project_id}", response_model=GradeResponse)
async def grade_single(
    request: Request,
    project_id: str,
    force: bool = Query(default=False),
    rubric_version: str | None = Query(default=None),
    document_version_id: int | None = Query(default=None),
    prompt_level: str = Query(default="medium"),
    evaluation_set_id: int | None = Query(default=None),
    service: GradingService = Depends(get_grading_service),
):
    # Legacy alias route retained for backward compatibility.
    # Even on this endpoint, grading is always executed against a concrete document_version.
    return await _perform_grading(
        service=service,
        request=request,
        project_id=project_id,
        document_version_id=document_version_id,
        prompt_level=prompt_level,
        rubric_version=rubric_version,
        evaluation_set_id=evaluation_set_id,
        force=force
    )

@router.post("/grade", response_model=GradeResponse)
async def grade_version(
    request: Request,
    payload: GradeRequest,
    service: GradingService = Depends(get_grading_service),
):
    # Resolve project_id from version_id
    version = service.submission_repo.get_document_version_by_id(payload.document_version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Document version not found")
    submission = service.submission_repo.get_submission_by_id(version.submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return await _perform_grading(
        service=service,
        request=request,
        project_id=submission.project_id,
        document_version_id=payload.document_version_id,
        prompt_level=payload.prompt_level,
        rubric_version=payload.rubric_version,
        evaluation_set_id=payload.evaluation_set_id,
        force=payload.force
    )

# Keeping grade-all and other routes same for now but they should eventually use the service too
from app.services.grading_jobs import grade_job_store
from app.models import GradeJobResponse

@router.post("/grade-all", response_model=GradeJobResponse)
async def grade_all(
    background_tasks: BackgroundTasks,
    force: bool = Query(default=False),
    rubric_version: str | None = Query(default=None),
    prompt_level: str = Query(default="medium"),
):
    project_ids = store.get_all_project_ids() if force else store.get_ungraded_project_ids()
    job = grade_job_store.create_job(project_ids, force=force, rubric_version=rubric_version, prompt_level=prompt_level)
    background_tasks.add_task(grade_job_store.run_grade_all_job, job.job_id)
    return job

@router.get("/grade-jobs/{job_id}", response_model=GradeJobResponse)
async def get_grade_job(job_id: str):
    job = grade_job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Grade job not found: {job_id}")
    return job
