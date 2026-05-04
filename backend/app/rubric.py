from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Session, col, delete, select

from app.database import engine
from app.models import Rubric, RubricCriterion, RubricCriterionRecord, RubricVersionOut, RubricVersionPayload

DOCUMENT_TYPE_DEFAULT = "project-review"
RUBRIC_PROMPT_KEY = "vi"
SUPPORTED_RUBRIC_LANGUAGES = ("vi", "ja")
RUBRICS_DIR = Path(__file__).resolve().parent / "rubrics"
ACTIVE_VERSIONS_FILE = RUBRICS_DIR / "active_versions.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _criteria_for_rubric(session: Session, rubric_id: int) -> list[RubricCriterionRecord]:
    statement = (
        select(RubricCriterionRecord)
        .where(RubricCriterionRecord.rubric_id == rubric_id)
        .order_by(RubricCriterionRecord.sort_order, RubricCriterionRecord.id)
    )
    return session.exec(statement).all()


def _rubric_out(session: Session, rubric: Rubric) -> RubricVersionOut:
    criteria = _criteria_for_rubric(session, rubric.id or 0)
    return RubricVersionOut(
        document_type=rubric.document_type,
        version=rubric.version,
        active=rubric.active,
        criteria=[
            RubricCriterion(
                key=item.key,
                max_score=item.max_score,
                labels={"vi": item.label_vi, "ja": item.label_ja},
            )
            for item in criteria
        ],
        prompt=rubric.prompt,
    )


def _select_rubric(session: Session, document_type: str, version: str | None = None) -> Rubric | None:
    statement = select(Rubric).where(Rubric.document_type == document_type)
    if version:
        statement = statement.where(Rubric.version == version)
    else:
        statement = statement.where(Rubric.active == True)
    return session.exec(statement).first()


def _normalize_prompt(prompt: dict[str, str] | None) -> dict[str, str]:
    prompt = prompt or {}
    normalized = {
        language: text
        for language in SUPPORTED_RUBRIC_LANGUAGES
        if isinstance((text := prompt.get(language)), str) and text.strip()
    }
    if RUBRIC_PROMPT_KEY not in normalized:
        fallback = prompt.get("default") or prompt.get("ja") or next((value for value in prompt.values() if value), "")
        normalized[RUBRIC_PROMPT_KEY] = fallback
    return normalized


def get_rubric(
    document_type: str | None = None,
    version: str | None = None,
    language: str | None = None,
) -> str:
    with Session(engine) as session:
        resolved_document_type = document_type or DOCUMENT_TYPE_DEFAULT
        rubric = _select_rubric(session, resolved_document_type, version)
        if not rubric:
            rubric = session.exec(select(Rubric).where(Rubric.document_type == resolved_document_type)).first()
        if not rubric:
            raise RuntimeError(f"No rubric found for {resolved_document_type}")

        prompt_dict = rubric.prompt or {}
        if RUBRIC_PROMPT_KEY in prompt_dict and prompt_dict[RUBRIC_PROMPT_KEY]:
            return prompt_dict[RUBRIC_PROMPT_KEY]
        if "default" in prompt_dict and prompt_dict["default"]:
            return prompt_dict["default"]
        if "ja" in prompt_dict and prompt_dict["ja"]:
            return prompt_dict["ja"]
        for val in prompt_dict.values():
            if val:
                return val
        return ""


def get_rubric_criteria_config(
    document_type: str | None = None,
    version: str | None = None,
) -> tuple[list[str], dict[str, float]] | None:
    with Session(engine) as session:
        resolved_document_type = document_type or DOCUMENT_TYPE_DEFAULT
        rubric = _select_rubric(session, resolved_document_type, version)
        if not rubric or rubric.id is None:
            return None

        criteria = _criteria_for_rubric(session, rubric.id)
        keys = [item.key for item in criteria]
        max_scores = {item.key: float(item.max_score) for item in criteria}
        return keys, max_scores


def get_active_rubric_version(document_type: str | None = None) -> str:
    with Session(engine) as session:
        resolved_document_type = document_type or DOCUMENT_TYPE_DEFAULT
        rubric = _select_rubric(session, resolved_document_type)
        return rubric.version if rubric else "v1"


def list_rubric_versions() -> list[RubricVersionOut]:
    with Session(engine) as session:
        statement = select(Rubric).order_by(Rubric.document_type, Rubric.version)
        return [_rubric_out(session, rubric) for rubric in session.exec(statement).all()]


