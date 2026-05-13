from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

PromptLevel = str
VALID_PROMPT_LEVELS = {"low", "medium", "high"}


@dataclass(frozen=True)
class PromptPolicyBundle:
    prompt_version: str
    prompt_level: str
    prompt_text: str
    policy_version: str
    policy_text: str
    required_rule_hash: str


from pathlib import Path

DEFAULTS_DIR = Path(__file__).resolve().parent.parent / "defaults"

LEVEL_LABELS = {
    "low": "PMO thấp",
    "medium": "PMO vừa",
    "high": "PMO cao",
}

LEVEL_LABELS_JA = {
    "low": "PMO低レベル",
    "medium": "PMO中レベル",
    "high": "PMO高レベル",
}

# Load policies from defaults directory (MANDATORY)
def _load_global_policies() -> dict[str, str]:
    path = DEFAULTS_DIR / "global_policies.json"
    if not path.exists():
        raise RuntimeError(f"CRITICAL: Configuration file missing at {path}. System cannot start.")
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise RuntimeError(f"CRITICAL: Failed to parse {path}: {str(e)}")

POLICY_TEXT = _load_global_policies()

def normalize_prompt_level(prompt_level: str | None) -> str:
    normalized = (prompt_level or "medium").strip().lower()
    return normalized if normalized in VALID_PROMPT_LEVELS else "medium"


def stable_hash(value: Any) -> str:
    if isinstance(value, str):
        payload = value
    else:
        payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


from datetime import datetime, timezone
from sqlmodel import Session, select
from app.database import engine
from app.models import EvaluationPolicy, PromptVersion

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def get_active_policy(level: str) -> EvaluationPolicy:
    level = normalize_prompt_level(level)
    with Session(engine) as session:
        policy = session.exec(
            select(EvaluationPolicy)
            .where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")
        ).first()

        if not policy:
            raise ValueError(
                f"No active EvaluationPolicy for level='{level}'. "
                "Create/activate policy via management flow before grading."
            )
        return policy

def get_active_prompt_version(document_type: str, level: str) -> PromptVersion:
    level = normalize_prompt_level(level)
    with Session(engine) as session:
        prompt = session.exec(
            select(PromptVersion)
            .where(
                PromptVersion.document_type == document_type,
                PromptVersion.level == level,
                PromptVersion.status == "active"
            )
        ).first()

        if not prompt:
            raise ValueError(
                f"No active PromptVersion for document_type='{document_type}', level='{level}'. "
                "Create/activate prompt via management flow before grading."
            )
        return prompt

def get_prompt_policy_bundle(
    *,
    document_type: str,
    prompt_level: str | None,
    required_keys: list[str],
    max_scores: dict[str, float],
) -> PromptPolicyBundle:
    level = normalize_prompt_level(prompt_level)
    
    policy = get_active_policy(level)
    prompt_ver = get_active_prompt_version(document_type, level)
    
    required_rules = {
        "document_type": document_type,
        "prompt_level": level,
        "criteria_keys": required_keys,
        "max_scores": max_scores,
        "output_schema": "bilingual_criteria_slide_reviews",
    }
    
    return PromptPolicyBundle(
        prompt_version=prompt_ver.version,
        prompt_level=level,
        prompt_text=prompt_ver.content,
        policy_version=policy.version,
        policy_text=policy.content,
        required_rule_hash=stable_hash(required_rules),
    )
