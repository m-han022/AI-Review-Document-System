from __future__ import annotations

from typing import Optional

from sqlmodel import Session, select

from app.models import EvaluationSet
from app.services.prompt_policy import normalize_prompt_level


def list_bundles(session: Session, document_type: Optional[str] = None, level: Optional[str] = None) -> list[EvaluationSet]:
    stmt = select(EvaluationSet).order_by(EvaluationSet.created_at.desc(), EvaluationSet.id.desc())
    if document_type:
        stmt = stmt.where(EvaluationSet.document_type == document_type)
    if level:
        stmt = stmt.where(EvaluationSet.level == normalize_prompt_level(level))
    return session.exec(stmt).all()


def get_bundle_by_id(session: Session, bundle_id: int) -> EvaluationSet | None:
    return session.get(EvaluationSet, bundle_id)


def get_active_bundle(session: Session, document_type: str, level: str = "medium") -> EvaluationSet | None:
    return session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == normalize_prompt_level(level),
            EvaluationSet.status == "active",
        )
    ).first()

