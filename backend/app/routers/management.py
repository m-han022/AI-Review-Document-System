from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import EvaluationPolicy, PromptVersion, Rubric, RubricCriterionRecord
from app.rubric import _rubric_out
from app.services.prompt_composer import OUTPUT_SCHEMA_HINT, REQUIRED_RULES, stable_hash
from app.services.prompt_policy import _now, normalize_prompt_level

router = APIRouter()


class RubricOut(BaseModel):
    id: int
    document_type: str
    version: str
    status: str
    active: bool
    prompt: dict[str, str]
    created_at: str
    updated_at: str
    hash: str
    summary: Optional[str] = None


class RubricCreateIn(BaseModel):
    document_type: str
    version: str
    prompt: dict[str, str]
    criteria: list[dict[str, Any]]
    summary: Optional[str] = None
    activate: bool = True


class PolicyOut(BaseModel):
    id: int
    level: str
    version: str
    content: str
    status: str
    created_at: str
    hash: str


class PolicyCreateIn(BaseModel):
    level: str
    version: str
    content: str
    activate: bool = True


class PromptOut(BaseModel):
    id: int
    document_type: str
    level: str
    version: str
    content: str
    status: str
    created_at: str
    hash: str


class PromptCreateIn(BaseModel):
    document_type: str
    level: str
    version: str
    content: str
    activate: bool = True


def _archive_active_policies(session: Session, level: str) -> None:
    old_actives = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")
    ).all()
    for old in old_actives:
        old.status = "archived"


def _archive_active_prompts(session: Session, document_type: str, level: str) -> None:
    old_actives = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == level,
            PromptVersion.status == "active",
        )
    ).all()
    for old in old_actives:
        old.status = "archived"


def _archive_active_rubrics(session: Session, document_type: str) -> None:
    old_actives = session.exec(
        select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
    ).all()
    for old in old_actives:
        old.status = "archived"
        old.active = False
        old.updated_at = _now()


