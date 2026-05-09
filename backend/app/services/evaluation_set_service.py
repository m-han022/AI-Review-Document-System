from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select
from app.models import EvaluationSet, Rubric, PromptVersion, EvaluationPolicy, RequiredRuleSet
from app.services.prompt_policy import normalize_prompt_level, _now, get_active_prompt_version, get_active_policy
from app.services.prompt_composer import get_active_required_rule_set
from app.rubric import RUBRIC_TEMPLATES_FILE, _normalize_prompt

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
        return existing

    # 2. Find dependencies
    rubric = session.exec(
        select(Rubric).where(Rubric.document_type == document_type, Rubric.active == True)
    ).first()
    if not rubric:
        # Try any active status as fallback
        rubric = session.exec(
            select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
        ).first()
    
    if not rubric:
        # We need a rubric. If it's missing, we might need to seed it or fail.
        # For now, if it's missing, bootstrap will fail, but usually rubrics are seeded on startup.
        pass

    prompt = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == lvl,
            PromptVersion.status == "active",
        )
    ).first()
    
    policy = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == lvl, EvaluationPolicy.status == "active")
    ).first()

    # Note: prompt and policy have auto-seed in prompt_policy.py, 
    # but here we query directly. To be safe, we could call the get_active_* helpers.
    if not prompt:
        from app.services.prompt_policy import get_active_prompt_version
        prompt = get_active_prompt_version(document_type, lvl)
    
    if not policy:
        from app.services.prompt_policy import get_active_policy
        policy = get_active_policy(lvl)

    if not rubric:
        # If still no rubric, we can't bootstrap. 
        # But in a real system, we might want to create a blank or default rubric.
        # For now, we'll raise an error that will be caught.
        raise ValueError(f"Cannot bootstrap EvaluationSet: No active rubric for {document_type}")

    active_rule_set = get_active_required_rule_set(session)
    
    if not rubric:
        # ATTEMPT ON-THE-FLY SEEDING FROM TEMPLATE
        from app.rubric import RUBRIC_TEMPLATES
        if document_type in RUBRIC_TEMPLATES:
            template = RUBRIC_TEMPLATES[document_type]
            timestamp = _now()
            from app.models import RubricCriterionRecord
            
            # 1. Create Rubric
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

            # 2. Create Criteria
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
    
    if not rubric:
        # If still no rubric, we can't bootstrap. 
        raise ValueError(f"Cannot bootstrap EvaluationSet: No active rubric for {document_type} and no template found.")
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
