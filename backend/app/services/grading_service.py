from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Any, Optional

from app.models import (
    GradingRun,
    GradingCriteriaResult,
    GradingSlideReview,
)
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.grading_engine import build_grading_signature, grade_submission, GRADING_SCHEMA_VERSION
from app.services.issue_analytics import issue_breakdown

class GradingService:
    def __init__(
        self, 
        submission_repo: SubmissionRepository, 
        grading_repo: GradingRepository
    ):
        self.submission_repo = submission_repo
        self.grading_repo = grading_repo

    def create_pending_run(
        self, 
        submission_id: int, 
        document_version_id: int,
        document_version: str,
        rubric_version: str,
        prompt_level: str,
        content_hash: str
    ) -> GradingRun:
        run = GradingRun(
            submission_id=submission_id,
            document_version_id=document_version_id,
            document_version=document_version,
            rubric_version=rubric_version,
            prompt_level=prompt_level,
            content_hash=content_hash,
            status="PENDING",
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        self.grading_repo.add(run)
        self.grading_repo.commit()
        self.grading_repo.refresh(run)
        return run

    def update_status(self, run_id: int, status: str, error_message: Optional[str] = None):
        run = self.grading_repo.get_grading_run(run_id)
        if run:
            run.status = status
            if error_message:
                run.error_message = error_message
            if status == "COMPLETED" or status == "FAILED":
                run.graded_at = datetime.now(timezone.utc).isoformat()
            self.grading_repo.add(run)
            self.grading_repo.commit()

    def run_grading(
        self, 
        project_id: str,
        document_version_id: int,
        prompt_level: str = "medium",
        rubric_version: Optional[str] = None,
        evaluation_set_id: Optional[int] = None,
        force: bool = False,
        existing_run_id: Optional[int] = None
    ) -> dict[str, Any]:
        # 1. Fetch data
        submission = self.submission_repo.get_submission(project_id)
        if not submission:
            raise ValueError(f"Project not found: {project_id}")
        
        version = self.submission_repo.get_document_version_by_id(document_version_id)
        if not version or version.submission_id != submission.id:
            raise ValueError(f"Document version not found: {document_version_id}")

        # 2. Build signature and check cache
        signature = build_grading_signature(
            text=version.extracted_text,
            language=version.language,
            document_type=self.submission_repo.get_document_for_version(version).document_type if version.document_id else "project-review",
            rubric_version=rubric_version,
            document_version_id=version.id,
            prompt_level=prompt_level,
            evaluation_set_id=evaluation_set_id,
            project_description=submission.project_description
        )

        if not force:
            cached_run = self.grading_repo.find_matching_run(submission.id, signature)
            if cached_run:
                # Reuse cached results by creating a new run record (audit trail)
                return self._reuse_cached_run(submission.id, version, cached_run)

        # 3. Create or fetch run
        if existing_run_id:
            run = self.grading_repo.get_grading_run(existing_run_id)
            if not run:
                raise ValueError(f"Grading run not found: {existing_run_id}")
            # Ensure the run metadata matches (idempotency check)
            run.status = "PENDING"
            self.grading_repo.add(run)
            self.grading_repo.commit()
        else:
            run = self.create_pending_run(
                submission_id=submission.id,
                document_version_id=version.id,
                document_version=version.document_version,
                rubric_version=signature["rubric_version"],
                prompt_level=prompt_level,
                content_hash=version.content_hash
            )

        try:
            # 4. Extracting (already done during upload, but we mark the state)
            self.update_status(run.id, "EXTRACTING")
            
            # 5. Grading with Retry
            self.update_status(run.id, "GRADING")
            
            @retry(
                stop=stop_after_attempt(3),
                wait=wait_exponential(multiplier=1, min=2, max=10),
                retry=retry_if_exception_type((Exception)), # We can refine this to specific Gemini errors if needed
                reraise=True
            )
            def _grade_with_retry():
                return grade_submission(
                    text=version.extracted_text,
                    language=version.language,
                    document_type=signature["document_type"],
                    rubric_version=signature["rubric_version"],
                    document_version_id=version.id,
                    prompt_level=signature["prompt_level"],
                    evaluation_set_id=evaluation_set_id,
                    project_description=submission.project_description,
                    use_cache=False
                )

            result_data = _grade_with_retry()

            # 6. Save results
            self._save_grading_results(run, result_data)
            
            # Update submission latest run
            submission.latest_grading_run_id = run.id
            submission.status = "graded"
            self.submission_repo.add(submission)
            self.submission_repo.commit()

            return result_data

        except Exception as e:
            self.update_status(run.id, "FAILED", str(e))
            # Even on failure, we want to track this as the latest run for the project
            submission.latest_grading_run_id = run.id
            self.submission_repo.add(submission)
            self.submission_repo.commit()
            raise

    def _save_grading_results(self, run: GradingRun, result_data: dict[str, Any]):
        run.score = result_data["score"]
        run.total_score = result_data["total_score"]
        run.rubric_hash = result_data["rubric_hash"]
        run.gemini_model = result_data["gemini_model"]
        run.prompt_version = result_data["prompt_version"]
        run.prompt_level = result_data["prompt_level"]
        run.policy_version = result_data["policy_version"]
        run.policy_hash = result_data["policy_hash"]
        run.required_rule_set_id = result_data.get("required_rule_set_id")
        run.required_rule_hash = result_data["required_rule_hash"]
        run.prompt_hash = result_data["prompt_hash"]
        run.criteria_hash = result_data["criteria_hash"]
        run.grading_schema_version = result_data["grading_schema_version"]
        run.project_description_hash = result_data.get("project_description_hash")
        run.final_prompt_snapshot = result_data.get("final_prompt_snapshot")
        run.evaluation_set_id = result_data.get("evaluation_set_id")
        run.draft_feedback = result_data["draft_feedback"]
        run.status = "COMPLETED"
        run.graded_at = datetime.now(timezone.utc).isoformat()
        
        self.grading_repo.add(run)
        
        # Save criteria
        scores = result_data["criteria_scores"]
        suggestions = result_data["criteria_suggestions"]
        # In this system, max_scores might be needed. We can get them from engine or just trust result_data if it had them.
        # Actually criteria_scores is a dict {key: score}
        # We need max_scores to fulfill GradingCriteriaResult
        from app.services.grading_engine import _get_criteria_config
        _, max_scores = _get_criteria_config(result_data.get("document_type"), result_data["rubric_version"])

        for key, score in scores.items():
            criterion = GradingCriteriaResult(
                grading_run_id=run.id,
                criterion_key=key,
                score=score,
                max_score=max_scores.get(key, 0.0),
                suggestion=suggestions.get("vi", {}).get(key, "") or suggestions.get("ja", {}).get(key, "") 
                if isinstance(suggestions, dict) else None
            )
            # Handle bilingual suggestions if needed, but the model has Optional[Dict[str, Any]] for suggestion
            # Let's check model again. 135: suggestion: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
            criterion.suggestion = {
                "vi": suggestions.get("vi", {}).get(key, "") if isinstance(suggestions, dict) else "",
                "ja": suggestions.get("ja", {}).get(key, "") if isinstance(suggestions, dict) else ""
            }
            self.grading_repo.add(criterion)

        # Save slide reviews
        for rev in result_data["slide_reviews"]:
            slide_review = GradingSlideReview(
                grading_run_id=run.id,
                slide_number=rev["slide_number"],
                status=rev["status"],
                title=rev["title"],
                summary=rev["summary"],
                issues=rev["issues"],
                suggestions=rev["suggestions"],
                created_at=run.graded_at
            )
            self.grading_repo.add(slide_review)

        self.grading_repo.commit()

    def _reuse_cached_run(self, submission_id: int, version: SubmissionDocumentVersion, cached_run: GradingRun) -> dict[str, Any]:
        # Implementation similar to append_cached_grading_run but using the new service structure
        # We create a new run record that points to the same results
        now = datetime.now(timezone.utc).isoformat()
        new_run = GradingRun(
            submission_id=submission_id,
            document_version_id=version.id,
            document_version=version.document_version,
            rubric_id=cached_run.rubric_id,
            rubric_version=cached_run.rubric_version,
            rubric_hash=cached_run.rubric_hash,
            gemini_model=cached_run.gemini_model,
            prompt_version=cached_run.prompt_version,
            prompt_level=cached_run.prompt_level,
            policy_version=cached_run.policy_version,
            policy_hash=cached_run.policy_hash,
            required_rule_set_id=cached_run.required_rule_set_id,
            required_rule_hash=cached_run.required_rule_hash,
            prompt_hash=cached_run.prompt_hash,
            criteria_hash=cached_run.criteria_hash,
            grading_schema_version=cached_run.grading_schema_version,
            project_description_hash=cached_run.project_description_hash,
            final_prompt_snapshot=cached_run.final_prompt_snapshot,
            evaluation_set_id=cached_run.evaluation_set_id,
            score=cached_run.score,
            total_score=cached_run.total_score,
            draft_feedback=cached_run.draft_feedback,
            status="COMPLETED",
            content_hash=cached_run.content_hash,
            started_at=now,
            graded_at=now,
        )
        self.grading_repo.add(new_run)
        self.grading_repo.commit()
        self.grading_repo.refresh(new_run)

        # Copy criteria results
        old_criteria = self.grading_repo.get_criteria_results(cached_run.id)
        for item in old_criteria:
            self.grading_repo.add(GradingCriteriaResult(
                grading_run_id=new_run.id,
                criterion_key=item.criterion_key,
                score=item.score,
                max_score=item.max_score,
                suggestion=item.suggestion,
            ))

        # Copy slide reviews
        old_slides = self.grading_repo.get_slide_reviews(cached_run.id)
        for item in old_slides:
            self.grading_repo.add(GradingSlideReview(
                grading_run_id=new_run.id,
                slide_number=item.slide_number,
                status=item.status,
                title=item.title,
                summary=item.summary,
                issues=item.issues,
                suggestions=item.suggestions,
                created_at=now,
            ))

        # Update submission
        submission = self.submission_repo.get_submission_by_id(submission_id)
        if submission:
            submission.latest_grading_run_id = new_run.id
            submission.status = "graded"
            self.submission_repo.add(submission)
        
        self.grading_repo.commit()

        # Return the data in the format expected by the API
        from app.services.grading_engine import _normalize_criteria_scores, _normalize_slide_reviews
        # We need to rebuild result_data dict
        criteria_scores = {c.criterion_key: c.score for c in self.grading_repo.get_criteria_results(new_run.id)}
        # This is a bit complex to rebuild perfectly without re-running normalization but we can just map it
        return {
            "score": new_run.score,
            "total_score": new_run.total_score,
            "content_hash": new_run.content_hash,
            "document_version_id": new_run.document_version_id,
            "rubric_version": new_run.rubric_version,
            "rubric_hash": new_run.rubric_hash,
            "gemini_model": new_run.gemini_model,
            "prompt_version": new_run.prompt_version,
            "prompt_level": new_run.prompt_level,
            "policy_version": new_run.policy_version,
            "policy_hash": new_run.policy_hash,
            "required_rule_hash": new_run.required_rule_hash,
            "prompt_hash": new_run.prompt_hash,
            "criteria_hash": new_run.criteria_hash,
            "grading_schema_version": new_run.grading_schema_version,
            "final_prompt_snapshot": new_run.final_prompt_snapshot,
            "evaluation_set_id": new_run.evaluation_set_id,
            "criteria_scores": criteria_scores,
            # For simplicity, I'll return the full run detail if needed or just minimal for now
            # The grade_submission return format is what we want
            "draft_feedback": new_run.draft_feedback,
            "slide_reviews": [
                {
                    "slide_number": s.slide_number,
                    "status": s.status,
                    "title": s.title,
                    "summary": s.summary,
                    "issues": s.issues,
                    "suggestions": s.suggestions
                } for s in self.grading_repo.get_slide_reviews(new_run.id)
            ]
        }
