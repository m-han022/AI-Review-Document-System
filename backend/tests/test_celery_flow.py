import pytest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlmodel import Session, select, delete
from sqlalchemy import text
from app.main import app
from app.database import engine
from app.models import (
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
    GradingRun,
    GradingCriteriaResult,
    EvaluationSet,
    RequiredRuleSet,
    Rubric,
    PromptVersion,
    EvaluationPolicy,
)
from app.repositories.submission_repository import SubmissionRepository
from app.repositories.grading_repository import GradingRepository
from app.services.grading_service import GradingService
from app.config import settings

client = TestClient(app)

def test_celery_task_dispatch():
    """
    Verify that when USE_CELERY=true, the API:
    1. Creates a PENDING GradingRun.
    2. Calls .delay() on the task.
    3. Returns PENDING status.
    """
    # 1. Setup mock data
    with Session(engine) as session:
        # Cleanup
        session.exec(text("DELETE FROM gradingrun"))
        session.exec(text("DELETE FROM submission_document_version"))
        session.exec(text("DELETE FROM submission_document"))
        session.exec(text("DELETE FROM submission"))
        session.commit()
        
        sub = Submission(project_id="CELERY-TEST", project_name="Celery Test", filename="test.pptx")
        session.add(sub)
        session.commit()
        session.refresh(sub)
        
        doc = SubmissionDocument(submission_id=sub.id, document_type="project-review", document_name="Test Doc")
        session.add(doc)
        session.commit()
        session.refresh(doc)
        
        version = SubmissionDocumentVersion(
            submission_id=sub.id,
            document_id=doc.id,
            document_version="v1",
            filename="test.pptx",
            original_filename="test.pptx",
            extracted_text="Some content",
            content_hash="hash123",
            language="ja"
        )
        session.add(version)
        session.commit()
        session.refresh(version)
        
        version_id = version.id

    # 2. Mock settings and celery task
    with patch("app.routers.grading.settings") as mock_settings:
        mock_settings.use_celery = True

        with patch("app.services.grading_service.GradingService.assert_async_runtime_ready") as mock_runtime_ready:
            mock_runtime_ready.return_value = None
            with patch("app.routers.grading.grade_document_version_task.delay") as mock_delay:
                # 3. Call API
                response = client.post(
                    f"/api/grade/CELERY-TEST",
                    params={"document_version_id": version_id}
                )
            
                # 4. Verify API response
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "PENDING"
                run_id = data["run_id"]
                
                # 5. Verify task was dispatched
                assert mock_delay.call_count >= 1
                args, kwargs = mock_delay.call_args
                assert kwargs["project_id"] == "CELERY-TEST"
                assert kwargs["grading_run_id"] == run_id
            
                # 6. Verify DB record is PENDING
                with Session(engine) as session:
                    run = session.get(GradingRun, run_id)
                    assert run is not None
                    assert run.status == "PENDING"

