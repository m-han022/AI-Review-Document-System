from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from app.storage import store
from app.models import GradeResponse, GradeAllResult, GradeJobResponse, LanguageCode, GradeRequest, SubmissionDocumentVersion, Submission
from app.services.grading_engine import build_grading_signature, grade_submission
from app.services.grading_jobs import grade_job_store
from sqlmodel import Session
from app.database import engine

router = APIRouter()


async def _perform_grading(
    project_id: str,
    document_version_id: int | None = None,
    prompt_level: str = "medium",
    rubric_version: str | None = None,
    force: bool = False,
) -> GradeResponse:
    submission = store.get(project_id)
    if not submission:
        raise HTTPException(
            status_code=404,
            detail=f"Project not found: {project_id}",
        )

    document_version = store.get_document_version(project_id, document_version_id=document_version_id)
    if not document_version:
        raise HTTPException(status_code=404, detail="Document version not found")
    document = store.get_document_for_version(document_version.id or 0)
    document_type = document.document_type if document else getattr(submission, "document_type", None)

    document_language = document_version.language

    current_signature = build_grading_signature(
        text=document_version.extracted_text,
        language=document_language,
        document_type=document_type,
        rubric_version=rubric_version,
        document_version_id=document_version.id,
        prompt_level=prompt_level,
    )

    # Skip API call only when the stored grading signature still matches the current one.
    matching_run = None if force else store.find_matching_run(project_id, current_signature)
    if matching_run is not None and matching_run.score is not None:
        print(f"[Grade] Project {project_id} matched cached signature, appending a new grading run")
        now = datetime.now(timezone.utc).isoformat()
        submission = store.append_cached_grading_run(
            project_id,
            matching_run.id,
            started_at=now,
            graded_at=now,
        )
        latest_run = submission.latest_run
        if latest_run is None:
            raise HTTPException(status_code=500, detail="Cached grading run was not saved")
        return GradeResponse(
            project_id=project_id,
            project_name=submission.project_name,
            run_id=latest_run.id,
            score=latest_run.score,
            document_version_id=latest_run.document_version_id,
            document_version=latest_run.document_version,
            rubric_version=latest_run.rubric_version,
            rubric_hash=latest_run.rubric_hash,
            gemini_model=latest_run.gemini_model,
            prompt_version=latest_run.prompt_version,
            prompt_level=latest_run.prompt_level,
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
            graded_at=latest_run.graded_at or now,
            language=document_language,
        )

    started_at = datetime.now(timezone.utc).isoformat()
    try:
        result = grade_submission(
            document_version.extracted_text,
            document_language,
            document_type,
            rubric_version=rubric_version,
            document_version_id=document_version.id,
            prompt_level=prompt_level,
            use_cache=not force,
            refresh_cache=force,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API call failed: {str(e)}",
        )

    graded_at = datetime.now(timezone.utc).isoformat()
    submission = store.save_grading_result(project_id, result, started_at=started_at, graded_at=graded_at)
    latest_run = submission.latest_run
    if latest_run is None:
        raise HTTPException(status_code=500, detail="Grading run was not saved")

    return GradeResponse(
        project_id=project_id,
        project_name=submission.project_name,
        run_id=latest_run.id,
        score=result["score"],
        document_version_id=latest_run.document_version_id,
        document_version=latest_run.document_version,
        rubric_version=latest_run.rubric_version,
        rubric_hash=latest_run.rubric_hash,
        gemini_model=latest_run.gemini_model,
        prompt_version=latest_run.prompt_version,
        prompt_level=latest_run.prompt_level,
        policy_version=latest_run.policy_version,
        policy_hash=latest_run.policy_hash,
        required_rule_hash=latest_run.required_rule_hash,
        prompt_hash=latest_run.prompt_hash,
        criteria_hash=latest_run.criteria_hash,
        grading_schema_version=latest_run.grading_schema_version,
        criteria_scores=result["criteria_scores"],
        criteria_suggestions=result.get("criteria_suggestions", {}),
        draft_feedback=result["draft_feedback"],
        slide_reviews=latest_run.slide_reviews,
        graded_at=latest_run.graded_at or graded_at,
        language=document_language,
    )


@router.post("/grade/{project_id}", response_model=GradeResponse)
async def grade_single(
    project_id: str,
    ui_language: LanguageCode = Query(default="ja", alias="language", description="UI language (not used for grading)"),
    force: bool = Query(default=False, description="Force regrading even if a cached result exists"),
    rubric_version: str | None = Query(default=None, description="Rubric version to use for this grading run"),
    document_version_id: int | None = Query(default=None, description="Document version id to grade. Defaults to latest."),
    prompt_level: str = Query(default="medium", description="PMO prompt level: low, medium, high"),
):
    """Legacy grading API for backward compatibility"""
    return await _perform_grading(
        project_id=project_id,
        document_version_id=document_version_id,
        prompt_level=prompt_level,
        rubric_version=rubric_version,
        force=force
    )


@router.post("/grade", response_model=GradeResponse)
async def grade_version(request: GradeRequest):
    """New grading API that uses document_version_id as primary input"""
    with Session(engine) as session:
        v = session.get(SubmissionDocumentVersion, request.document_version_id)
        if not v:
            raise HTTPException(status_code=404, detail="Document version not found")
        sub = session.get(Submission, v.submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Project not found")
        project_id = sub.project_id

    return await _perform_grading(
        project_id=project_id,
        document_version_id=request.document_version_id,
        prompt_level=request.prompt_level,
        rubric_version=request.rubric_version,
        force=request.force
    )


@router.post("/grade-all", response_model=GradeJobResponse)
async def grade_all(
    background_tasks: BackgroundTasks,
    ui_language: LanguageCode = Query(default="ja", alias="language", description="UI language (not used for grading)"),
    force: bool = Query(default=False, description="Force regrading for all submissions, including already graded ones"),
    rubric_version: str | None = Query(default=None, description="Rubric version to use for all grading runs"),
    prompt_level: str = Query(default="medium", description="PMO prompt level: low, medium, high"),
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
