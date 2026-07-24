from __future__ import annotations
import json
import re
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select
from app.models import EvaluationSet, Rubric, PromptVersion, EvaluationPolicy, RequiredRuleSet, RubricCriterionRecord
from app.services.prompt_policy import normalize_prompt_level, _now, POLICY_TEXT
from app.services.prompt_composer import get_active_required_rule_set
from app.rubric import RUBRIC_TEMPLATES, _normalize_prompt

DEFAULT_PROMPT_CONTENT_VI = (
    "[QUAN TRONG: PHAN HOI BANG TIENG VIET]\n"
    "Ban la chuyen gia PMO. Hay danh gia tai lieu theo dung rubric va policy hien hanh.\n"
    "Yeu cau bat buoc:\n"
    "- Chi tra ve JSON hop le theo output schema, khong them text ngoai JSON.\n"
    "- Khong dung markdown/code block.\n"
    "- Khong bia thong tin ngoai tai lieu.\n"
    "- Voi tung tieu chi, neu ro van de va de xuat hanh dong cai thien cu the.\n"
    "- Review day du tung trang voi trang thai OK/NG, neu ly do va huong sua.\n"
    "- Schema toi thieu phai co: score, criteria_scores, criteria_suggestions{vi,ja}, draft_feedback{vi,ja}, page_reviews[].\n"
    "- Moi item trong page_reviews phai co: page_number, status, title{vi,ja}, summary{vi,ja}, issues{vi,ja}, suggestions{vi,ja}."
)


def _looks_like_mojibake_prompt(content: str) -> bool:
    text = (content or "").strip()
    if not text:
        return False
    if re.search(r"[A-Za-z]\?[A-Za-z]|\?{2,}", text):
        return True
    markers = [
        "QUAN TRONG",
        "PHAN HOI",
        "TIENG VIET",
        "Khong",
        "bia",
        "danh gia",
    ]
    return any(marker in text for marker in markers)


def _ensure_active_prompt(session: Session, document_type: str, level: str) -> PromptVersion:
    active = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == level,
            PromptVersion.status == "active",
        )
    ).first()
    if active:
        if _looks_like_mojibake_prompt(active.content):
            active.content = DEFAULT_PROMPT_CONTENT_VI
            session.add(active)
            session.commit()
            session.refresh(active)
        return active
    prompt = PromptVersion(
        document_type=document_type,
        level=level,
        version="v1",
        content=DEFAULT_PROMPT_CONTENT_VI,
        status="active",
        created_at=_now(),
    )
    session.add(prompt)
    session.commit()
    session.refresh(prompt)
    return prompt


def _ensure_active_policy(session: Session, level: str) -> EvaluationPolicy:
    active = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")
    ).first()
    if active:
        return active
    fallback_policy = POLICY_TEXT.get(level) or POLICY_TEXT.get("medium") or "Follow PMO evaluation policy."
    if isinstance(fallback_policy, dict):
        fallback_policy = fallback_policy.get("vi") or fallback_policy.get("ja") or json.dumps(fallback_policy, ensure_ascii=False)
    policy = EvaluationPolicy(
        level=level,
        version="v1",
        content=fallback_policy,
        status="active",
        created_at=_now(),
    )
    session.add(policy)
    session.commit()
    session.refresh(policy)
    return policy


def _rubric_has_criteria(session: Session, rubric_id: int | None) -> bool:
    if not rubric_id:
        return False
    row = session.exec(
        select(RubricCriterionRecord.id).where(RubricCriterionRecord.rubric_id == rubric_id)
    ).first()
    return row is not None

def _archive_active_sets(session: Session, document_type: str, level: str) -> None:
    lvl = normalize_prompt_level(level)
    existing_actives = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == lvl,
            EvaluationSet.status == "active",
        )
    ).all()
    for s in existing_actives:
        s.status = "archived"
    session.commit()

def _next_set_version_label(session: Session, document_type: str, level: str) -> str:
    lvl = normalize_prompt_level(level)
    count = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == lvl,
        )
    ).all()
    return f"v{len(count) + 1}"

