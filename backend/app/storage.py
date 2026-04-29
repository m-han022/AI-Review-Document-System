from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Optional

from sqlmodel import Session, col, delete, func, select

from app.config import UPLOADS_DIR
from app.database import engine
from app.models import (
    CriteriaResultOut,
    GradingCriteriaResult,
    GradingRun,
    GradingRunOut,
    GradingSlideReview,
    Rubric,
    RubricCriterionRecord,
    SlideReviewOut,
    Submission,
    SubmissionContent,
)


@dataclass
class SubmissionRecord:
    id: int
    project_id: str
    project_name: str
    filename: str
    document_type: str
    language: str
    file_path: str | None
    uploaded_at: str
    status: str
    extracted_text: str
    content_hash: str
    latest_run: GradingRunOut | None = None


class SubmissionStore:
    def _run_out(self, session: Session, run: GradingRun | None) -> GradingRunOut | None:
        if run is None or run.id is None:
            return None

        criteria_statement = (
            select(GradingCriteriaResult)
            .where(GradingCriteriaResult.grading_run_id == run.id)
            .order_by(GradingCriteriaResult.id)
        )
        criteria = session.exec(criteria_statement).all()
        slide_statement = (
            select(GradingSlideReview)
            .where(GradingSlideReview.grading_run_id == run.id)
            .order_by(GradingSlideReview.slide_number)
        )
        slide_reviews = session.exec(slide_statement).all()

        return GradingRunOut(
            id=run.id,
            score=run.score,
            rubric_version=run.rubric_version,
            gemini_model=run.gemini_model,
            prompt_hash=run.prompt_hash,
            criteria_hash=run.criteria_hash,
            grading_schema_version=run.grading_schema_version,
            criteria_results=[
                CriteriaResultOut(
                    key=item.criterion_key,
                    score=item.score,
                    max_score=item.max_score,
                    suggestion=item.suggestion,
                )
                for item in criteria
            ],
            slide_reviews=[
                SlideReviewOut(
                    id=item.id or 0,
                    slide_number=item.slide_number,
                    status="OK" if item.status == "OK" else "NG",
                    title=item.title,
                    summary=item.summary,
                    issues=item.issues,
                    suggestions=item.suggestions,
                )
                for item in slide_reviews
            ],
            draft_feedback=run.draft_feedback,
            status=run.status,
            error_message=run.error_message,
            graded_at=run.graded_at,
        )

    def _to_record(self, session: Session, submission: Submission) -> SubmissionRecord:
        content = session.get(SubmissionContent, submission.id)
        latest_run = session.get(GradingRun, submission.latest_grading_run_id) if submission.latest_grading_run_id else None
        return SubmissionRecord(
            id=submission.id or 0,
            project_id=submission.project_id,
            project_name=submission.project_name,
            filename=submission.filename,
            document_type=submission.document_type,
            language=submission.language,
            file_path=submission.file_path,
            uploaded_at=submission.uploaded_at,
            status=submission.status,
            extracted_text=content.extracted_text if content else "",
            content_hash=content.content_hash if content else "",
            latest_run=self._run_out(session, latest_run),
        )

    def get(self, project_id: str) -> Optional[SubmissionRecord]:
        with Session(engine) as session:
            statement = select(Submission).where(Submission.project_id == project_id)
            submission = session.exec(statement).first()
            return self._to_record(session, submission) if submission else None

    def list(self, limit: int = 100, offset: int = 0) -> tuple[list[SubmissionRecord], int, int]:
        with Session(engine) as session:
            total = session.exec(select(func.count()).select_from(Submission)).one()
            ungraded = session.exec(
                select(func.count()).select_from(Submission).where(Submission.latest_grading_run_id == None)
            ).one()
            statement = (
                select(Submission)
                .order_by(col(Submission.uploaded_at).desc())
                .offset(offset)
                .limit(limit)
            )
            submissions = session.exec(statement).all()
            return [self._to_record(session, item) for item in submissions], int(total), int(ungraded)

    def get_all_for_export(self) -> list[SubmissionRecord]:
        with Session(engine) as session:
            statement = select(Submission).order_by(col(Submission.uploaded_at).desc())
            return [self._to_record(session, item) for item in session.exec(statement).all()]

    def get_ungraded_project_ids(self) -> list[str]:
        with Session(engine) as session:
            statement = select(Submission.project_id).where(Submission.latest_grading_run_id == None)
            return list(session.exec(statement).all())

    def save_upload(
        self,
        *,
        project_id: str,
        project_name: str,
        filename: str,
        document_type: str,
        language: str,
        file_path: str,
        extracted_text: str,
        content_hash: str,
        uploaded_at: str,
    ) -> SubmissionRecord:
        with Session(engine) as session:
            existing = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if existing:
                self._delete_runs_for_submission(session, existing.id or 0)
                existing.project_name = project_name
                existing.filename = filename
                existing.document_type = document_type
                existing.language = language
                existing.file_path = file_path
                existing.uploaded_at = uploaded_at
                existing.status = "uploaded"
                existing.latest_grading_run_id = None
                submission = existing
            else:
                submission = Submission(
                    project_id=project_id,
                    project_name=project_name,
                    filename=filename,
                    document_type=document_type,
                    language=language,
                    file_path=file_path,
                    uploaded_at=uploaded_at,
                    status="uploaded",
                )
                session.add(submission)

            session.commit()
            session.refresh(submission)

            content = session.get(SubmissionContent, submission.id)
            if content:
                content.extracted_text = extracted_text
                content.content_hash = content_hash
            else:
                session.add(
                    SubmissionContent(
                        submission_id=submission.id,
                        extracted_text=extracted_text,
                        content_hash=content_hash,
                    )
                )

            session.commit()
            session.refresh(submission)
            return self._to_record(session, submission)

    def save_grading_result(
        self,
        project_id: str,
        result: dict[str, Any],
        *,
        started_at: str,
        graded_at: str,
    ) -> SubmissionRecord:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if submission is None:
                raise ValueError(f"Project not found: {project_id}")

            rubric = session.exec(
                select(Rubric).where(
                    Rubric.document_type == submission.document_type,
                    Rubric.version == result.get("rubric_version"),
                )
            ).first()

            run = GradingRun(
                submission_id=submission.id,
                rubric_id=rubric.id if rubric else None,
                rubric_version=result.get("rubric_version"),
                gemini_model=result.get("gemini_model"),
                prompt_hash=result.get("prompt_hash"),
                criteria_hash=result.get("criteria_hash"),
                grading_schema_version=result.get("grading_schema_version"),
                score=result.get("score"),
                draft_feedback=result.get("draft_feedback"),
                status="completed",
                content_hash=result.get("content_hash", ""),
                started_at=started_at,
                graded_at=graded_at,
            )
            session.add(run)
            session.commit()
            session.refresh(run)

            max_scores = self._rubric_max_scores(session, rubric.id if rubric else None)
            suggestions = result.get("criteria_suggestions") if isinstance(result.get("criteria_suggestions"), dict) else {}
            scores = result.get("criteria_scores") if isinstance(result.get("criteria_scores"), dict) else {}

            for key, score in scores.items():
                session.add(
                    GradingCriteriaResult(
                        grading_run_id=run.id,
                        criterion_key=key,
                        score=float(score),
                        max_score=float(max_scores.get(key, 100)),
                        suggestion=self._suggestion_for_key(suggestions, key),
                    )
                )

            slide_reviews = result.get("slide_reviews") if isinstance(result.get("slide_reviews"), list) else []
            for item in slide_reviews:
                if not isinstance(item, dict):
                    continue
                slide_number = item.get("slide_number")
                if not isinstance(slide_number, int) or slide_number < 1:
                    continue
                session.add(
                    GradingSlideReview(
                        grading_run_id=run.id,
                        slide_number=slide_number,
                        status="OK" if item.get("status") == "OK" else "NG",
                        title=item.get("title") if isinstance(item.get("title"), dict) else None,
                        summary=item.get("summary") if isinstance(item.get("summary"), dict) else None,
                        issues=item.get("issues") if isinstance(item.get("issues"), dict) else None,
                        suggestions=item.get("suggestions") if isinstance(item.get("suggestions"), dict) else None,
                        created_at=graded_at,
                    )
                )

            submission.latest_grading_run_id = run.id
            submission.status = "graded"
            session.commit()
            session.refresh(submission)
            return self._to_record(session, submission)

    def _rubric_max_scores(self, session: Session, rubric_id: int | None) -> dict[str, float]:
        if rubric_id is None:
            return {}
        criteria = session.exec(
            select(RubricCriterionRecord).where(RubricCriterionRecord.rubric_id == rubric_id)
        ).all()
        return {item.key: item.max_score for item in criteria}

    def _suggestion_for_key(self, suggestions: dict[str, Any], key: str) -> dict[str, Any] | None:
        if "vi" in suggestions or "ja" in suggestions:
            return {
                lang: values.get(key)
                for lang, values in suggestions.items()
                if isinstance(values, dict) and values.get(key) is not None
            }
        value = suggestions.get(key)
        return {"text": value} if value is not None else None

    def _delete_runs_for_submission(self, session: Session, submission_id: int) -> None:
        run_ids = session.exec(select(GradingRun.id).where(GradingRun.submission_id == submission_id)).all()
        for run_id in run_ids:
            session.exec(delete(GradingCriteriaResult).where(GradingCriteriaResult.grading_run_id == run_id))
            session.exec(delete(GradingSlideReview).where(GradingSlideReview.grading_run_id == run_id))
        session.exec(delete(GradingRun).where(GradingRun.submission_id == submission_id))

    def delete(self, project_id: str) -> bool:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if submission is None:
                return False

            filename = submission.filename
            self._delete_runs_for_submission(session, submission.id or 0)
            session.exec(delete(SubmissionContent).where(SubmissionContent.submission_id == submission.id))
            session.delete(submission)
            session.commit()

        candidate_paths = [
            UPLOADS_DIR / filename,
            UPLOADS_DIR / f"{filename}.txt",
        ]
        for file_path in candidate_paths:
            if file_path.exists():
                try:
                    os.remove(file_path)
                except OSError:
                    pass

        return True

    def delete_many(self, project_ids: list[str]) -> dict[str, bool]:
        return {project_id: self.delete(project_id) for project_id in project_ids}


store = SubmissionStore()