def test_celery_task_execution_logic():
    """
    Verify that the task logic itself works (using eager mode to avoid real Redis).
    """
    from app.tasks import grade_document_version_task
    from app.celery_app import celery_app
    
    # Enable eager mode for this test
    celery_app.conf.task_always_eager = True
    
    with Session(engine) as session:
        # Setup run
        sub = session.exec(select(Submission).where(Submission.project_id == "CELERY-TEST")).first()
        version = session.exec(select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == sub.id)).first()
        
        project_id = sub.project_id
        version_id = version.id
        
        run = GradingRun(
            submission_id=sub.id,
            document_version_id=version.id,
            status="PENDING",
            content_hash="hash123"
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        run_id = run.id
        version_id = version.id
        version_id = version.id
        version_id = version.id

    # Mock GradingService.run_grading to avoid real AI calls
    with patch("app.tasks.GradingService.run_grading") as mock_run:
        mock_run.return_value = {"status": "success"}
        
        # Execute task
        grade_document_version_task(
            project_id=project_id,
            document_version_id=version_id,
            grading_run_id=run_id
        )
        
        # Verify GradingService was called with correct run_id
        assert mock_run.call_count >= 1
        _, kwargs = mock_run.call_args
        assert kwargs["existing_run_id"] == run_id

def test_grade_endpoint_reuses_active_run_for_same_context():
    with Session(engine) as session:
        sub = session.exec(select(Submission).where(Submission.project_id == "CELERY-TEST")).first()
        version = session.exec(
            select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == sub.id)
        ).first()
        doc = session.exec(select(SubmissionDocument).where(SubmissionDocument.id == version.document_id)).first()
        document_type = doc.document_type if doc else "project-review"

        rubric = session.exec(
            select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
        ).first()
        if rubric is None:
            rubric = Rubric(
                document_type=document_type,
                version="v1",
                active=True,
                status="active",
                prompt={"vi": "rubric"},
                created_at="2026-01-01T00:00:00Z",
                updated_at="2026-01-01T00:00:00Z",
            )
            session.add(rubric)
            session.commit()
            session.refresh(rubric)

        prompt = session.exec(
            select(PromptVersion).where(
                PromptVersion.document_type == document_type,
                PromptVersion.level == "medium",
                PromptVersion.status == "active",
            )
        ).first()
        if prompt is None:
            prompt = PromptVersion(
                document_type=document_type,
                level="medium",
                version="v1",
                content="prompt",
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(prompt)
            session.commit()
            session.refresh(prompt)

        policy = session.exec(
            select(EvaluationPolicy).where(EvaluationPolicy.level == "medium", EvaluationPolicy.status == "active")
        ).first()
        if policy is None:
            policy = EvaluationPolicy(
                level="medium",
                version="v1",
                content="policy",
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(policy)
            session.commit()
            session.refresh(policy)

        rules = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.status == "active")).first()
        if rules is None:
            rules = RequiredRuleSet(
                version="system-rules-v1",
                hash="hash",
                content='["JSON only"]',
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(rules)
            session.commit()
            session.refresh(rules)

        eval_set = session.exec(
            select(EvaluationSet).where(
                EvaluationSet.document_type == document_type,
                EvaluationSet.level == "medium",
                EvaluationSet.status == "active",
            )
        ).first()
        if eval_set is None:
            eval_set = EvaluationSet(
                name=f"{document_type}-medium-set-v1",
                document_type=document_type,
                level="medium",
                rubric_version_id=rubric.id,
                prompt_version_id=prompt.id,
                policy_version_id=policy.id,
                required_rule_set_id=rules.id,
                required_rules_version=rules.version,
                required_rule_hash=rules.hash,
                version_label=f"{document_type}-medium-set-v1",
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(eval_set)
            session.commit()
            session.refresh(eval_set)

        version_id = version.id
        eval_set_id = eval_set.id
        session.exec(
            delete(GradingRun).where(
                GradingRun.document_version_id == version_id,
                GradingRun.evaluation_set_id == eval_set_id,
            )
        )
        session.commit()

    with patch("app.routers.grading.settings") as mock_settings:
        mock_settings.use_celery = True

        with patch("app.services.grading_service.GradingService.assert_async_runtime_ready") as mock_runtime_ready:
            mock_runtime_ready.return_value = None
            with patch("app.routers.grading.grade_document_version_task.delay") as mock_delay:
                response_1 = client.post(
                    "/api/grade/CELERY-TEST",
                    params={
                        "document_version_id": version_id,
                        "prompt_level": "medium",
                        "evaluation_set_id": eval_set_id,
                    },
                )
                response_2 = client.post(
                    "/api/grade/CELERY-TEST",
                    params={
                        "document_version_id": version_id,
                        "prompt_level": "medium",
                        "evaluation_set_id": eval_set_id,
                    },
                )

                assert response_1.status_code == 200
                assert response_2.status_code == 200
                run_id_1 = response_1.json()["run_id"]
                run_id_2 = response_2.json()["run_id"]
                assert run_id_1 == run_id_2
                assert mock_delay.call_count >= 1

def test_celery_dispatch_rejected_when_async_runtime_unavailable():
    with Session(engine) as session:
        sub = session.exec(select(Submission).where(Submission.project_id == "CELERY-TEST")).first()
        version = session.exec(
            select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == sub.id)
        ).first()
        version_id = version.id

    with patch("app.routers.grading.settings") as mock_settings:
        mock_settings.use_celery = True
        with patch(
            "app.services.grading_service.GradingService.assert_async_runtime_ready",
            side_effect=RuntimeError("FAILED_RUNTIME_UNAVAILABLE: Async grading is enabled but no Celery worker is responding."),
        ):
            with patch("app.routers.grading.grade_document_version_task.delay") as mock_delay:
                response = client.post(
                    "/api/grade/CELERY-TEST",
                    params={"document_version_id": version_id},
                )

    assert response.status_code == 503
    payload = response.json()
    assert payload["detail"]["error_code"] == "FAILED_RUNTIME_UNAVAILABLE"
    assert "no Celery worker is responding" in payload["detail"]["message"]
    mock_delay.assert_not_called()


def test_celery_retry_same_run_id_is_idempotent():
    from app.tasks import grade_document_version_task
    from app.celery_app import celery_app

    celery_app.conf.task_always_eager = True

    with Session(engine) as session:
        sub = session.exec(select(Submission).where(Submission.project_id == "CELERY-TEST")).first()
        version = session.exec(
            select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == sub.id)
        ).first()
        doc = session.exec(
            select(SubmissionDocument).where(SubmissionDocument.id == version.document_id)
        ).first()
        document_type = doc.document_type if doc else "project-review"

        rubric = session.exec(
            select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
        ).first()
        if rubric is None:
            rubric = Rubric(
                document_type=document_type,
                version="v1",
                active=True,
                status="active",
                prompt={"vi": "rubric"},
                created_at="2026-01-01T00:00:00Z",
                updated_at="2026-01-01T00:00:00Z",
            )
            session.add(rubric)
            session.commit()
            session.refresh(rubric)

        prompt = session.exec(
            select(PromptVersion).where(
                PromptVersion.document_type == document_type,
                PromptVersion.level == "medium",
                PromptVersion.status == "active",
            )
        ).first()
        if prompt is None:
            prompt = PromptVersion(
                document_type=document_type,
                level="medium",
                version="v1",
                content="prompt",
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(prompt)
            session.commit()
            session.refresh(prompt)

        policy = session.exec(
            select(EvaluationPolicy).where(EvaluationPolicy.level == "medium", EvaluationPolicy.status == "active")
        ).first()
        if policy is None:
            policy = EvaluationPolicy(
                level="medium",
                version="v1",
                content="policy",
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(policy)
            session.commit()
            session.refresh(policy)

        rules = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.status == "active")).first()
        if rules is None:
            rules = RequiredRuleSet(
                version="system-rules-v1",
                hash="hash",
                content='["JSON only"]',
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(rules)
            session.commit()
            session.refresh(rules)

        eval_set = session.exec(
            select(EvaluationSet).where(
                EvaluationSet.document_type == document_type,
                EvaluationSet.level == "medium",
                EvaluationSet.status == "active",
            )
        ).first()
        if eval_set is None:
            eval_set = EvaluationSet(
                name=f"{document_type}-medium-set-v1",
                document_type=document_type,
                level="medium",
                rubric_version_id=rubric.id,
                prompt_version_id=prompt.id,
                policy_version_id=policy.id,
                required_rule_set_id=rules.id,
                required_rules_version=rules.version,
                required_rule_hash=rules.hash,
                version_label=f"{document_type}-medium-set-v1",
                status="active",
                created_at="2026-01-01T00:00:00Z",
            )
            session.add(eval_set)
            session.commit()
            session.refresh(eval_set)

        run = GradingRun(
            submission_id=sub.id,
            document_version_id=version.id,
            document_version=version.document_version,
            rubric_version="v1",
            prompt_level="medium",
            content_hash=version.content_hash,
            status="PENDING",
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        run_id = run.id
        version_id = version.id
        eval_set_id = eval_set.id

    fake_result = {
        "score": 90,
        "total_score": 100,
        "rubric_version": "v1",
        "rubric_hash": "rh",
        "gemini_model": "mock",
        "prompt_version": "v1",
        "prompt_level": "medium",
        "policy_version": "v1",
        "policy_hash": "ph",
        "required_rule_set_id": None,
        "required_rule_hash": "rrh",
        "prompt_hash": "prh",
        "criteria_hash": "ch",
        "grading_schema_version": "v1",
        "project_description_hash": None,
        "final_prompt_snapshot": "snapshot",
        "evaluation_set_id": eval_set_id,
        "draft_feedback": {"vi": "ok", "ja": "ok"},
        "document_type": "project-review",
        "criteria_scores": {
            "review_tong_the": 25,
            "diem_tot": 25,
            "diem_xau": 30,
            "chinh_sach": 20,
        },
        "criteria_suggestions": {"vi": {}, "ja": {}},
        "slide_reviews": [],
    }

    with patch("app.services.grading_service.build_grading_signature") as mock_sig, patch(
        "app.services.grading_service.grade_submission"
    ) as mock_grade:
        mock_sig.return_value = {
            "document_type": "project-review",
            "rubric_version": "v1",
            "prompt_level": "medium",
            "content_hash": "h",
            "rubric_hash": "rh",
            "criteria_hash": "ch",
            "prompt_version": "v1",
            "prompt_hash": "prh",
            "policy_version": "v1",
            "policy_hash": "ph",
            "required_rule_hash": "rrh",
            "gemini_model": "mock",
            "grading_schema_version": "v1",
            "project_description_hash": None,
            "evaluation_set_id": eval_set_id,
        }
        mock_grade.return_value = fake_result

        # Simulate retry/redelivery using the same grading_run_id
        grade_document_version_task("CELERY-TEST", version_id, run_id, evaluation_set_id=eval_set_id)
        grade_document_version_task("CELERY-TEST", version_id, run_id, evaluation_set_id=eval_set_id)

    with Session(engine) as session:
        rows = session.exec(
            select(GradingCriteriaResult).where(GradingCriteriaResult.grading_run_id == run_id)
        ).all()
        assert len(rows) == 4


def test_create_pending_run_concurrent_only_one_active_run():
    with Session(engine) as session:
        session.exec(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_gradingrun_active_eval_context
                ON gradingrun (document_version_id, evaluation_set_id, lower(prompt_level))
                WHERE status IN ('PENDING','EXTRACTING','GRADING')
                """
            )
        )
        session.commit()
        sub = session.exec(select(Submission).where(Submission.project_id == "CELERY-TEST")).first()
        version = session.exec(
            select(SubmissionDocumentVersion).where(SubmissionDocumentVersion.submission_id == sub.id)
        ).first()
        doc = session.exec(select(SubmissionDocument).where(SubmissionDocument.id == version.document_id)).first()
        document_type = doc.document_type if doc else "project-review"
        eval_set = session.exec(
            select(EvaluationSet).where(
                EvaluationSet.document_type == document_type,
                EvaluationSet.level == "medium",
                EvaluationSet.status == "active",
            )
        ).first()
        assert eval_set is not None
        eval_set_id = eval_set.id
        version_id = version.id
        submission_id = sub.id
        session.exec(
            delete(GradingRun).where(
                GradingRun.document_version_id == version_id,
                GradingRun.evaluation_set_id == eval_set_id,
                GradingRun.prompt_level == "medium",
                GradingRun.status.in_(["PENDING", "EXTRACTING", "GRADING"]),
            )
        )
        session.commit()

    def worker() -> int:
        with Session(engine) as thread_session:
            sub_repo = SubmissionRepository(thread_session)
            grading_repo = GradingRepository(thread_session)
            service = GradingService(sub_repo, grading_repo)
            run = service.create_pending_run(
                submission_id=submission_id,
                document_version_id=version_id,
                document_version="v1",
                rubric_version="v1",
                prompt_level="medium",
                content_hash="hash123",
                evaluation_set_id=eval_set_id,
            )
            return run.id

    with ThreadPoolExecutor(max_workers=8) as executor:
        run_ids = list(executor.map(lambda _: worker(), range(8)))

    assert len(set(run_ids)) == 1
    with Session(engine) as session:
        active_runs = session.exec(
            select(GradingRun).where(
                GradingRun.document_version_id == version_id,
                GradingRun.evaluation_set_id == eval_set_id,
                GradingRun.prompt_level == "medium",
                GradingRun.status.in_(["PENDING", "EXTRACTING", "GRADING"]),
            )
        ).all()
        assert len(active_runs) == 1

from sqlalchemy import text
if __name__ == "__main__":
    # This is a pytest file, but can be run with pytest
    pass
