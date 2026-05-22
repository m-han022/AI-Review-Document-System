from types import SimpleNamespace
from unittest.mock import MagicMock

from sqlalchemy.exc import IntegrityError

from app.models import Submission, SubmissionDocumentVersion
from app.services.upload_service import UploadService


def test_upload_service_retries_after_integrity_error():
    submission = Submission(
        id=1,
        project_id="P900",
        project_name="Race Test",
        filename="",
        document_type="",
        language="ja",
        uploaded_at="",
        status="pending",
    )
    document = SimpleNamespace(id=10, updated_at="", is_latest=True)
    existing_v1 = SubmissionDocumentVersion(
        id=1,
        submission_id=1,
        document_id=10,
        document_version="v1",
        filename="old.pdf",
        original_filename="old.pdf",
        extracted_text="x",
        content_hash="h1",
        uploaded_at="now",
        is_latest=True,
    )
    existing_v2 = SubmissionDocumentVersion(
        id=2,
        submission_id=1,
        document_id=10,
        document_version="v2",
        filename="old2.pdf",
        original_filename="old2.pdf",
        extracted_text="x",
        content_hash="h2",
        uploaded_at="now",
        is_latest=False,
    )

    repo = MagicMock()
    repo.get_submission.return_value = submission
    repo.session.exec.return_value.first.return_value = document
    repo.list_versions_by_document.side_effect = [
        [existing_v1],
        [existing_v1, existing_v2],
    ]

    commit_calls = {"n": 0}

    def commit_side_effect():
        commit_calls["n"] += 1
        # 1: submission update, 2: document update, 3: first version insert (fail), 4: retry insert (ok)
        if commit_calls["n"] == 3:
            raise IntegrityError("insert", params={}, orig=Exception("duplicate"))

    repo.commit.side_effect = commit_side_effect
    repo.refresh.side_effect = lambda *_: None

    service = UploadService(repo, file_service=MagicMock())
    service.handle_upload(
        project_id="P900",
        project_name="Race Test",
        project_description=None,
        filename="P900_Doc.pdf",
        original_filename="P900_Doc.pdf",
        document_type="project-review",
        document_name="Doc",
        language="ja",
        file_path="/tmp/P900_Doc.pdf",
        extracted_text="text",
        content_hash="content-hash",
        binary_hash="binary-hash",
        uploaded_at="2026-01-01T00:00:00Z",
    )

    created_versions = [
        call.args[0]
        for call in repo.add.call_args_list
        if isinstance(call.args[0], SubmissionDocumentVersion)
    ]
    assert created_versions, "Expected a version to be created"
    assert created_versions[-1].document_version == "v3"
    repo.session.rollback.assert_called_once()

