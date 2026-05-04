import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import EvaluationPolicy, PromptVersion, Rubric, RubricCriterionRecord, EvaluationSet
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

class EvaluationSetOut(BaseModel):
    id: int
    name: str
    document_type: str
    level: str
    rubric_version_id: int
    prompt_version_id: int
    policy_version_id: int
    required_rules_version: str
    required_rule_hash: str
    version_label: Optional[str] = None
    status: str
    created_at: str

class EvaluationSetCreateIn(BaseModel):
    base_set_id: int
    name: str
    changes: dict[str, Optional[str]] = {}
    activate: bool = True


class EvaluationSetBootstrapIn(BaseModel):
    document_type: str
    level: str
    name: Optional[str] = None


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

def _archive_active_sets(session: Session, document_type: str, level: str) -> None:
    old_sets = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == level,
            EvaluationSet.status == "active",
        )
    ).all()
    for old in old_sets:
        old.status = "archived"


def _version_num(version: str) -> int:
    m = re.match(r"^v(\d+)$", (version or "").strip(), re.IGNORECASE)
    return int(m.group(1)) if m else 0


def _next_version_prompt(session: Session, document_type: str, level: str) -> str:
    rows = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == document_type,
            PromptVersion.level == level,
        )
    ).all()
    max_num = max((_version_num(row.version) for row in rows), default=0)
    return f"v{max_num + 1}"


def _next_version_rubric(session: Session, document_type: str) -> str:
    rows = session.exec(select(Rubric).where(Rubric.document_type == document_type)).all()
    max_num = max((_version_num(row.version) for row in rows), default=0)
    return f"v{max_num + 1}"


def _next_version_policy(session: Session, level: str) -> str:
    rows = session.exec(select(EvaluationPolicy).where(EvaluationPolicy.level == level)).all()
    max_num = max((_version_num(row.version) for row in rows), default=0)
    return f"v{max_num + 1}"


def _next_set_version_label(session: Session, document_type: str, level: str) -> str:
    rows = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == level,
        )
    ).all()
    prefix = f"{document_type}-{level}-set-v"
    max_num = 0
    for row in rows:
        label = (row.version_label or "").strip()
        if label.startswith(prefix):
            suffix = label[len(prefix):]
            if suffix.isdigit():
                max_num = max(max_num, int(suffix))
    return f"{prefix}{max_num + 1}"


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

