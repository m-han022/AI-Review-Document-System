from __future__ import annotations
from typing import Any, Optional
from sqlmodel import Session, col, select, func
from app.database import engine
from app.models import (
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
    SubmissionContent,
    GradingRun,
    GradingCriteriaResult,
    GradingSlideReview,
)

class SubmissionRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_submission(self, project_id: str) -> Optional[Submission]:
        return self.session.exec(select(Submission).where(Submission.project_id == project_id)).first()

    def get_submission_by_id(self, submission_id: int) -> Optional[Submission]:
        return self.session.get(Submission, submission_id)

    def list_submissions(self, limit: int = 100, offset: int = 0) -> list[Submission]:
        statement = select(Submission).order_by(col(Submission.uploaded_at).desc()).offset(offset).limit(limit)
        return list(self.session.exec(statement).all())

    def count_submissions(self) -> int:
        return self.session.exec(select(func.count()).select_from(Submission)).one()

    def count_ungraded_submissions(self) -> int:
        return self.session.exec(
            select(func.count()).select_from(Submission).where(Submission.latest_grading_run_id == None)
        ).one()

    def get_latest_document_version(self, submission_id: int) -> Optional[SubmissionDocumentVersion]:
        return self.session.exec(
            select(SubmissionDocumentVersion)
            .where(
                SubmissionDocumentVersion.submission_id == submission_id,
                SubmissionDocumentVersion.is_latest == True,
            )
            .order_by(col(SubmissionDocumentVersion.id).desc())
        ).first()

    def get_latest_document_version_by_project(self, project_id: str) -> Optional[SubmissionDocumentVersion]:
        submission = self.get_submission(project_id)
        if not submission:
            return None
        return self.get_latest_document_version(submission.id or 0)

    def get_document_for_version(self, version: SubmissionDocumentVersion) -> Optional[SubmissionDocument]:
        if version.document_id is None:
            return None
        return self.session.get(SubmissionDocument, version.document_id)

    def list_documents(self, submission_id: int) -> list[SubmissionDocument]:
        return list(self.session.exec(
            select(SubmissionDocument)
            .where(SubmissionDocument.submission_id == submission_id)
            .order_by(col(SubmissionDocument.updated_at).desc(), col(SubmissionDocument.id).desc())
        ).all())

    def list_document_versions(self, submission_id: int) -> list[SubmissionDocumentVersion]:
        return list(self.session.exec(
            select(SubmissionDocumentVersion)
            .where(SubmissionDocumentVersion.submission_id == submission_id)
            .order_by(col(SubmissionDocumentVersion.id).desc())
        ).all())

    def get_document_by_id(self, document_id: int) -> Optional[SubmissionDocument]:
        return self.session.get(SubmissionDocument, document_id)

    def get_document_version_by_id(self, version_id: int) -> Optional[SubmissionDocumentVersion]:
        return self.session.get(SubmissionDocumentVersion, version_id)

    def list_versions_by_document(self, document_id: int) -> list[SubmissionDocumentVersion]:
        return list(self.session.exec(
            select(SubmissionDocumentVersion)
            .where(SubmissionDocumentVersion.document_id == document_id)
            .order_by(col(SubmissionDocumentVersion.id).desc())
        ).all())

    def add(self, entity: Any):
        self.session.add(entity)

    def commit(self):
        self.session.commit()

    def refresh(self, entity: Any):
        self.session.refresh(entity)
