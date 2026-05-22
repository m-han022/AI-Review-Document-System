from sqlmodel import Session
import pytest
import uuid

from app.database import engine
from app.models import EvaluationSet, Rubric, PromptVersion, EvaluationPolicy
from app.services.prompt_policy import _now
from app.services.evaluation_bundle_resolver import resolve_evaluation_bundle


def test_resolve_bundle_by_explicit_id():
    with Session(engine) as session:
        item = session.query(EvaluationSet).filter(EvaluationSet.status == "active").first()
        assert item is not None
        resolved = resolve_evaluation_bundle(
            session,
            document_type=item.document_type,
            level=item.level,
            evaluation_set_id=item.id,
        )
        assert resolved.evaluation_set.id == item.id
        assert resolved.resolution_reason == "explicit_evaluation_set_id"


def test_resolve_bundle_by_active_scope():
    with Session(engine) as session:
        item = session.query(EvaluationSet).filter(EvaluationSet.status == "active").first()
        assert item is not None
        resolved = resolve_evaluation_bundle(
            session,
            document_type=item.document_type,
            level=item.level,
        )
        assert resolved.evaluation_set.id == item.id
        assert resolved.resolution_reason == "active_scope_match"


def test_resolve_bundle_explicit_id_mismatch_document_type():
    with Session(engine) as session:
        item = session.query(EvaluationSet).filter(EvaluationSet.status == "active").first()
        assert item is not None
        wrong_doc_type = "bug-analysis" if item.document_type != "bug-analysis" else "project-review"
        with pytest.raises(ValueError, match="does not match document_type"):
            resolve_evaluation_bundle(
                session,
                document_type=wrong_doc_type,
                level=item.level,
                evaluation_set_id=item.id,
            )


def test_resolve_bundle_explicit_id_inactive_status_fails():
    with Session(engine) as session:
        item = session.query(EvaluationSet).filter(EvaluationSet.status == "active").first()
        assert item is not None
        item.status = "archived"
        session.add(item)
        session.commit()
        with pytest.raises(ValueError, match="is not active"):
            resolve_evaluation_bundle(
                session,
                document_type=item.document_type,
                level=item.level,
                evaluation_set_id=item.id,
            )


def test_resolve_bundle_auto_bootstrap_scope_when_no_active_set():
    suffix = uuid.uuid4().hex[:8]
    document_type = f"bootstrap-doc-type-{suffix}"
    level = "medium"
    with Session(engine) as session:
        rubric = Rubric(
            document_type=document_type,
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
            document_type=document_type,
            level=level,
            version="v1",
            content="prompt",
            status="active",
            created_at=_now(),
        )
        session.add(prompt)
        session.commit()

        policy = EvaluationPolicy(
            level=level,
            version=f"v-bootstrap-{suffix}",
            content="policy",
            status="active",
            created_at=_now(),
        )
        session.add(policy)
        session.commit()

        # No active EvaluationSet yet for this scope -> resolver should auto-bootstrap.
        resolved = resolve_evaluation_bundle(
            session,
            document_type=document_type,
            level=level,
        )
        assert resolved.evaluation_set is not None
        assert resolved.evaluation_set.document_type == document_type
        assert resolved.evaluation_set.level == level
        assert resolved.resolution_reason == "auto_bootstrap_scope"
