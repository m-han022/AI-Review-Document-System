from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select

from app.models import EvaluationSet
from app.services.evaluation_set_service import ensure_active_evaluation_set
from app.services.prompt_policy import normalize_prompt_level


@dataclass
class ResolvedEvaluationBundle:
    evaluation_set: EvaluationSet
    document_type: str
    level: str
    resolution_reason: str


def resolve_evaluation_bundle(
    session: Session,
    *,
    document_type: str,
    level: str,
    evaluation_set_id: Optional[int] = None,
) -> ResolvedEvaluationBundle:
    normalized_document_type = (document_type or "project-review").strip() or "project-review"
    normalized_level = normalize_prompt_level(level)

    if evaluation_set_id is not None:
        picked = session.get(EvaluationSet, evaluation_set_id)
        if not picked:
            raise ValueError(f"Evaluation set not found: {evaluation_set_id}")
        if picked.status != "active":
            raise ValueError(f"Evaluation set is not active: {evaluation_set_id}")
        if picked.document_type != normalized_document_type:
            raise ValueError(
                f"Evaluation set {evaluation_set_id} does not match document_type '{normalized_document_type}'"
            )
        return ResolvedEvaluationBundle(
            evaluation_set=picked,
            document_type=picked.document_type,
            level=normalize_prompt_level(picked.level),
            resolution_reason="explicit_evaluation_set_id",
        )

    active = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == normalized_document_type,
            EvaluationSet.level == normalized_level,
            EvaluationSet.status == "active",
        )
    ).first()
    if active:
        return ResolvedEvaluationBundle(
            evaluation_set=active,
            document_type=active.document_type,
            level=normalize_prompt_level(active.level),
            resolution_reason="active_scope_match",
        )

    ensured = ensure_active_evaluation_set(session, normalized_document_type, normalized_level)
    return ResolvedEvaluationBundle(
        evaluation_set=ensured,
        document_type=ensured.document_type,
        level=normalize_prompt_level(ensured.level),
        resolution_reason="auto_bootstrap_scope",
    )