def bootstrap_evaluation_set_logic(
    session: Session, 
    document_type: str, 
    level: str, 
    name: Optional[str] = None
) -> EvaluationSet:
    """
    Core logic to bootstrap an evaluation set.
    Ensures that active rubric, prompt, and policy exist (using auto-seed if necessary).
    """
    lvl = normalize_prompt_level(level)
    
    # 1. Check if already exists and active
    existing = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == lvl,
            EvaluationSet.status == "active",
        )
    ).first()
    if existing:
        rubric_ref = session.get(Rubric, existing.rubric_version_id)
        if rubric_ref and _rubric_has_criteria(session, rubric_ref.id):
            return existing
        existing.status = "archived"
        session.add(existing)
        session.commit()

    # 2. Find dependencies
    rubric = session.exec(
        select(Rubric).where(Rubric.document_type == document_type, Rubric.active == True)
    ).first()
    if not rubric:
        # Try any active status as fallback
        rubric = session.exec(
            select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
        ).first()
    
    if not rubric and document_type in RUBRIC_TEMPLATES:
        template = RUBRIC_TEMPLATES[document_type]
        timestamp = _now()
        new_rubric = Rubric(
            document_type=document_type,
            version=template.get("version", "v1"),
            active=True,
            status="active",
            prompt=_normalize_prompt(template.get("instruction", {})),
            created_at=timestamp,
            updated_at=timestamp,
        )
        session.add(new_rubric)
        session.commit()
        session.refresh(new_rubric)

        for index, criterion in enumerate(template.get("criteria", [])):
            session.add(
                RubricCriterionRecord(
                    rubric_id=new_rubric.id,
                    key=criterion["key"],
                    max_score=float(criterion["max_score"]),
                    label_vi=criterion.get("label", {}).get("vi", criterion["key"]),
                    label_ja=criterion.get("label", {}).get("ja", criterion["key"]),
                    sort_order=index,
                )
            )
        session.commit()
        session.refresh(new_rubric)
        rubric = new_rubric

    prompt = _ensure_active_prompt(session, document_type, lvl)
    policy = _ensure_active_policy(session, lvl)

    active_rule_set = get_active_required_rule_set(session)

    if not rubric:
        # If still no rubric, we can't bootstrap. 
        raise ValueError(f"Cannot bootstrap EvaluationSet: No active rubric for {document_type} and no template found.")
    if not _rubric_has_criteria(session, rubric.id):
        raise ValueError(
            f"Cannot bootstrap EvaluationSet: rubric {document_type}/{rubric.version} has no criteria"
        )
    new_set = EvaluationSet(
        name=name or f"{document_type}-{lvl}-auto-v1",
        document_type=document_type,
        level=lvl,
        rubric_version_id=rubric.id or 0,
        prompt_version_id=prompt.id or 0,
        policy_version_id=policy.id or 0,
        required_rule_set_id=active_rule_set.id,
        required_rules_version=active_rule_set.version,
        required_rule_hash=active_rule_set.hash,
        version_label=_next_set_version_label(session, document_type, lvl),
        status="active",
        created_at=_now(),
    )
    
    _archive_active_sets(session, document_type, lvl)
    session.add(new_set)
    session.commit()
    session.refresh(new_set)
    return new_set

def ensure_active_evaluation_set(session: Session, document_type: str, level: str) -> EvaluationSet:
    """
    Public entry point for grading flow. Always returns an active set or creates one.
    """
    lvl = normalize_prompt_level(level)
    active = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == lvl,
            EvaluationSet.status == "active",
        )
    ).first()
    
    if active:
        return active
        
    # Lazy bootstrap
    try:
        return bootstrap_evaluation_set_logic(session, document_type, lvl)
    except Exception as e:
        # If bootstrap fails, we might still return None or raise
        raise RuntimeError(f"Failed to auto-bootstrap evaluation set for {document_type}/{lvl}: {str(e)}")
