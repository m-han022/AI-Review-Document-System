from __future__ import annotations
from typing import Any, Optional
from sqlmodel import Session, col, select, func
from app.models import (
    GradingRun,
    GradingCriteriaResult,
    GradingSlideReview,
)

class GradingRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_grading_run(self, run_id: int) -> Optional[GradingRun]:
        return self.session.get(GradingRun, run_id)

    def list_grading_runs(self, submission_id: int, limit: int = 100) -> list[GradingRun]:
        statement = (
            select(GradingRun)
            .where(GradingRun.submission_id == submission_id)
            .order_by(col(GradingRun.graded_at).desc(), col(GradingRun.id).desc())
            .limit(limit)
        )
        return list(self.session.exec(statement).all())

    def get_criteria_results(self, run_id: int) -> list[GradingCriteriaResult]:
        statement = (
            select(GradingCriteriaResult)
            .where(GradingCriteriaResult.grading_run_id == run_id)
            .order_by(GradingCriteriaResult.id)
        )
        return list(self.session.exec(statement).all())

    def get_slide_reviews(self, run_id: int) -> list[GradingSlideReview]:
        statement = (
            select(GradingSlideReview)
            .where(GradingSlideReview.grading_run_id == run_id)
            .order_by(GradingSlideReview.slide_number)
        )
        return list(self.session.exec(statement).all())

    def get_criteria_counts(self, run_ids: list[int]) -> dict[int, int]:
        if not run_ids:
            return {}
        rows = self.session.exec(
            select(GradingCriteriaResult.grading_run_id, func.count().label("cnt"))
            .where(col(GradingCriteriaResult.grading_run_id).in_(run_ids))
            .group_by(GradingCriteriaResult.grading_run_id)
        ).all()
        return {row[0]: row[1] for row in rows}

    def get_all_slides_for_runs(self, run_ids: list[int]) -> list[GradingSlideReview]:
        if not run_ids:
            return []
        return list(self.session.exec(
            select(GradingSlideReview)
            .where(col(GradingSlideReview.grading_run_id).in_(run_ids))
        ).all())

    def find_matching_run(self, submission_id: int, signature: dict[str, Any]) -> Optional[GradingRun]:
        statement = (
            select(GradingRun)
            .where(
                GradingRun.submission_id == submission_id,
                GradingRun.status == "COMPLETED",
                GradingRun.graded_at != None,
                GradingRun.content_hash == signature.get("content_hash"),
                GradingRun.rubric_version == signature.get("rubric_version"),
                GradingRun.rubric_hash == signature.get("rubric_hash"),
                GradingRun.criteria_hash == signature.get("criteria_hash"),
                GradingRun.prompt_version == signature.get("prompt_version"),
                GradingRun.prompt_level == signature.get("prompt_level"),
                GradingRun.prompt_hash == signature.get("prompt_hash"),
                GradingRun.policy_version == signature.get("policy_version"),
                GradingRun.policy_hash == signature.get("policy_hash"),
                GradingRun.required_rule_hash == signature.get("required_rule_hash"),
                GradingRun.gemini_model == signature.get("gemini_model"),
                GradingRun.grading_schema_version == signature.get("grading_schema_version"),
                GradingRun.project_description_hash == signature.get("project_description_hash"),
            )
            .order_by(col(GradingRun.graded_at).desc(), col(GradingRun.id).desc())
        )
        return self.session.exec(statement).first()
    
    def get_latest_completed_run(self, document_version_id: int) -> Optional[GradingRun]:
        statement = (
            select(GradingRun)
            .where(
                GradingRun.document_version_id == document_version_id, 
                col(GradingRun.status).in_(["COMPLETED", "completed"]),
                GradingRun.graded_at != None
            )
            .order_by(col(GradingRun.graded_at).desc(), col(GradingRun.id).desc())
        )
        return self.session.exec(statement).first()

    def add(self, entity: Any):
        self.session.add(entity)

    def commit(self):
        self.session.commit()

    def refresh(self, entity: Any):
        self.session.refresh(entity)
