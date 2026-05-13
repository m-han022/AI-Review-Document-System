from app.celery_app import celery_app
from app.database import engine
from sqlmodel import Session
from datetime import datetime
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.grading_service import GradingService
from app.services.gemini_manager import GeminiRateLimitError
from app.metrics import inc_counter, observe_queue_delay_seconds
from app.observability import log_error, log_event, set_request_id

@celery_app.task(
    bind=True,
    name="app.tasks.grade_document_version_task",
    autoretry_for=(Exception,),
    retry_backoff=5,
    retry_kwargs={"max_retries": 3},
)
def grade_document_version_task(
    self,
    project_id: str,
    document_version_id: int,
    grading_run_id: int,
    prompt_level: str = "medium",
    rubric_version: str | None = None,
    evaluation_set_id: int | None = None,
    force: bool = False,
    request_id: str | None = None,
):
    set_request_id(request_id)
    current_retry = int(getattr(self.request, "retries", 0))
    log_event(
        "grading_started",
        project_id=project_id,
        document_version_id=document_version_id,
        grading_run_id=grading_run_id,
        evaluation_set_id=evaluation_set_id,
        retry_count=current_retry,
    )
    
    with Session(engine) as session:
        sub_repo = SubmissionRepository(session)
        grading_repo = GradingRepository(session)
        service = GradingService(sub_repo, grading_repo)
        version = sub_repo.get_document_version_by_id(document_version_id)
        doc = sub_repo.get_document_for_version(version) if version else None
        document_type = doc.document_type if doc and doc.document_type else "project-review"
        if current_retry > 0:
            inc_counter(
                "grading_retry_total",
                document_type=document_type,
                prompt_level=prompt_level,
                status="RETRY",
            )
        
        try:
            run = grading_repo.get_grading_run(grading_run_id)
            if run and run.started_at:
                try:
                    started_at = run.started_at.replace("Z", "+00:00")
                    queue_delay = max(0.0, (datetime.now().astimezone() - datetime.fromisoformat(started_at)).total_seconds())
                    observe_queue_delay_seconds(
                        queue_delay,
                        document_type=document_type,
                        prompt_level=prompt_level,
                    )
                except ValueError:
                    log_event(
                        "queue_delay_parse_skipped",
                        grading_run_id=grading_run_id,
                        started_at=run.started_at,
                    )

            # The GradingService.run_grading method already handles:
            # - Fetching data
            # - Cache checking (if not force)
            # - PENDING run creation (Wait, run_grading creates its own run)
            # - Status updates (EXTRACTING, GRADING, COMPLETED, FAILED)
            # - Saving results
            
            # Since we want to create PENDING status in the API, 
            # maybe we should modify run_grading to accept an existing run_id 
            # or just let it do its thing.
            # But the user asked for: 
            # "tạo GradingRun với status PENDING" in API
            # "Task nhận grading_run_id cụ thể"
            
            result = service.run_grading(
                project_id=project_id,
                document_version_id=document_version_id,
                prompt_level=prompt_level,
                rubric_version=rubric_version,
                evaluation_set_id=evaluation_set_id,
                force=force,
                existing_run_id=grading_run_id
            )
            log_event(
                "grading_completed",
                project_id=project_id,
                document_version_id=document_version_id,
                grading_run_id=grading_run_id,
            )
            return {"status": "success", "project_id": project_id}
            
        except GeminiRateLimitError as e:
            log_event(
                "grading_task_retry_scheduled_rate_limit",
                project_id=project_id,
                document_version_id=document_version_id,
                grading_run_id=grading_run_id,
                retry_in_seconds=60,
                detail=str(e),
            )
            raise self.retry(exc=e, countdown=60)
        except Exception as e:
            log_error(
                "grading_task_failed",
                error_code="GRADING_TASK_FAILED",
                project_id=project_id,
                document_version_id=document_version_id,
                grading_run_id=grading_run_id,
                detail=str(e),
            )
            raise
