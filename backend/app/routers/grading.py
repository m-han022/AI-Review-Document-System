from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Depends
from app.storage import store
from app.models import GradeResponse, GradeRequest, SubmissionDocumentVersion, Submission
from app.database import engine, get_session
from app.config import settings
from app.tasks import grade_document_version_task
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.grading_service import GradingService
from sqlmodel import Session

router = APIRouter()

def get_grading_service(session: Session = Depends(get_session)) -> GradingService:
    sub_repo = SubmissionRepository(session)
    grading_repo = GradingRepository(session)
    return GradingService(sub_repo, grading_repo)

async def _perform_grading(
    service: GradingService,
    project_id: str,
    document_version_id: int | None = None,
    prompt_level: str = "medium",
    rubric_version: str | None = None,
    evaluation_set_id: int | None = None,
    force: bool = False,
) -> GradeResponse:
    # 1. Resolve document_version_id if not provided
    if document_version_id is None:
        version = service.submission_repo.get_latest_document_version_by_project(project_id) # I need to add this method or use store
        if not version:
            # Fallback to store for backward compatibility or if service doesn't have it yet
            version = store.get_document_version(project_id)
        if not version:
            raise HTTPException(status_code=404, detail="Document version not found")
        document_version_id = version.id

    try:
        # 2. Check if we should use Celery
        if settings.use_celery:
            # Create a PENDING run record first
            submission = service.submission_repo.get_submission(project_id)
            if not submission:
                raise HTTPException(status_code=404, detail=f"Project not found: {project_id}")
            
            version = service.submission_repo.get_document_version_by_id(document_version_id)
            if not version:
                raise HTTPException(status_code=404, detail=f"Version not found: {document_version_id}")
            
            # Create run in PENDING status
            run = service.create_pending_run(
                submission_id=submission.id,
                document_version_id=version.id,
                document_version=version.document_version,
                rubric_version=rubric_version or "latest", # Will be resolved in task
                prompt_level=prompt_level,
                content_hash=version.content_hash
            )
            
            # Dispatch Celery task
            grade_document_version_task.delay(
                project_id=project_id,
                document_version_id=document_version_id,
                grading_run_id=run.id,
                prompt_level=prompt_level,
                rubric_version=rubric_version,
                evaluation_set_id=evaluation_set_id,
                force=force
            )
            
            return GradeResponse(
                project_id=project_id,
                project_name=submission.project_name,
                run_id=run.id,
                status="PENDING",
                document_version_id=version.id,
                document_version=version.document_version,
                prompt_level=prompt_level,
                evaluation_set_id=evaluation_set_id,
                language=submission.language,
            )

        # Synchronous behavior (existing)
        result = service.run_grading(
            project_id=project_id,
            document_version_id=document_version_id,
            prompt_level=prompt_level,
            rubric_version=rubric_version,
            evaluation_set_id=evaluation_set_id,
            force=force
        )
        
        # Re-fetch submission to get the latest run details
        submission_record = store.get(project_id)
        latest_run = submission_record.latest_run
        
        return GradeResponse(
            project_id=project_id,
            project_name=submission_record.project_name,
            run_id=latest_run.id,
            score=latest_run.score,
            status=latest_run.status,
            document_version_id=latest_run.document_version_id,
            document_version=latest_run.document_version,
            rubric_version=latest_run.rubric_version,
            rubric_hash=latest_run.rubric_hash,
            gemini_model=latest_run.gemini_model,
            prompt_version=latest_run.prompt_version,
            prompt_level=latest_run.prompt_level,
            evaluation_set_id=latest_run.evaluation_set_id,
            policy_version=latest_run.policy_version,
            policy_hash=latest_run.policy_hash,
            required_rule_hash=latest_run.required_rule_hash,
            prompt_hash=latest_run.prompt_hash,
            criteria_hash=latest_run.criteria_hash,
            grading_schema_version=latest_run.grading_schema_version,
            criteria_scores={item.key: item.score for item in latest_run.criteria_results},
            criteria_suggestions={
                item.key: item.suggestion for item in latest_run.criteria_results if item.suggestion is not None
            },
            draft_feedback=latest_run.draft_feedback,
            slide_reviews=latest_run.slide_reviews or [],
            graded_at=latest_run.graded_at or datetime.now(timezone.utc).isoformat(),
            language=submission_record.language,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=502,
            detail=f"Grading failed: {str(e)}",
        )

@router.post("/grade/{project_id}", response_model=GradeResponse)
async def grade_single(
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
        project_id=project_id,
        document_version_id=document_version_id,
        prompt_level=prompt_level,
        rubric_version=rubric_version,
        evaluation_set_id=evaluation_set_id,
        force=force
    )

@router.post("/grade", response_model=GradeResponse)
async def grade_version(
    request: GradeRequest,
    service: GradingService = Depends(get_grading_service),
):
    # Resolve project_id from version_id
    version = service.submission_repo.get_document_version_by_id(request.document_version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Document version not found")
    submission = service.submission_repo.get_submission_by_id(version.submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return await _perform_grading(
        service=service,
        project_id=submission.project_id,
        document_version_id=request.document_version_id,
        prompt_level=request.prompt_level,
        rubric_version=request.rubric_version,
        evaluation_set_id=request.evaluation_set_id,
        force=request.force
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
