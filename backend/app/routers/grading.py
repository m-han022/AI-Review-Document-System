from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Depends
from app.storage import store
from app.models import GradeResponse, GradeRequest, SubmissionDocumentVersion, Submission, EvaluationSet, Rubric, PromptVersion, EvaluationPolicy
from app.database import engine, get_session
from app.config import settings
from app.tasks import grade_document_version_task
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.grading_service import GradingService
from app.services.prompt_composer import get_active_required_rule_set
from app.services.prompt_policy import normalize_prompt_level, _now, get_active_policy, get_active_prompt_version
from sqlmodel import Session, select

router = APIRouter()

def get_grading_service(session: Session = Depends(get_session)) -> GradingService:
    sub_repo = SubmissionRepository(session)
    grading_repo = GradingRepository(session)
    return GradingService(sub_repo, grading_repo)

def _archive_active_sets(session: Session, document_type: str, level: str) -> None:
    rows = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == level,
            EvaluationSet.status == "active",
        )
    ).all()
    for row in rows:
        row.status = "archived"

def _ensure_active_evaluation_set(session: Session, document_type: str, level: str) -> EvaluationSet | None:
    lvl = normalize_prompt_level(level)
    active_set = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == lvl,
            EvaluationSet.status == "active",
        )
    ).first()
    if active_set:
        return active_set

    rubric = session.exec(
        select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
    ).first()
    if not rubric:
        # Backward-compatible fallback: allow grading to continue without evaluation set binding
        # if this scope has not been configured yet.
        return None

    prompt = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == lvl,
            PromptVersion.status == "active",
        )
    ).first() or get_active_prompt_version(document_type, lvl)
    policy = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == lvl, EvaluationPolicy.status == "active")
    ).first() or get_active_policy(lvl)

    rule_set = get_active_required_rule_set(session)
    _archive_active_sets(session, document_type, lvl)
    created = EvaluationSet(
        name=f"{document_type}-{lvl}-set-auto",
        document_type=document_type,
        level=lvl,
        rubric_version_id=rubric.id or 0,
        prompt_version_id=prompt.id or 0,
        policy_version_id=policy.id or 0,
        required_rule_set_id=rule_set.id,
        required_rules_version=rule_set.version,
        required_rule_hash=rule_set.hash,
        version_label=f"{document_type}-{lvl}-set-auto",
        status="active",
        created_at=_now(),
    )
    session.add(created)
    session.commit()
    session.refresh(created)
    return created

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
        resolved_version = service.submission_repo.get_document_version_by_id(document_version_id)
        if not resolved_version:
            raise HTTPException(status_code=404, detail=f"Version not found: {document_version_id}")
        resolved_doc = service.submission_repo.get_document_for_version(resolved_version)
        resolved_document_type = resolved_doc.document_type if resolved_doc else "project-review"

        if evaluation_set_id is not None:
            eval_set = service.submission_repo.session.get(EvaluationSet, evaluation_set_id)
            if not eval_set:
                raise HTTPException(status_code=422, detail=f"Invalid evaluation_set_id: {evaluation_set_id} (not found)")
            if eval_set.status != "active":
                raise HTTPException(status_code=422, detail=f"Invalid evaluation_set_id: {evaluation_set_id} (status must be active)")
            if eval_set.document_type != resolved_document_type:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Invalid evaluation_set_id: {evaluation_set_id} "
                        f"(document_type mismatch: expected '{resolved_document_type}', got '{eval_set.document_type}')"
                    ),
                )
        else:
            # Auto-ensure active evaluation set for this scope to keep review flow zero-config for end users.
            auto_set = _ensure_active_evaluation_set(
                service.submission_repo.session,
                resolved_document_type,
                prompt_level,
            )
            evaluation_set_id = auto_set.id if auto_set else None

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
        raise HTTPException(status_code=422, detail=str(e))
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
