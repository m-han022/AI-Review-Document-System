from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Session, select, col
from app.models import (
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
    GradingRun,
)
from app.repositories.submission_repository import SubmissionRepository
from app.services.file_service import FileStorageService

class UploadService:
    def __init__(
        self, 
        submission_repo: SubmissionRepository,
        file_service: FileStorageService
    ):
        self.submission_repo = submission_repo
        self.file_service = file_service

    def handle_upload(
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
    ) -> Submission:
        # 1. Get project (Submission) - Project must exist beforehand as per updated rules
        submission = self.submission_repo.get_submission(project_id)
        if not submission:
            raise ValueError(f"Project does not exist: {project_id}. Project must be created before uploading.")
            
        submission.project_name = submission.project_name or project_name
        if project_description is not None:
            submission.project_description = project_description
            
        # Update legacy fields to reflect the most recent activity
        submission.filename = filename
        submission.document_type = document_type
        submission.language = language
        submission.file_path = file_path
        submission.uploaded_at = uploaded_at
        submission.status = "uploaded"



        self.submission_repo.commit()
        self.submission_repo.refresh(submission)

        # 2. Get or create logical document
        normalized_document_name = document_name.strip() or (original_filename or filename)
        # Check for existing document in this project with same type and name
        document = self.submission_repo.session.exec(
            select(SubmissionDocument).where(
                SubmissionDocument.submission_id == submission.id,
                SubmissionDocument.document_type == document_type,
                SubmissionDocument.document_name == normalized_document_name,
            )
        ).first()

        # Mark all documents of this project as not latest (only one document can be "active" at a time in some UI views)
        # but the rule says is_latest is scoped by (submission_id, document_type, document_name)
        # Wait, AGENTS.md says: UNIQUE(submission_id, document_type, document_name)
        # And: is_latest phải scoped theo: (submission_id, document_type, document_name)
        # That means only ONE version of a specific document is latest.
        
        if document is None:
            document = SubmissionDocument(
                submission_id=submission.id or 0,
                document_type=document_type,
                document_name=normalized_document_name,
                created_at=uploaded_at,
                updated_at=uploaded_at,
                is_latest=True,
            )
            self.submission_repo.add(document)
        else:
            document.updated_at = uploaded_at
            document.is_latest = True
            self.submission_repo.add(document)

        self.submission_repo.commit()
        self.submission_repo.refresh(document)

        # 2.1 Update project latest_grading_run_id if it belongs to THIS document
        # If we just uploaded a new version of A, the old latest_grading_run_id (if it was for A) is now stale.
        if submission.latest_grading_run_id:
            current_run = self.submission_repo.session.get(GradingRun, submission.latest_grading_run_id)
            if current_run and current_run.document_version_id:
                # If the run was for THIS document, we reset it so the project status becomes 'pending'
                # but if it was for ANOTHER document, we keep it so the dashboard still shows a 'completed' status
                old_version = self.submission_repo.session.get(SubmissionDocumentVersion, current_run.document_version_id)
                if old_version and old_version.document_id == document.id:
                    submission.latest_grading_run_id = None
                    self.submission_repo.add(submission)
                    self.submission_repo.commit()

        # 3. Create new version
        # Determine next version number
        existing_versions = self.submission_repo.list_versions_by_document(document.id)
        next_version_num = 1
        if existing_versions:
            # Simple parsing of 'vN'
            try:
                nums = [int(v.document_version.replace('v', '')) for v in existing_versions if v.document_version.startswith('v')]
                if nums:
                    next_version_num = max(nums) + 1
            except ValueError:
                next_version_num = len(existing_versions) + 1
        
        version_str = f"v{next_version_num}"

        # Mark previous versions as not latest
        for v in existing_versions:
            v.is_latest = False
            self.submission_repo.add(v)

        new_version = SubmissionDocumentVersion(
            submission_id=submission.id or 0,
            document_id=document.id,
            document_version=version_str,
            filename=filename,
            original_filename=original_filename or filename,
            file_path=file_path,
            extracted_text=extracted_text,
            content_hash=content_hash,
            language=language,
            uploaded_at=uploaded_at,
            is_latest=True,
        )
        self.submission_repo.add(new_version)
        self.submission_repo.commit()
        self.submission_repo.refresh(new_version)

        return submission