@router.get("/evaluation-sets")
async def list_evaluation_sets(
    document_type: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    stmt = select(EvaluationSet).order_by(EvaluationSet.created_at.desc(), EvaluationSet.id.desc())
    if document_type:
        stmt = stmt.where(EvaluationSet.document_type == document_type)
    if level:
        stmt = stmt.where(EvaluationSet.level == normalize_prompt_level(level))
    rows = session.exec(stmt).all()
    return [EvaluationSetOut(**row.model_dump()) for row in rows]

@router.get("/evaluation-sets/active")
async def get_active_evaluation_set(document_type: str, level: str = "medium", session: Session = Depends(get_session)):
    row = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == document_type,
            EvaluationSet.level == normalize_prompt_level(level),
            EvaluationSet.status == "active",
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Active evaluation set not found")
    return EvaluationSetOut(**row.model_dump())

@router.post("/evaluation-sets")
async def create_evaluation_set(payload: EvaluationSetCreateIn, session: Session = Depends(get_session)):
    base = session.get(EvaluationSet, payload.base_set_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base evaluation set not found")

    rubric = session.get(Rubric, base.rubric_version_id)
    prompt = session.get(PromptVersion, base.prompt_version_id)
    policy = session.get(EvaluationPolicy, base.policy_version_id)
    if not rubric or not prompt or not policy:
        raise HTTPException(status_code=400, detail="Base set component not found")

    new_rubric = rubric
    new_prompt = prompt
    new_policy = policy
    rubric_content = payload.changes.get("rubric_content")
    prompt_content = payload.changes.get("prompt_content")
    policy_content = payload.changes.get("policy_content")

    if rubric_content is not None:
        old = (rubric.prompt or {}).get("vi") or ""
        if rubric_content.strip() != old.strip():
            new_rubric = Rubric(
                document_type=rubric.document_type,
                version=_next_version_rubric(session, rubric.document_type),
                active=False,
                status="archived",
                prompt={"vi": rubric_content},
                created_at=_now(),
                updated_at=_now(),
            )
            session.add(new_rubric); session.commit(); session.refresh(new_rubric)
            old_criteria = session.exec(
                select(RubricCriterionRecord).where(RubricCriterionRecord.rubric_id == rubric.id).order_by(RubricCriterionRecord.sort_order)
            ).all()
            for c in old_criteria:
                session.add(
                    RubricCriterionRecord(
                        rubric_id=new_rubric.id or 0,
                        key=c.key,
                        max_score=c.max_score,
                        label_vi=c.label_vi,
                        label_ja=c.label_ja,
                        sort_order=c.sort_order,
                    )
                )
            session.commit()
    if prompt_content is not None and prompt_content.strip() != (prompt.content or "").strip():
        new_prompt = PromptVersion(
            document_type=prompt.document_type,
            level=prompt.level,
            version=_next_version_prompt(session, prompt.document_type, prompt.level),
            content=prompt_content,
            status="archived",
            created_at=_now(),
        )
        session.add(new_prompt); session.commit(); session.refresh(new_prompt)
    if policy_content is not None and policy_content.strip() != (policy.content or "").strip():
        new_policy = EvaluationPolicy(
            level=policy.level,
            version=_next_version_policy(session, policy.level),
            content=policy_content,
            status="archived",
            created_at=_now(),
        )
        session.add(new_policy); session.commit(); session.refresh(new_policy)

    status = "active" if payload.activate else "archived"
    if payload.activate:
        _archive_active_sets(session, base.document_type, base.level)
    row = EvaluationSet(
        name=payload.name,
        document_type=base.document_type,
        level=base.level,
        rubric_version_id=new_rubric.id or 0,
        prompt_version_id=new_prompt.id or 0,
        policy_version_id=new_policy.id or 0,
        required_rules_version=base.required_rules_version,
        required_rule_hash=stable_hash(REQUIRED_RULES),
        version_label=_next_set_version_label(session, base.document_type, base.level),
        status=status,
        created_at=_now(),
    )
    session.add(row); session.commit(); session.refresh(row)
    return EvaluationSetOut(**row.model_dump())

@router.post("/evaluation-sets/{set_id}/activate")
async def activate_evaluation_set(set_id: int, session: Session = Depends(get_session)):
    row = session.get(EvaluationSet, set_id)
    if not row:
        raise HTTPException(status_code=404, detail="Evaluation set not found")
    _archive_active_sets(session, row.document_type, row.level)
    row.status = "active"
    session.add(row); session.commit(); session.refresh(row)
    return EvaluationSetOut(**row.model_dump())


@router.post("/evaluation-sets/bootstrap")
async def bootstrap_evaluation_set(payload: EvaluationSetBootstrapIn, session: Session = Depends(get_session)):
    lvl = normalize_prompt_level(payload.level)
    existing = session.exec(
        select(EvaluationSet).where(
            EvaluationSet.document_type == payload.document_type,
            EvaluationSet.level == lvl,
        )
    ).first()
    if existing:
        return EvaluationSetOut(**existing.model_dump())

    rubric = session.exec(
        select(Rubric).where(Rubric.document_type == payload.document_type, Rubric.status == "active")
    ).first()
    prompt = session.exec(
        select(PromptVersion).where(
            PromptVersion.document_type == payload.document_type,
            PromptVersion.level == lvl,
            PromptVersion.status == "active",
        )
    ).first()
    policy = session.exec(
        select(EvaluationPolicy).where(EvaluationPolicy.level == lvl, EvaluationPolicy.status == "active")
    ).first()
    if not rubric or not prompt or not policy:
        raise HTTPException(status_code=400, detail="Cannot bootstrap: missing active rubric/prompt/policy for scope")

    row = EvaluationSet(
        name=payload.name or f"{payload.document_type}-{lvl}-set-v1",
        document_type=payload.document_type,
        level=lvl,
        rubric_version_id=rubric.id or 0,
        prompt_version_id=prompt.id or 0,
        policy_version_id=policy.id or 0,
        required_rules_version="system-rules-v1",
        required_rule_hash=stable_hash(REQUIRED_RULES),
        version_label=_next_set_version_label(session, payload.document_type, lvl),
        status="active",
        created_at=_now(),
    )
    _archive_active_sets(session, payload.document_type, lvl)
    session.add(row); session.commit(); session.refresh(row)
    return EvaluationSetOut(**row.model_dump())
