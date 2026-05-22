from datetime import datetime, timedelta, timezone

from sqlmodel import select
from app.models import (
    EvaluationPolicy,
    EvaluationSet,
    GradingRun,
    PromptVersion,
    Rubric,
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
)
from app.repositories.grading_repository import GradingRepository
from app.repositories.submission_repository import SubmissionRepository
from app.services.grading_service import GradingService


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _minutes_ago(minutes: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def test_project_and_detail_use_latest_pending_run_even_without_graded_at(client, session):
    pid = "P-LATEST-001"
    submission = Submission(
        project_id=pid,
        project_name="Latest Run Selection",
        filename="legacy.pdf",
        document_type="project-review",
        uploaded_at=_now(),
        status="uploaded",
    )
    session.add(submission)
    session.commit()
    session.refresh(submission)

    document = SubmissionDocument(
        submission_id=submission.id,
        document_type="project-review",
        document_name="Doc",
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(document)
    session.commit()
    session.refresh(document)

    version = SubmissionDocumentVersion(
        submission_id=submission.id,
        document_id=document.id,
        document_version="v1",
        filename="doc.pdf",
        original_filename="doc.pdf",
        extracted_text="text",
        content_hash="content-hash",
        uploaded_at=_now(),
    )
    session.add(version)
    session.commit()
    session.refresh(version)
    version_id = version.id

    completed = GradingRun(
        submission_id=submission.id,
        document_version_id=version_id,
        document_version="v1",
        status="COMPLETED",
        score=77,
        total_score=77,
        content_hash="hash-completed",
        started_at="2026-05-13T09:51:43+00:00",
        graded_at="2026-05-13T09:52:56+00:00",
    )
    session.add(completed)
    session.commit()
    session.refresh(completed)

    pending = GradingRun(
        submission_id=submission.id,
        document_version_id=version_id,
        document_version="v1",
        status="PENDING",
        content_hash="hash-pending",
        started_at=_minutes_ago(5),
        graded_at=None,
    )
    session.add(pending)
    session.commit()
    session.refresh(pending)

    submission.latest_grading_run_id = pending.id
    session.add(submission)
    session.commit()

    projects_res = client.get("/api/projects")
    assert projects_res.status_code == 200
    project = next(item for item in projects_res.json() if item["project_id"] == pid)
    assert project["latest_status"] == "pending"
    assert project["latest_score"] is None

    detail_res = client.get(f"/api/submissions/{pid}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["latest_run"]["status"] == "PENDING"
    assert detail["latest_run"]["document_version_id"] == version_id


def test_create_pending_run_updates_submission_latest_grading_run_id(session):
    submission = Submission(
        project_id="P-LATEST-002",
        project_name="Pending Pointer",
        filename="legacy.pdf",
        document_type="project-review",
        uploaded_at=_now(),
        status="uploaded",
    )
    session.add(submission)
    session.commit()
    session.refresh(submission)

    document = SubmissionDocument(
        submission_id=submission.id,
        document_type="project-review",
        document_name="Doc",
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(document)
    session.commit()
    session.refresh(document)

    version = SubmissionDocumentVersion(
        submission_id=submission.id,
        document_id=document.id,
        document_version="v1",
        filename="doc.pdf",
        original_filename="doc.pdf",
        extracted_text="text",
        content_hash="content-hash",
        uploaded_at=_now(),
    )
    session.add(version)
    session.commit()
    session.refresh(version)

    rubric = Rubric(
        document_type="project-review",
        version="v1",
        active=True,
        status="active",
        prompt={"vi": "rubric", "ja": "rubric"},
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(rubric)
    session.commit()
    session.refresh(rubric)

    prompt = PromptVersion(
        document_type="project-review",
        level="medium",
        version="v1",
        content="prompt",
        status="active",
        created_at=_now(),
    )
    session.add(prompt)
    session.commit()
    session.refresh(prompt)

    policy = EvaluationPolicy(
        level="medium",
        version="v1",
        content="policy",
        status="active",
        created_at=_now(),
    )
    session.add(policy)
    session.commit()
    session.refresh(policy)

    evaluation_set = EvaluationSet(
        name="default",
        document_type="project-review",
        level="medium",
        rubric_version_id=rubric.id,
        prompt_version_id=prompt.id,
        policy_version_id=policy.id,
        required_rules_version="system-rules-v1",
        required_rule_hash="rrh",
        status="active",
        created_at=_now(),
    )
    session.add(evaluation_set)
    session.commit()
    session.refresh(evaluation_set)

    service = GradingService(SubmissionRepository(session), GradingRepository(session))
    run = service.create_pending_run(
        submission_id=submission.id,
        document_version_id=version.id,
        document_version=version.document_version,
        rubric_version="v1",
        prompt_level="medium",
        content_hash=version.content_hash,
        evaluation_set_id=evaluation_set.id,
    )

    session.refresh(submission)
    assert submission.latest_grading_run_id == run.id
