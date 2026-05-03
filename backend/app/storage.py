from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from sqlmodel import Session, col, delete, func, select

from app.config import UPLOADS_DIR
from app.database import engine
from app.models import (
    CriteriaResultOut,
    DocumentOut,
    DocumentVersionOut,
    GradingCriteriaResult,
    GradingRun,
    GradingRunDetailOut,
    GradingRunHistoryOut,
    GradingRunOut,
    GradingSlideReview,
    Rubric,
    RubricCriterionRecord,
    SlideReviewOut,
    Submission,
    SubmissionContent,
    SubmissionDocument,
    SubmissionDocumentVersion,
    SubmissionOut,
)
from app.services.issue_analytics import issue_breakdown, issue_count


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
    project_description: str | None = None
    latest_document_id: int | None = None
    latest_document_name: str | None = None
    latest_document_version_id: int | None = None
    latest_document_version: str | None = None
    latest_run: GradingRunOut | None = None
    run_history: list[GradingRunHistoryOut] | None = None


class SubmissionStore:

    def _document_out(self, document: SubmissionDocument | None) -> DocumentOut | None:
        if document is None or document.id is None:
            return None
        return DocumentOut(
            id=document.id,
            submission_id=document.submission_id,
            document_type=document.document_type,
            document_name=document.document_name,
            created_at=document.created_at,
            updated_at=document.updated_at,
            is_latest=bool(document.is_latest),
        )

    def _document_version_out(
        self,
        version: SubmissionDocumentVersion | None,
        document: SubmissionDocument | None = None,
    ) -> DocumentVersionOut | None:
        if version is None or version.id is None:
            return None
        return DocumentVersionOut(
            id=version.id,
            submission_id=version.submission_id,
            document_id=version.document_id,
            document_type=document.document_type if document else None,
            document_name=document.document_name if document else None,
            document_version=version.document_version,
            filename=version.filename,
            original_filename=version.original_filename,
            file_path=version.file_path,
            content_hash=version.content_hash,
            language="vi" if version.language == "vi" else "ja",
            uploaded_at=version.uploaded_at,
            is_latest=bool(version.is_latest),
        )

    def _submission_out_from_record(self, record: SubmissionRecord) -> SubmissionOut:
        return SubmissionOut(
            project_id=record.project_id,
            project_name=record.project_name,
            filename=record.filename,
            document_type=record.document_type,
            uploaded_at=record.uploaded_at,
            language="vi" if record.language == "vi" else "ja",
            status=record.status,
            project_description=record.project_description,
            latest_document_version_id=record.latest_document_version_id,
            latest_document_version=record.latest_document_version,
            latest_document_id=record.latest_document_id,
            latest_document_name=record.latest_document_name,
            latest_score=record.latest_run.score if record.latest_run else None,
            latest_prompt_level=record.latest_run.prompt_level if record.latest_run else None,
            latest_graded_at=record.latest_run.graded_at if record.latest_run else None,
            latest_run=record.latest_run,
            run_history=record.run_history or [],
        )

    def create_project(
        self,
        project_id: str,
        project_name: str,
        project_description: str | None = None,
    ) -> SubmissionRecord:
        with Session(engine) as session:
            existing = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if existing:
                raise ValueError(f"Project already exists: {project_id}")
            
            now = datetime.now().isoformat()
            submission = Submission(
                project_id=project_id,
                project_name=project_name,
                project_description=project_description,
                uploaded_at=now,
                status="pending",
                filename="",
                document_type="",
                language="ja",
            )
            session.add(submission)
            session.commit()
            session.refresh(submission)
            return self._to_record(session, submission)

    def update_project(
        self,
        project_id: str,
        project_name: str | None = None,
        project_description: str | None = None,
    ) -> SubmissionRecord | None:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return None
            
            if project_name is not None:
                submission.project_name = project_name
            if project_description is not None:
                submission.project_description = project_description
                
            session.add(submission)
            session.commit()
            session.refresh(submission)
            return self._to_record(session, submission)

    def _latest_document_version(self, session: Session, submission_id: int) -> SubmissionDocumentVersion | None:
        return session.exec(
            select(SubmissionDocumentVersion)
            .where(
                SubmissionDocumentVersion.submission_id == submission_id,
                SubmissionDocumentVersion.is_latest == True,
            )
            .order_by(col(SubmissionDocumentVersion.id).desc())
        ).first()

    def _document_for_version(
        self,
        session: Session,
        version: SubmissionDocumentVersion | None,
    ) -> SubmissionDocument | None:
        if version is None or version.document_id is None:
            return None
        return session.get(SubmissionDocument, version.document_id)

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
            total_score=run.total_score if run.total_score is not None else run.score,
            document_version_id=run.document_version_id,
            document_version=run.document_version,
            rubric_version=run.rubric_version,
            rubric_hash=run.rubric_hash,
            gemini_model=run.gemini_model,
            prompt_version=run.prompt_version,
            prompt_level=run.prompt_level,
            policy_version=run.policy_version,
            policy_hash=run.policy_hash,
            required_rule_hash=run.required_rule_hash,
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
            issue_breakdown=issue_breakdown(slide_reviews),
            draft_feedback=run.draft_feedback,
            status=run.status,
            error_message=run.error_message,
            graded_at=run.graded_at,
        )

    def _to_record(self, session: Session, submission: Submission) -> SubmissionRecord:
        content = session.get(SubmissionContent, submission.id)
        latest_document_version = self._latest_document_version(session, submission.id or 0)
        latest_document = self._document_for_version(session, latest_document_version)
        latest_run = session.get(GradingRun, submission.latest_grading_run_id) if submission.latest_grading_run_id else None
        return SubmissionRecord(
            id=submission.id or 0,
            project_id=submission.project_id,
            project_name=submission.project_name,
            filename=latest_document_version.original_filename if latest_document_version else submission.filename,
            document_type=latest_document.document_type if latest_document else submission.document_type,
            language=latest_document_version.language if latest_document_version else submission.language,
            file_path=latest_document_version.file_path if latest_document_version else submission.file_path,
            uploaded_at=latest_document_version.uploaded_at if latest_document_version else submission.uploaded_at,
            status=submission.status,
            project_description=submission.project_description,
            extracted_text=latest_document_version.extracted_text if latest_document_version else (content.extracted_text if content else ""),
            content_hash=latest_document_version.content_hash if latest_document_version else (content.content_hash if content else ""),
            latest_document_id=latest_document.id if latest_document else None,
            latest_document_name=latest_document.document_name if latest_document else None,
            latest_document_version_id=latest_document_version.id if latest_document_version else None,
            latest_document_version=latest_document_version.document_version if latest_document_version else None,
            latest_run=self._run_out(session, latest_run),
        )

    def _run_history(self, session: Session, submission_id: int, limit: int = 5) -> list[GradingRunHistoryOut]:
        statement = (
            select(GradingRun)
            .where(GradingRun.submission_id == submission_id)
            .order_by(col(GradingRun.graded_at).desc(), col(GradingRun.id).desc())
            .limit(limit)
        )
        runs = session.exec(statement).all()
        if not runs:
            return []

        run_ids = [run.id for run in runs if run.id is not None]

        # [FIX PERF-01] Batch: 2 queries total instead of 2×N
        criteria_count_rows = session.exec(
            select(GradingCriteriaResult.grading_run_id, func.count().label("cnt"))
            .where(col(GradingCriteriaResult.grading_run_id).in_(run_ids))
            .group_by(GradingCriteriaResult.grading_run_id)
        ).all()
        criteria_counts_map: dict[int, int] = {row[0]: row[1] for row in criteria_count_rows}

        all_slides = session.exec(
            select(GradingSlideReview)
            .where(col(GradingSlideReview.grading_run_id).in_(run_ids))
        ).all()
        slides_by_run: dict[int, list] = {}
        for slide in all_slides:
            slides_by_run.setdefault(slide.grading_run_id, []).append(slide)

        history: list[GradingRunHistoryOut] = []
        for run in runs:
            slide_rows = slides_by_run.get(run.id or 0, [])
            ng_slide_count = sum(1 for item in slide_rows if item.status == "NG")
            issue_count_value = issue_count(slide_rows)
            document_version = session.get(SubmissionDocumentVersion, run.document_version_id) if run.document_version_id else None
            document = self._document_for_version(session, document_version)
            history.append(
                GradingRunHistoryOut(
                    id=run.id or 0,
                    score=run.score,
                    total_score=run.total_score if run.total_score is not None else run.score,
                    document_id=document.id if document else None,
                    document_type=document.document_type if document else None,
                    document_name=document.document_name if document else None,
                    document_version_id=run.document_version_id,
                    document_version=run.document_version,
                    rubric_version=run.rubric_version,
                    rubric_hash=run.rubric_hash,
                    gemini_model=run.gemini_model,
                    prompt_version=run.prompt_version,
                    prompt_level=run.prompt_level,
                    policy_version=run.policy_version,
                    policy_hash=run.policy_hash,
                    required_rule_hash=run.required_rule_hash,
                    prompt_hash=run.prompt_hash,
                    criteria_hash=run.criteria_hash,
                    grading_schema_version=run.grading_schema_version,
                    status=run.status,
                    error_message=run.error_message,
                    graded_at=run.graded_at,
                    criteria_result_count=criteria_counts_map.get(run.id or 0, 0),
                    slide_review_count=len(slide_rows),
                    ng_slide_count=ng_slide_count,
                    issue_count=issue_count_value,
                )
            )
        return history

    def get(self, project_id: str) -> Optional[SubmissionRecord]:
        with Session(engine) as session:
            statement = select(Submission).where(Submission.project_id == project_id)
            submission = session.exec(statement).first()
            if not submission:
                return None
            record = self._to_record(session, submission)
            record.run_history = self._run_history(session, record.id)
            return record

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

    def list_projects_summary(self, limit: int = 100, offset: int = 0) -> list[dict]:
        with Session(engine) as session:
            statement = (
                select(Submission)
                .order_by(col(Submission.uploaded_at).desc())
                .offset(offset)
                .limit(limit)
            )
            submissions = session.exec(statement).all()
            results = []
            for sub in submissions:
                # Count total documents
                total_docs = session.exec(
                    select(func.count()).select_from(SubmissionDocument).where(SubmissionDocument.submission_id == sub.id)
                ).one()
                
                # Latest score and updated_at
                latest_run = session.get(GradingRun, sub.latest_grading_run_id) if sub.latest_grading_run_id else None
                latest_score = latest_run.score if latest_run else None
                
                # latest_updated_at from documents
                latest_doc = session.exec(
                    select(SubmissionDocument)
                    .where(SubmissionDocument.submission_id == sub.id)
                    .order_by(col(SubmissionDocument.updated_at).desc())
                ).first()
                latest_updated_at = latest_doc.updated_at if latest_doc else sub.uploaded_at

                results.append({
                    "project_id": sub.project_id,
                    "project_name": sub.project_name,
                    "total_documents": int(total_docs),
                    "latest_updated_at": latest_updated_at,
                    "latest_score": latest_score,
                    "project_description": sub.project_description
                })
            return results

    def get_all_project_ids(self) -> list[str]:
        with Session(engine) as session:
            # [FIX BUG-02] Must use col() wrapper — calling .desc() directly on a str attr is invalid
            statement = select(Submission.project_id).order_by(col(Submission.uploaded_at).desc())
            return list(session.exec(statement).all())

    def list_document_versions(self, project_id: str) -> list[DocumentVersionOut]:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return []
            versions = session.exec(
                select(SubmissionDocumentVersion)
                .where(SubmissionDocumentVersion.submission_id == submission.id)
                .order_by(col(SubmissionDocumentVersion.id).desc())
            ).all()
            output: list[DocumentVersionOut] = []
            for version in versions:
                item = self._document_version_out(version, self._document_for_version(session, version))
                if item is not None:
                    output.append(item)
            return output

    def list_documents(self, project_id: str) -> list[DocumentOut]:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return []
            documents = session.exec(
                select(SubmissionDocument)
                .where(SubmissionDocument.submission_id == submission.id)
                .order_by(col(SubmissionDocument.updated_at).desc(), col(SubmissionDocument.id).desc())
            ).all()
            return [item for item in (self._document_out(document) for document in documents) if item is not None]

    def list_documents_summary(self, project_id: str) -> list[dict]:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return []
            documents = session.exec(
                select(SubmissionDocument)
                .where(SubmissionDocument.submission_id == submission.id)
                .order_by(col(SubmissionDocument.updated_at).desc(), col(SubmissionDocument.id).desc())
            ).all()
            
            results = []
            for doc in documents:
                latest_version = session.exec(
                    select(SubmissionDocumentVersion)
                    .where(SubmissionDocumentVersion.document_id == doc.id, SubmissionDocumentVersion.is_latest == True)
                ).first()
                
                # Latest score for this document (from its latest version's latest grading run)
                latest_score = None
                if latest_version:
                    run = session.exec(
                        select(GradingRun)
                        .where(GradingRun.document_version_id == latest_version.id)
                        .order_by(col(GradingRun.id).desc())
                    ).first()
                    latest_score = run.score if run else None

                results.append({
                    "document_id": doc.id,
                    "document_type": doc.document_type,
                    "document_name": doc.document_name,
                    "latest_version": latest_version.document_version if latest_version else None,
                    "latest_uploaded_at": latest_version.uploaded_at if latest_version else doc.updated_at,
                    "latest_score": latest_score
                })
            return results

    def get_document_version(
        self,
        project_id: str,
        document_version_id: int | None = None,
    ) -> SubmissionDocumentVersion | None:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return None
            if document_version_id is not None:
                return session.exec(
                    select(SubmissionDocumentVersion).where(
                        SubmissionDocumentVersion.id == document_version_id,
                        SubmissionDocumentVersion.submission_id == submission.id,
                    )
                ).first()
            return self._latest_document_version(session, submission.id or 0)

    def list_versions_by_document(self, document_id: int) -> list[dict]:
        with Session(engine) as session:
            versions = session.exec(
                select(SubmissionDocumentVersion)
                .where(SubmissionDocumentVersion.document_id == document_id)
                .order_by(col(SubmissionDocumentVersion.id).desc())
            ).all()
            
            results = []
            for v in versions:
                latest_run = session.exec(
                    select(GradingRun)
                    .where(GradingRun.document_version_id == v.id)
                    .order_by(col(GradingRun.id).desc())
                ).first()
                
                results.append({
                    "document_version_id": v.id,
                    "version": v.document_version,
                    "filename": v.original_filename,
                    "uploaded_at": v.uploaded_at,
                    "is_latest": bool(v.is_latest),
                    "content_hash": v.content_hash,
                    "latest_grading_score": latest_run.score if latest_run else None
                })
            return results

    def list_gradings_by_version(self, document_version_id: int) -> list[dict]:
        with Session(engine) as session:
            runs = session.exec(
                select(GradingRun)
                .where(GradingRun.document_version_id == document_version_id)
                .order_by(col(GradingRun.id).desc())
            ).all()
            
            results = []
            for r in runs:
                results.append({
                    "grading_run_id": r.id,
                    "total_score": r.total_score if r.total_score is not None else r.score,
                    "prompt_level": r.prompt_level,
                    "rubric_version": r.rubric_version,
                    "prompt_version": r.prompt_version,
                    "gemini_model": r.gemini_model,
                    "created_at": r.graded_at or r.started_at
                })
            return results

    def get_document_for_version(self, document_version_id: int) -> DocumentOut | None:
        with Session(engine) as session:
            version = session.get(SubmissionDocumentVersion, document_version_id)
            return self._document_out(self._document_for_version(session, version))

    def list_grading_runs(self, project_id: str) -> list[GradingRunHistoryOut]:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return []
            return self._run_history(session, submission.id or 0, limit=100)

    def get_grading_run_detail(self, grading_run_id: int) -> GradingRunDetailOut | None:
        with Session(engine) as session:
            run = session.get(GradingRun, grading_run_id)
            if not run:
                return None
            submission = session.get(Submission, run.submission_id)
            if not submission:
                return None

            document_version = session.get(SubmissionDocumentVersion, run.document_version_id) if run.document_version_id else None
            document = self._document_for_version(session, document_version)
            rubric = session.get(Rubric, run.rubric_id) if run.rubric_id else None
            rubric_out = None
            if rubric and rubric.id:
                from app.models import RubricCriterion, RubricVersionOut

                criteria = session.exec(
                    select(RubricCriterionRecord)
                    .where(RubricCriterionRecord.rubric_id == rubric.id)
                    .order_by(RubricCriterionRecord.sort_order, RubricCriterionRecord.id)
                ).all()
                rubric_out = RubricVersionOut(
                    document_type=rubric.document_type,
                    version=rubric.version,
                    active=rubric.active,
                    criteria=[
                        RubricCriterion(
                            key=item.key,
                            max_score=item.max_score,
                            labels={"vi": item.label_vi, "ja": item.label_ja},
                        )
                        for item in criteria
                    ],
                    prompt=rubric.prompt,
                )

            run_out = self._run_out(session, run)
            if run_out is None:
                return None
            record = self._to_record(session, submission)
            record.run_history = self._run_history(session, record.id)
            return GradingRunDetailOut(
                submission=self._submission_out_from_record(record),
                document=self._document_out(document),
                document_version=self._document_version_out(document_version, document),
                grading_run=run_out,
                rubric=rubric_out,
                criteria_results=run_out.criteria_results,
                slide_reviews=run_out.slide_reviews or [],
            )

    def find_matching_run(self, project_id: str, signature: dict[str, Any]) -> GradingRunOut | None:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return None
            run = session.exec(
                select(GradingRun)
                .where(
                    GradingRun.submission_id == submission.id,
                    GradingRun.document_version_id == signature.get("document_version_id"),
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
                )
                .order_by(col(GradingRun.graded_at).desc(), col(GradingRun.id).desc())
            ).first()
            return self._run_out(session, run)

    def append_cached_grading_run(
        self,
        project_id: str,
        source_run_id: int,
        *,
        started_at: str,
        graded_at: str,
    ) -> SubmissionRecord:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if submission is None:
                raise ValueError(f"Project not found: {project_id}")
            source_run = session.get(GradingRun, source_run_id)
            if source_run is None or source_run.submission_id != submission.id:
                raise ValueError(f"Grading run not found for project {project_id}: {source_run_id}")
            if source_run.document_version_id is None:
                raise ValueError(f"Source grading run has no document version: {source_run_id}")

            document_version = session.exec(
                select(SubmissionDocumentVersion).where(
                    SubmissionDocumentVersion.id == source_run.document_version_id,
                    SubmissionDocumentVersion.submission_id == submission.id,
                )
            ).first()
            if document_version is None:
                raise ValueError(f"Document version not found for cached run: {source_run.document_version_id}")

            run = GradingRun(
                submission_id=submission.id,
                document_version_id=document_version.id,
                document_version=document_version.document_version,
                rubric_id=source_run.rubric_id,
                rubric_version=source_run.rubric_version,
                rubric_hash=source_run.rubric_hash,
                gemini_model=source_run.gemini_model,
                prompt_version=source_run.prompt_version,
                prompt_level=source_run.prompt_level,
                policy_version=source_run.policy_version,
                policy_hash=source_run.policy_hash,
                required_rule_hash=source_run.required_rule_hash,
                prompt_hash=source_run.prompt_hash,
                criteria_hash=source_run.criteria_hash,
                grading_schema_version=source_run.grading_schema_version,
                score=source_run.score,
                total_score=source_run.total_score if source_run.total_score is not None else source_run.score,
                draft_feedback=source_run.draft_feedback,
                status=source_run.status,
                error_message=source_run.error_message,
                content_hash=source_run.content_hash,
                started_at=started_at,
                graded_at=graded_at,
            )
            session.add(run)
            session.commit()
            session.refresh(run)

            criteria = session.exec(
                select(GradingCriteriaResult)
                .where(GradingCriteriaResult.grading_run_id == source_run.id)
                .order_by(GradingCriteriaResult.id)
            ).all()
            for item in criteria:
                session.add(
                    GradingCriteriaResult(
                        grading_run_id=run.id,
                        criterion_key=item.criterion_key,
                        score=item.score,
                        max_score=item.max_score,
                        suggestion=item.suggestion,
                    )
                )

            slide_reviews = session.exec(
                select(GradingSlideReview)
                .where(GradingSlideReview.grading_run_id == source_run.id)
                .order_by(GradingSlideReview.slide_number)
            ).all()
            for item in slide_reviews:
                session.add(
                    GradingSlideReview(
                        grading_run_id=run.id,
                        slide_number=item.slide_number,
                        status="OK" if item.status == "OK" else "NG",
                        title=item.title,
                        summary=item.summary,
                        issues=item.issues,
                        suggestions=item.suggestions,
                        created_at=graded_at,
                    )
                )

            submission.latest_grading_run_id = run.id
            submission.status = "graded"
            session.commit()
            session.refresh(submission)
            return self._to_record(session, submission)

    def save_upload(
        self,
        *,
        project_id: str,
        project_name: str,
        project_description: str | None = None,
        filename: str,
        original_filename: str | None = None,
        document_type: str,
        document_name: str,
        language: str,
        file_path: str,
        extracted_text: str,
        content_hash: str,
        uploaded_at: str,
    ) -> SubmissionRecord:
        with Session(engine) as session:
            existing = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if existing:
                existing.project_name = existing.project_name or project_name
                if project_description is not None:
                    existing.project_description = project_description
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
                    project_description=project_description,
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

            normalized_document_name = document_name.strip() or Path(original_filename or filename).stem
            document = session.exec(
                select(SubmissionDocument).where(
                    SubmissionDocument.submission_id == submission.id,
                    SubmissionDocument.document_type == document_type,
                    SubmissionDocument.document_name == normalized_document_name,
                )
            ).first()
            for item in session.exec(
                select(SubmissionDocument).where(SubmissionDocument.submission_id == submission.id)
            ).all():
                item.is_latest = False
            if document is None:
                document = SubmissionDocument(
                    submission_id=submission.id or 0,
                    document_type=document_type,
                    document_name=normalized_document_name,
                    created_at=uploaded_at,
                    updated_at=uploaded_at,
                    is_latest=True,
                )
                session.add(document)
                session.commit()
                session.refresh(document)
            else:
                document.updated_at = uploaded_at
                document.is_latest = True

            latest_version = session.exec(
                select(SubmissionDocumentVersion)
                .where(SubmissionDocumentVersion.document_id == document.id)
                .order_by(col(SubmissionDocumentVersion.id).desc())
            ).first()
            if latest_version and latest_version.document_version.startswith("v"):
                try:
                    version_number = int(latest_version.document_version[1:]) + 1
                except ValueError:
                    version_number = 2
            else:
                version_number = 1
            document_version = f"v{version_number}"

            old_versions = session.exec(
                select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.document_id == document.id)
            ).all()
            for item in old_versions:
                item.is_latest = False

            session.add(
                SubmissionDocumentVersion(
                    submission_id=submission.id or 0,
                    document_id=document.id,
                    document_version=document_version,
                    filename=filename,
                    original_filename=Path(original_filename or filename).name,
                    file_path=file_path,
                    extracted_text=extracted_text,
                    content_hash=content_hash,
                    language=language,
                    uploaded_at=uploaded_at,
                    is_latest=True,
                )
            )

            content = session.get(SubmissionContent, submission.id)
            if content is None:
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

            document_version_id = result.get("document_version_id")
            document_version = None
            if isinstance(document_version_id, int):
                document_version = session.exec(
                    select(SubmissionDocumentVersion).where(
                        SubmissionDocumentVersion.id == document_version_id,
                        SubmissionDocumentVersion.submission_id == submission.id,
                    )
                ).first()
            if document_version is None:
                document_version = self._latest_document_version(session, submission.id or 0)
            if document_version is None:
                raise ValueError(f"No document version found for {project_id}")
            document = self._document_for_version(session, document_version)
            resolved_document_type = document.document_type if document else submission.document_type

            rubric = session.exec(
                select(Rubric).where(
                    Rubric.document_type == resolved_document_type,
                    Rubric.version == result.get("rubric_version"),
                )
            ).first()

            run = GradingRun(
                submission_id=submission.id,
                document_version_id=document_version.id,
                document_version=document_version.document_version,
                rubric_id=rubric.id if rubric else None,
                rubric_version=result.get("rubric_version"),
                rubric_hash=result.get("rubric_hash"),
                gemini_model=result.get("gemini_model"),
                prompt_version=result.get("prompt_version"),
                prompt_level=result.get("prompt_level", "medium"),
                policy_version=result.get("policy_version"),
                policy_hash=result.get("policy_hash"),
                required_rule_hash=result.get("required_rule_hash"),
                prompt_hash=result.get("prompt_hash"),
                criteria_hash=result.get("criteria_hash"),
                grading_schema_version=result.get("grading_schema_version"),
                score=result.get("score"),
                total_score=result.get("total_score", result.get("score")),
                draft_feedback=result.get("draft_feedback"),
                status="completed",
                content_hash=result.get("content_hash", document_version.content_hash),
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
            version_rows = session.exec(
                select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == submission.id)
            ).all()
            version_paths = [
                Path(row.file_path) if row.file_path else UPLOADS_DIR / row.filename
                for row in version_rows
            ]
            self._delete_runs_for_submission(session, submission.id or 0)
            session.exec(delete(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == submission.id))
            session.exec(delete(SubmissionDocument).where(SubmissionDocument.submission_id == submission.id))
            session.exec(delete(SubmissionContent).where(SubmissionContent.submission_id == submission.id))
            session.delete(submission)
            session.commit()

        candidate_paths = [
            UPLOADS_DIR / filename,
            UPLOADS_DIR / f"{filename}.txt",
            *version_paths,
            *(Path(f"{path}.txt") for path in version_paths),
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
