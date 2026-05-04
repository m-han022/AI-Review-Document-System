import os
from app.celery_app import celery_app
from app.database import engine
from sqlmodel import Session
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.grading_service import GradingService
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@celery_app.task(name="app.tasks.grade_document_version_task")
def grade_document_version_task(
    project_id: str,
    document_version_id: int,
    grading_run_id: int,
    prompt_level: str = "medium",
    rubric_version: str | None = None,
    force: bool = False
):
    logger.info(f"Starting grading task for project {project_id}, version {document_version_id}, run {grading_run_id}")
    
    with Session(engine) as session:
        sub_repo = SubmissionRepository(session)
        grading_repo = GradingRepository(session)
        service = GradingService(sub_repo, grading_repo)
        
        try:
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
                force=force,
                existing_run_id=grading_run_id
            )
            logger.info(f"Grading task completed for project {project_id}")
            return {"status": "success", "project_id": project_id}
            
        except Exception as e:
            logger.error(f"Grading task failed for project {project_id}: {str(e)}")
            return {"status": "failed", "error": str(e)}
