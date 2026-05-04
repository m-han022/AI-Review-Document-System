from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import EvaluationPolicy, PromptVersion
from app.services.prompt_composer import stable_hash
from app.services.prompt_policy import _now, normalize_prompt_level

router = APIRouter()


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


@router.get("/policies")
async def list_policies(level: Optional[str] = Query(default=None), session: Session = Depends(get_session)):
    statement = select(EvaluationPolicy).order_by(EvaluationPolicy.level, EvaluationPolicy.version)
    if level:
        statement = statement.where(EvaluationPolicy.level == normalize_prompt_level(level))
    policies = session.exec(statement).all()
    return [
        PolicyOut(
            id=item.id or 0,
            level=item.level,
            version=item.version,
            content=item.content,
            status=item.status,
            created_at=item.created_at,
            hash=stable_hash(item.content),
        )
        for item in policies
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
        old_actives = session.exec(
            select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")
        ).all()
        for old in old_actives:
            old.status = "archived"

    item = EvaluationPolicy(
        level=level,
        version=payload.version,
        content=payload.content,
        status="active" if payload.activate else "archived",
        created_at=_now(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return PolicyOut(
        id=item.id or 0,
        level=item.level,
        version=item.version,
        content=item.content,
        status=item.status,
        created_at=item.created_at,
        hash=stable_hash(item.content),
    )


@router.post("/policies/{policy_id}/activate")
async def activate_policy(policy_id: int, session: Session = Depends(get_session)):
    item = session.get(EvaluationPolicy, policy_id)
    if not item:
        raise HTTPException(status_code=404, detail="Policy not found")
    old_actives = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == item.level, EvaluationPolicy.status == "active")
    ).all()
    for old in old_actives:
        old.status = "archived"
    item.status = "active"
    session.add(item)
    session.commit()
    session.refresh(item)
    return PolicyOut(
        id=item.id or 0,
        level=item.level,
        version=item.version,
        content=item.content,
        status=item.status,
        created_at=item.created_at,
        hash=stable_hash(item.content),
    )


@router.get("/prompts")
async def list_prompts(
    document_type: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(PromptVersion).order_by(PromptVersion.document_type, PromptVersion.level, PromptVersion.version)
    if document_type:
        statement = statement.where(PromptVersion.document_type == document_type)
    if level:
        statement = statement.where(PromptVersion.level == normalize_prompt_level(level))
    prompts = session.exec(statement).all()
    return [
        PromptOut(
            id=item.id or 0,
            document_type=item.document_type,
            level=item.level,
            version=item.version,
            content=item.content,
            status=item.status,
            created_at=item.created_at,
            hash=stable_hash(item.content),
        )
        for item in prompts
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
        old_actives = session.exec(
            select(PromptVersion).where(
                PromptVersion.document_type == payload.document_type,
                PromptVersion.level == level,
                PromptVersion.status == "active",
            )
        ).all()
        for old in old_actives:
            old.status = "archived"

    item = PromptVersion(
        document_type=payload.document_type,
        level=level,
        version=payload.version,
        content=payload.content,
        status="active" if payload.activate else "archived",
        created_at=_now(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return PromptOut(
        id=item.id or 0,
        document_type=item.document_type,
        level=item.level,
        version=item.version,
        content=item.content,
        status=item.status,
        created_at=item.created_at,
        hash=stable_hash(item.content),
    )


@router.post("/prompts/{prompt_id}/activate")
async def activate_prompt(prompt_id: int, session: Session = Depends(get_session)):
    item = session.get(PromptVersion, prompt_id)
    if not item:
        raise HTTPException(status_code=404, detail="Prompt not found")
    old_actives = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == item.document_type,
            PromptVersion.level == item.level,
            PromptVersion.status == "active",
        )
    ).all()
    for old in old_actives:
        old.status = "archived"
    item.status = "active"
    session.add(item)
    session.commit()
    session.refresh(item)
    return PromptOut(
        id=item.id or 0,
        document_type=item.document_type,
        level=item.level,
        version=item.version,
        content=item.content,
        status=item.status,
        created_at=item.created_at,
        hash=stable_hash(item.content),
    )
