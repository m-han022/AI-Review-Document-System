from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from app.storage import store
from app.models import GradeResponse, GradeAllResult, GradeJobResponse, LanguageCode
from app.services.grading_engine import build_grading_signature, grade_submission
from app.services.grading_jobs import grade_job_store

router = APIRouter()


@router.post("/grade/{project_id}", response_model=GradeResponse)
async def grade_single(
    project_id: str,
    ui_language: LanguageCode = Query(default="ja", alias="language", description="UI language (not used for grading)"),
    force: bool = Query(default=False, description="Force regrading even if a cached result exists"),
    rubric_version: str | None = Query(default=None, description="Rubric version to use for this grading run"),
):
    submission = store.get(project_id)
    if not submission:
        raise HTTPException(
            status_code=404,
            detail=f"Project not found: {project_id}",
        )

    document_language = submission.language

    current_signature = build_grading_signature(
        text=submission.extracted_text,
        language=document_language,
        document_type=getattr(submission, "document_type", None),
        rubric_version=rubric_version,
    )

    # Skip API call only when the stored grading signature still matches the current one.
    if (
        not force
        and submission.latest_run is not None
        and submission.latest_run.score is not None
        and submission.content_hash == current_signature["content_hash"]
        and submission.latest_run.rubric_version == current_signature["rubric_version"]
        and submission.latest_run.gemini_model == current_signature["gemini_model"]
        and submission.latest_run.prompt_hash == current_signature["prompt_hash"]
        and submission.latest_run.criteria_hash == current_signature["criteria_hash"]
        and submission.latest_run.grading_schema_version == current_signature["grading_schema_version"]
        and submission.latest_run.slide_reviews is not None  # [FIX LOGIC-01] [] is valid, use identity check
    ):
        print(f"[Grade] Project {project_id} already graded with matching signature, skipping API call")
        latest_run = submission.latest_run
        return GradeResponse(
            project_id=project_id,
            project_name=submission.project_name,
            run_id=latest_run.id,
            score=latest_run.score,
            rubric_version=latest_run.rubric_version,
            gemini_model=latest_run.gemini_model,
            prompt_hash=latest_run.prompt_hash,
            criteria_hash=latest_run.criteria_hash,
            grading_schema_version=latest_run.grading_schema_version,
            criteria_scores={item.key: item.score for item in latest_run.criteria_results},
            criteria_suggestions={
                item.key: item.suggestion for item in latest_run.criteria_results if item.suggestion is not None
            },
            draft_feedback=latest_run.draft_feedback,
            slide_reviews=latest_run.slide_reviews,
            graded_at=latest_run.graded_at or datetime.now(timezone.utc).isoformat(),
            language=document_language,
        )

    started_at = datetime.now(timezone.utc).isoformat()
    try:
        result = grade_submission(
            submission.extracted_text,
            document_language,
            getattr(submission, "document_type", None),
            rubric_version=rubric_version,
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
        rubric_version=latest_run.rubric_version,
        gemini_model=latest_run.gemini_model,
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


@router.post("/grade-all", response_model=GradeJobResponse)
async def grade_all(
    background_tasks: BackgroundTasks,
    ui_language: LanguageCode = Query(default="ja", alias="language", description="UI language (not used for grading)"),
    force: bool = Query(default=False, description="Force regrading for all submissions, including already graded ones"),
    rubric_version: str | None = Query(default=None, description="Rubric version to use for all grading runs"),
):
    project_ids = store.get_all_project_ids() if force else store.get_ungraded_project_ids()
    job = grade_job_store.create_job(project_ids, force=force, rubric_version=rubric_version)
    background_tasks.add_task(grade_job_store.run_grade_all_job, job.job_id)
    return job


@router.get("/grade-jobs/{job_id}", response_model=GradeJobResponse)
async def get_grade_job(job_id: str):
    job = grade_job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Grade job not found: {job_id}")
    return job