def save_rubric_version(document_type: str, payload: RubricVersionPayload) -> RubricVersionOut:
    total_score = sum(float(criterion.max_score) for criterion in payload.criteria)
    if round(total_score, 2) != 100:
        raise ValueError("Total rubric score must be 100")

    prompt = _normalize_prompt(payload.prompt)

    with Session(engine) as session:
        existing = session.exec(
            select(Rubric).where(Rubric.document_type == document_type, Rubric.version == payload.version)
        ).first()

        if existing:
            raise ValueError(f"Rubric version {payload.version} already exists and is immutable.")

        timestamp = _now()
        rubric = Rubric(
            document_type=document_type,
            version=payload.version,
            active=False,
            status="active",
            prompt=prompt,
            created_at=timestamp,
            updated_at=timestamp,
        )
        session.add(rubric)
        session.commit()
        session.refresh(rubric)

        session.exec(delete(RubricCriterionRecord).where(RubricCriterionRecord.rubric_id == rubric.id))
        for index, criterion in enumerate(payload.criteria):
            session.add(
                RubricCriterionRecord(
                    rubric_id=rubric.id,
                    key=criterion.key,
                    max_score=criterion.max_score,
                    label_vi=criterion.labels.get("vi", criterion.key),
                    label_ja=criterion.labels.get("ja", criterion.key),
                    sort_order=index,
                )
            )

        session.commit()
        session.refresh(rubric)
        return _rubric_out(session, rubric)


def activate_rubric_version(document_type: str, version: str) -> RubricVersionOut:
    with Session(engine) as session:
        rubrics = session.exec(select(Rubric).where(Rubric.document_type == document_type)).all()
        target = next((item for item in rubrics if item.version == version), None)
        if not target:
            raise ValueError(f"Rubric {document_type} {version} not found")

        for rubric in rubrics:
            rubric.active = False
            rubric.status = "archived"
            rubric.updated_at = _now()
        target.active = True
        target.status = "active"
        target.updated_at = _now()

        session.commit()
        session.refresh(target)
        return _rubric_out(session, target)


def get_rubric_version_bundle(document_type: str, version: str | None = None) -> RubricVersionOut:
    with Session(engine) as session:
        rubric = _select_rubric(session, document_type, version)
        if not rubric:
            raise RuntimeError("Rubric not found")
        return _rubric_out(session, rubric)


def seed_rubrics_from_files() -> None:
    if not RUBRICS_DIR.exists():
        return

    with Session(engine) as session:
        existing_count = session.exec(select(Rubric.id).limit(1)).first()
        if existing_count is not None:
            return

        active_versions: dict[str, str] = {}
        if ACTIVE_VERSIONS_FILE.exists():
            active_versions = json.loads(ACTIVE_VERSIONS_FILE.read_text(encoding="utf-8"))

        timestamp = _now()
        for doc_type_dir in RUBRICS_DIR.iterdir():
            if not doc_type_dir.is_dir():
                continue

            document_type = doc_type_dir.name
            active_version = active_versions.get(document_type, "v1")

            for version_dir in doc_type_dir.iterdir():
                if not version_dir.is_dir():
                    continue

                meta_path = version_dir / "meta.json"
                if not meta_path.exists():
                    continue

                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                prompt = {}
                for language in SUPPORTED_RUBRIC_LANGUAGES:
                    prompt_path = version_dir / f"{language}.md"
                    if prompt_path.exists():
                        prompt[language] = prompt_path.read_text(encoding="utf-8").strip()
                prompt = _normalize_prompt(prompt)

                rubric = Rubric(
                    document_type=document_type,
                    version=version_dir.name,
                    active=version_dir.name == active_version,
                    status="active" if version_dir.name == active_version else "archived",
                    prompt=prompt,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
                session.add(rubric)
                session.commit()
                session.refresh(rubric)

                criteria_keys = meta.get("criteria_keys", [])
                max_scores = meta.get("max_scores", {})
                labels = meta.get("criteria_labels", {})
                for index, key in enumerate(criteria_keys):
                    item_labels = labels.get(key, {})
                    session.add(
                        RubricCriterionRecord(
                            rubric_id=rubric.id,
                            key=key,
                            max_score=float(max_scores.get(key, 25)),
                            label_vi=item_labels.get("vi", key),
                            label_ja=item_labels.get("ja", key),
                            sort_order=index,
                        )
                    )

        session.commit()