@router.get("/rubrics")
async def list_rubrics(
    document_type: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(Rubric).order_by(Rubric.document_type, Rubric.version)
    if document_type:
        statement = statement.where(Rubric.document_type == document_type)
    rubrics = session.exec(statement).all()
    result: list[RubricOut] = []
    for rubric in rubrics:
        rubric_bundle = _rubric_out(session, rubric)
        rubric_hash = stable_hash(
            {
                "document_type": rubric.document_type,
                "version": rubric.version,
                "prompt": rubric.prompt,
                "criteria": [item.model_dump() for item in rubric_bundle.criteria],
            }
        )
        result.append(
            RubricOut(
                id=rubric.id or 0,
                document_type=rubric.document_type,
                version=rubric.version,
                status=rubric.status,
                active=bool(rubric.active),
                prompt=rubric.prompt or {},
                created_at=rubric.created_at,
                updated_at=rubric.updated_at,
                hash=rubric_hash,
                summary=f"{len(rubric_bundle.criteria)} criteria",
            )
        )
    return result


@router.post("/rubrics")
async def create_rubric(payload: RubricCreateIn, session: Session = Depends(get_session)):
    existing = session.exec(
        select(Rubric).where(Rubric.document_type == payload.document_type, Rubric.version == payload.version)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rubric version already exists and is immutable")

    now = _now()
    rubric = Rubric(
        document_type=payload.document_type,
        version=payload.version,
        active=bool(payload.activate),
        status="active" if payload.activate else "archived",
        prompt=payload.prompt,
        created_at=now,
        updated_at=now,
    )
    if payload.activate:
        _archive_active_rubrics(session, payload.document_type)

    session.add(rubric)
    session.commit()
    session.refresh(rubric)

    criteria_records = []
    for index, criterion in enumerate(payload.criteria):
        criteria_records.append(
            RubricCriterionRecord(
                rubric_id=rubric.id or 0,
                key=criterion["key"],
                max_score=float(criterion["max_score"]),
                label_vi=(criterion.get("labels") or {}).get("vi", criterion["key"]),
                label_ja=(criterion.get("labels") or {}).get("ja", criterion["key"]),
                sort_order=index,
            )
        )
    for item in criteria_records:
        session.add(item)
    session.commit()
    session.refresh(rubric)
    return (await list_rubrics(payload.document_type, session=session))[-1]


@router.post("/rubrics/{rubric_id}/activate")
async def activate_rubric(rubric_id: int, session: Session = Depends(get_session)):
    rubric = session.get(Rubric, rubric_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    _archive_active_rubrics(session, rubric.document_type)
    rubric.status = "active"
    rubric.active = True
    rubric.updated_at = _now()
    session.add(rubric)
    session.commit()
    session.refresh(rubric)
    return (await list_rubrics(rubric.document_type, session=session))[-1]


@router.get("/policies")
async def list_policies(
    level: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(EvaluationPolicy).order_by(EvaluationPolicy.level, EvaluationPolicy.version)
    if level:
        statement = statement.where(EvaluationPolicy.level == normalize_prompt_level(level))
    policies = session.exec(statement).all()
    return [
        PolicyOut(
            id=policy.id or 0,
            level=policy.level,
            version=policy.version,
            content=policy.content,
            status=policy.status,
            created_at=policy.created_at,
            hash=stable_hash(policy.content),
        )
        for policy in policies
    ]


@router.post("/policies")
async def create_policy(payload: PolicyCreateIn, session: Session = Depends(get_session)):
    level = normalize_prompt_level(payload.level)
    existing = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.version == payload.version)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Policy version already exists and is immutable")

    if payload.activate:
        _archive_active_policies(session, level)

    policy = EvaluationPolicy(
        level=level,
        version=payload.version,
        content=payload.content,
        status="active" if payload.activate else "archived",
        created_at=_now(),
    )
    session.add(policy)
    session.commit()
    session.refresh(policy)
    return PolicyOut(
        id=policy.id or 0,
        level=policy.level,
        version=policy.version,
        content=policy.content,
        status=policy.status,
        created_at=policy.created_at,
        hash=stable_hash(policy.content),
    )


@router.post("/policies/{policy_id}/activate")
async def activate_policy(policy_id: int, session: Session = Depends(get_session)):
    policy = session.get(EvaluationPolicy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    _archive_active_policies(session, policy.level)
    policy.status = "active"
    session.add(policy)
    session.commit()
    session.refresh(policy)
    return PolicyOut(
        id=policy.id or 0,
        level=policy.level,
        version=policy.version,
        content=policy.content,
        status=policy.status,
        created_at=policy.created_at,
        hash=stable_hash(policy.content),
    )


@router.get("/prompts")
async def list_prompts(
    document_type: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(PromptVersion).order_by(
        PromptVersion.document_type, PromptVersion.level, PromptVersion.version
    )
    if document_type:
        statement = statement.where(PromptVersion.document_type == document_type)
    if level:
        statement = statement.where(PromptVersion.level == normalize_prompt_level(level))
    prompts = session.exec(statement).all()
    return [
        PromptOut(
            id=prompt.id or 0,
            document_type=prompt.document_type,
            level=prompt.level,
            version=prompt.version,
            content=prompt.content,
            status=prompt.status,
            created_at=prompt.created_at,
            hash=stable_hash(prompt.content),
        )
        for prompt in prompts
    ]


@router.post("/prompts")
async def create_prompt(payload: PromptCreateIn, session: Session = Depends(get_session)):
    level = normalize_prompt_level(payload.level)
    existing = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == payload.document_type,
            PromptVersion.level == level,
            PromptVersion.version == payload.version,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prompt version already exists and is immutable")

    if payload.activate:
        _archive_active_prompts(session, payload.document_type, level)

    prompt = PromptVersion(
        document_type=payload.document_type,
        level=level,
        version=payload.version,
        content=payload.content,
        status="active" if payload.activate else "archived",
        created_at=_now(),
    )
    session.add(prompt)
    session.commit()
    session.refresh(prompt)
    return PromptOut(
        id=prompt.id or 0,
        document_type=prompt.document_type,
        level=prompt.level,
        version=prompt.version,
        content=prompt.content,
        status=prompt.status,
        created_at=prompt.created_at,
        hash=stable_hash(prompt.content),
    )


@router.post("/prompts/{prompt_id}/activate")
async def activate_prompt(prompt_id: int, session: Session = Depends(get_session)):
    prompt = session.get(PromptVersion, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    _archive_active_prompts(session, prompt.document_type, prompt.level)
    prompt.status = "active"
    session.add(prompt)
    session.commit()
    session.refresh(prompt)
    return PromptOut(
        id=prompt.id or 0,
        document_type=prompt.document_type,
        level=prompt.level,
        version=prompt.version,
        content=prompt.content,
        status=prompt.status,
        created_at=prompt.created_at,
        hash=stable_hash(prompt.content),
    )


@router.get("/required-rules")
async def get_required_rules():
    return {"rules": REQUIRED_RULES, "hash": stable_hash(REQUIRED_RULES)}


@router.get("/final-prompt/preview")
async def final_prompt_preview(
    document_type: str,
    level: str = Query(default="medium"),
    session: Session = Depends(get_session),
):
    normalized_level = normalize_prompt_level(level)
    rubric = session.exec(
        select(Rubric).where(Rubric.document_type == document_type, Rubric.status == "active")
    ).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="No active rubric found for document_type")

    policy = session.exec(
        select(EvaluationPolicy).where(
            EvaluationPolicy.level == normalized_level, EvaluationPolicy.status == "active"
        )
    ).first()
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found for level")

    prompt = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == normalized_level,
            PromptVersion.status == "active",
        )
    ).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="No active prompt found for document_type + level")

    rubric_bundle = _rubric_out(session, rubric)
    rubric_text = (rubric.prompt or {}).get("vi") or (rubric.prompt or {}).get("ja") or ""
    full_preview = "\n\n".join(
        [
            "---- Required Rules ----",
            "\n".join(REQUIRED_RULES),
            "---- Rubric ----",
            rubric_text,
            "---- Evaluation Policy ----",
            policy.content,
            "---- Prompt Version ----",
            prompt.content,
            "---- Output Schema ----",
            OUTPUT_SCHEMA_HINT,
        ]
    )
    return {
        "document_type": document_type,
        "level": normalized_level,
        "rubric_version": rubric.version,
        "rubric_hash": stable_hash(
            {
                "prompt": rubric.prompt,
                "criteria": [item.model_dump() for item in rubric_bundle.criteria],
            }
        ),
        "prompt_version": prompt.version,
        "prompt_hash": stable_hash(prompt.content),
        "policy_version": policy.version,
        "policy_hash": stable_hash(policy.content),
        "required_rule_hash": stable_hash(REQUIRED_RULES),
        "full_prompt_preview": full_preview,
    }
