from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timezone

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
    VersionComparisonOut,
    CriteriaDeltaOut,
)
from app.services.issue_analytics import issue_breakdown, issue_count
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.file_service import FileStorageService
from app.services.upload_service import UploadService
from app.services.grading_service import GradingService


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
    """
    Facade class for data storage and retrieval.
    Delegates to repositories and services for implementation.
    Maintains backward compatibility for existing code.
    """

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

    def _run_out(self, session: Session, run: GradingRun | None) -> GradingRunOut | None:
        if run is None or run.id is None:
            return None

        repo = GradingRepository(session)
        criteria = repo.get_criteria_results(run.id)
        slide_reviews = repo.get_slide_reviews(run.id)

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
            final_prompt_snapshot=run.final_prompt_snapshot,
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
        repo = SubmissionRepository(session)
        latest_version = repo.get_latest_document_version(submission.id or 0)
        latest_document = repo.get_document_for_version(latest_version) if latest_version else None
        latest_run = session.get(GradingRun, submission.latest_grading_run_id) if submission.latest_grading_run_id else None
        
        return SubmissionRecord(
            id=submission.id or 0,
            project_id=submission.project_id,
            project_name=submission.project_name,
            filename=latest_version.original_filename if latest_version else submission.filename,
            document_type=latest_document.document_type if latest_document else submission.document_type,
            language=latest_version.language if latest_version else submission.language,
            file_path=latest_version.file_path if latest_version else submission.file_path,
            uploaded_at=latest_version.uploaded_at if latest_version else submission.uploaded_at,
            status=submission.status,
            project_description=submission.project_description,
            extracted_text=latest_version.extracted_text if latest_version else "",
            content_hash=latest_version.content_hash if latest_version else "",
            latest_document_id=latest_document.id if latest_document else None,
            latest_document_name=latest_document.document_name if latest_document else None,
            latest_document_version_id=latest_version.id if latest_version else None,
            latest_document_version=latest_version.document_version if latest_version else None,
            latest_run=self._run_out(session, latest_run),
        )

    def _run_history(self, session: Session, submission_id: int, limit: int = 5) -> list[GradingRunHistoryOut]:
        grading_repo = GradingRepository(session)
        sub_repo = SubmissionRepository(session)
        
        runs = grading_repo.list_grading_runs(submission_id, limit)
        if not runs:
            return []

        run_ids = [run.id for run in runs if run.id is not None]
        criteria_counts_map = grading_repo.get_criteria_counts(run_ids)
        all_slides = grading_repo.get_all_slides_for_runs(run_ids)
        
        slides_by_run: dict[int, list] = {}
        for slide in all_slides:
            slides_by_run.setdefault(slide.grading_run_id, []).append(slide)

        history: list[GradingRunHistoryOut] = []
        for run in runs:
            slide_rows = slides_by_run.get(run.id or 0, [])
            ng_slide_count = sum(1 for item in slide_rows if item.status == "NG")
            issue_count_value = issue_count(slide_rows)
            version = sub_repo.get_document_version_by_id(run.document_version_id) if run.document_version_id else None
            document = sub_repo.get_document_for_version(version) if version else None
            
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
                    final_prompt_snapshot=run.final_prompt_snapshot,
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

    def create_project(
        self,
        project_id: str,
        project_name: str,
        project_description: str | None = None,
    ) -> SubmissionRecord:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            if repo.get_submission(project_id):
                raise ValueError(f"Project already exists: {project_id}")
            
            now = datetime.now(timezone.utc).isoformat()
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
            repo.add(submission)
            repo.commit()
            repo.refresh(submission)
            return self._to_record(session, submission)

    def update_project(
        self,
        project_id: str,
        project_name: str | None = None,
        project_description: str | None = None,
    ) -> SubmissionRecord | None:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return None
            
            if project_name is not None:
                submission.project_name = project_name
            if project_description is not None:
                submission.project_description = project_description
                
            repo.add(submission)
            repo.commit()
            repo.refresh(submission)
            return self._to_record(session, submission)

    def get(self, project_id: str) -> Optional[SubmissionRecord]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return None
            record = self._to_record(session, submission)
            record.run_history = self._run_history(session, record.id)
            return record

    def list(self, limit: int = 100, offset: int = 0) -> tuple[list[SubmissionRecord], int, int]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            total = repo.count_submissions()
            ungraded = repo.count_ungraded_submissions()
            submissions = repo.list_submissions(limit, offset)
            return [self._to_record(session, item) for item in submissions], int(total), int(ungraded)

    def get_all_for_export(self) -> list[SubmissionRecord]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submissions = repo.list_submissions(limit=1000) # Bulk fetch
            return [self._to_record(session, item) for item in submissions]

    def list_projects_summary(self, limit: int = 100, offset: int = 0) -> list[dict]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submissions = repo.list_submissions(limit, offset)
            results = []
            for sub in submissions:
                total_docs = session.exec(
                    select(func.count()).select_from(SubmissionDocument).where(SubmissionDocument.submission_id == sub.id)
                ).one()
                
                latest_run = session.get(GradingRun, sub.latest_grading_run_id) if sub.latest_grading_run_id else None
                latest_score = latest_run.score if latest_run else None
                
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
                    "latest_status": (latest_run.status if latest_run else sub.status).lower(),
                    "latest_error_message": latest_run.error_message if latest_run else None,
                    "project_description": sub.project_description
                })
            return results

    def list_document_versions(self, project_id: str) -> list[DocumentVersionOut]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return []
            versions = repo.list_document_versions(submission.id or 0)
            output: list[DocumentVersionOut] = []
            for version in versions:
                item = self._document_version_out(version, repo.get_document_for_version(version))
                if item is not None:
                    output.append(item)
            return output

    def list_documents(self, project_id: str) -> list[DocumentOut]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return []
            documents = repo.list_documents(submission.id or 0)
            return [item for item in (self._document_out(document) for document in documents) if item is not None]

    def list_documents_summary(self, project_id: str) -> list[dict]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            grading_repo = GradingRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return []
            documents = repo.list_documents(submission.id or 0)
            
            results = []
            for doc in documents:
                latest_version = session.exec(
                    select(SubmissionDocumentVersion)
                    .where(SubmissionDocumentVersion.document_id == doc.id, SubmissionDocumentVersion.is_latest == True)
                ).first()
                
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
                    "latest_score": latest_score,
                    "latest_status": (run.status if run else "pending").lower(),
                    "latest_error_message": run.error_message if run else None
                })
            return results

    def list_versions_by_document(self, document_id: int) -> list[dict]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            grading_repo = GradingRepository(session)
            versions = repo.list_versions_by_document(document_id)
            
            results = []
            for v in versions:
                run = session.exec(
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
                    "latest_grading_score": run.score if run else None,
                    "latest_status": (run.status if run else "pending").lower(),
                    "latest_error_message": run.error_message if run else None
                })
            return results

    def list_gradings_by_version(self, document_version_id: int) -> list[dict]:
        with Session(engine) as session:
            repo = GradingRepository(session)
            runs = repo.session.exec(
                select(GradingRun)
                .where(GradingRun.document_version_id == document_version_id)
                .order_by(col(GradingRun.id).desc())
            ).all()
            
            results = []
            for r in runs:
                results.append({
                    "grading_run_id": r.id,
                    "total_score": r.total_score if r.total_score is not None else r.score,
                    "status": r.status.lower(),
                    "error_message": r.error_message,
                    "prompt_level": r.prompt_level,
                    "rubric_version": r.rubric_version,
                    "prompt_version": r.prompt_version,
                    "gemini_model": r.gemini_model,
                    "created_at": r.graded_at or r.started_at or ""
                })
            return results

    def compare_versions(self, document_id: int, base_version_id: int, compare_version_id: int) -> VersionComparisonOut:
        with Session(engine) as session:
            sub_repo = SubmissionRepository(session)
            grading_repo = GradingRepository(session)
            
            doc = session.get(SubmissionDocument, document_id)
            if not doc:
                raise ValueError(f"Document {document_id} not found")
            
            base_v = session.get(SubmissionDocumentVersion, base_version_id)
            compare_v = session.get(SubmissionDocumentVersion, compare_version_id)
            
            if not base_v or not compare_v:
                raise ValueError("Base or compare version not found")
                
            base_run = grading_repo.get_latest_completed_run(base_version_id)
            compare_run = grading_repo.get_latest_completed_run(compare_version_id)
            
            base_run_out = self._run_out(session, base_run) if base_run else None
            compare_run_out = self._run_out(session, compare_run) if compare_run else None
            
            score_delta = None
            criteria_deltas = []
            ok_delta = 0
            ng_delta = 0
            insights = []
            
            if base_run_out and compare_run_out:
                score_a = base_run_out.total_score if base_run_out.total_score is not None else base_run_out.score
                score_b = compare_run_out.total_score if compare_run_out.total_score is not None else compare_run_out.score
                if score_a is not None and score_b is not None:
                    score_delta = score_b - score_a
                
                criteria_a = {item.key: item for item in base_run_out.criteria_results}
                criteria_b = {item.key: item for item in compare_run_out.criteria_results}
                all_keys = sorted(list(set(criteria_a.keys()) | set(criteria_b.keys())))
                
                for key in all_keys:
                    cA = criteria_a.get(key)
                    cB = criteria_b.get(key)
                    
                    sA = cA.score if cA else None
                    sB = cB.score if cB else None
                    
                    status = "unchanged"
                    delta = 0.0
                    
                    if cA and not cB:
                        status = "retired"
                        delta = -cA.score
                    elif not cA and cB:
                        status = "new"
                        delta = cB.score
                    elif sA is not None and sB is not None:
                        delta = round(sB - sA, 1)
                        if delta > 0:
                            status = "improved"
                        elif delta < 0:
                            status = "regressed"
                    
                    from app.models import CriteriaDeltaOut
                    criteria_deltas.append(CriteriaDeltaOut(
                        key=key,
                        base_score=sA,
                        compare_score=sB,
                        delta=delta,
                        status=status
                    ))
                
                # Compute Insights
                if score_delta is not None:
                    if score_delta > 0:
                        insights.append(f"Score improved by {score_delta} points.")
                    elif score_delta < 0:
                        insights.append(f"Score regressed by {abs(score_delta)} points.")
                
                sorted_deltas = sorted(criteria_deltas, key=lambda x: x.delta, reverse=True)
                top_improvers = [d for d in sorted_deltas if d.delta > 0][:2]
                top_regressors = [d for d in sorted_deltas if d.delta < 0][-2:] # These are at the end if reversed=True
                
                # Re-sort regressors to get most negative first
                top_regressors = sorted([d for d in criteria_deltas if d.delta < 0], key=lambda x: x.delta)[:2]

                for d in top_improvers:
                    insights.append(f"Significant improvement in '{d.key}' (+{d.delta}).")
                for d in top_regressors:
                    insights.append(f"Regression found in '{d.key}' ({d.delta}).")
                    
                ok_a = sum(1 for s in base_run_out.slide_reviews if s.status == "OK")
                ok_b = sum(1 for s in compare_run_out.slide_reviews if s.status == "OK")
                ok_delta = ok_b - ok_a
                
                ng_a = sum(1 for s in base_run_out.slide_reviews if s.status == "NG")
                ng_b = sum(1 for s in compare_run_out.slide_reviews if s.status == "NG")
                ng_delta = ng_b - ng_a
                
                if ok_delta > 0:
                    insights.append(f"Document quality increased with {ok_delta} more OK slides.")
                if ng_delta > 0:
                    insights.append(f"Warning: {ng_delta} additional NG slides detected.")
            
            from app.models import VersionComparisonOut, CriteriaDeltaOut
            # Re-wrap criteria_deltas if needed or ensure they are created with the class
            return VersionComparisonOut(
                document=self._document_out(doc),
                base_version=self._document_version_out(base_v, doc),
                compare_version=self._document_version_out(compare_v, doc),
                base_run=base_run_out,
                compare_run=compare_run_out,
                score_delta=score_delta,
                criteria_deltas=criteria_deltas,
                ok_slide_delta=ok_delta,
                ng_slide_delta=ng_delta,
                insights=insights
            )

    def list_grading_runs(self, project_id: str) -> list[GradingRunHistoryOut]:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return []
            return self._run_history(session, submission.id or 0, limit=100)

    def get_grading_run_detail(self, grading_run_id: int) -> GradingRunDetailOut | None:
        with Session(engine) as session:
            grading_repo = GradingRepository(session)
            sub_repo = SubmissionRepository(session)
            
            run = grading_repo.get_grading_run(grading_run_id)
            if not run:
                return None
            submission = sub_repo.get_submission_by_id(run.submission_id)
            if not submission:
                return None

            document_version = sub_repo.get_document_version_by_id(run.document_version_id) if run.document_version_id else None
            document = sub_repo.get_document_for_version(document_version) if document_version else None
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

    def save_upload(self, **kwargs) -> SubmissionRecord:
        with Session(engine) as session:
            sub_repo = SubmissionRepository(session)
            file_service = FileStorageService()
            upload_service = UploadService(sub_repo, file_service)
            
            submission = upload_service.handle_upload(**kwargs)
            return self._to_record(session, submission)

    def delete(self, project_id: str) -> bool:
        with Session(engine) as session:
            submission = session.exec(select(Submission).where(Submission.project_id == project_id)).first()
            if not submission:
                return False
            
            # Cascade delete in a real DB would handle this, but for SQLite/SQLModel we do it manually or rely on foreign keys
            # Let's do a safe delete
            session.exec(delete(GradingCriteriaResult).where(GradingCriteriaResult.grading_run_id.in_(
                select(GradingRun.id).where(GradingRun.submission_id == submission.id)
            )))
            session.exec(delete(GradingSlideReview).where(GradingSlideReview.grading_run_id.in_(
                select(GradingRun.id).where(GradingRun.submission_id == submission.id)
            )))
            session.exec(delete(GradingRun).where(GradingRun.submission_id == submission.id))
            session.exec(delete(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == submission.id))
            session.exec(delete(SubmissionDocument).where(SubmissionDocument.submission_id == submission.id))
            session.exec(delete(SubmissionContent).where(SubmissionContent.submission_id == submission.id))
            session.delete(submission)
            session.commit()
            return True

    def delete_many(self, project_ids: list[str]) -> dict[str, bool]:
        return {pid: self.delete(pid) for pid in project_ids}

    # Helper methods for specific lookups
    def get_document_version(self, project_id: str, document_version_id: int | None = None) -> SubmissionDocumentVersion | None:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return None
            if document_version_id is not None:
                return repo.get_document_version_by_id(document_version_id)
            return repo.get_latest_document_version(submission.id or 0)

    def find_matching_run(self, project_id: str, signature: dict[str, Any]) -> GradingRunOut | None:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            grading_repo = GradingRepository(session)
            submission = repo.get_submission(project_id)
            if not submission:
                return None
            run = grading_repo.find_matching_run(submission.id or 0, signature)
            return self._run_out(session, run)

    def get_document_for_version(self, version_id: int) -> DocumentOut | None:
        with Session(engine) as session:
            repo = SubmissionRepository(session)
            version = repo.get_document_version_by_id(version_id)
            if not version:
                return None
            document = repo.get_document_for_version(version)
            return self._document_out(document)

    def save_grading_result(self, project_id: str, result_data: dict[str, Any], **kwargs) -> SubmissionRecord:
        with Session(engine) as session:
            sub_repo = SubmissionRepository(session)
            grading_repo = GradingRepository(session)
            grading_service = GradingService(sub_repo, grading_repo)
            
            submission = sub_repo.get_submission(project_id)
            version_id = result_data["document_version_id"]
            version = sub_repo.get_document_version_by_id(version_id)
            
            run = grading_service.create_pending_run(
                submission_id=submission.id,
                document_version_id=version.id,
                document_version=version.document_version,
                rubric_version=result_data["rubric_version"],
                prompt_level=result_data["prompt_level"],
                content_hash=version.content_hash
            )
            
            grading_service._save_grading_results(run, result_data)
            
            # Update submission latest run
            submission.latest_grading_run_id = run.id
            submission.status = "graded"
            sub_repo.add(submission)
            sub_repo.commit()
            
            return self._to_record(session, submission)

    def append_cached_grading_run(self, project_id: str, source_run_id: int, **kwargs) -> SubmissionRecord:
        with Session(engine) as session:
            sub_repo = SubmissionRepository(session)
            grading_repo = GradingRepository(session)
            grading_service = GradingService(sub_repo, grading_repo)
            
            # We need to adapt the logic from _reuse_cached_run but for the specific signature of append_cached_grading_run
            # This is used in the legacy flow.
            submission = sub_repo.get_submission(project_id)
            version = sub_repo.get_latest_document_version(submission.id or 0)
            cached_run = grading_repo.get_grading_run(source_run_id)
            
            grading_service._reuse_cached_run(submission.id, version, cached_run)
            return self._to_record(session, submission)


    def get_all_project_ids(self) -> list[str]:
        with Session(engine) as session:
            return list(session.exec(select(Submission.project_id)).all())

    def get_ungraded_project_ids(self) -> list[str]:
        with Session(engine) as session:
            return list(session.exec(
                select(Submission.project_id).where(Submission.latest_grading_run_id == None)
            ).all())


store = SubmissionStore()
