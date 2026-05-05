from __future__ import annotations
import hashlib
import json
from typing import Any, Optional
from dataclasses import dataclass
from sqlmodel import Session, select
from app.models import Rubric, EvaluationPolicy, PromptVersion, RequiredRuleSet
from app.services.prompt_policy import _now

@dataclass
class FinalPromptBundle:
    full_prompt: str
    rubric_version: str
    rubric_hash: str
    policy_version: str
    policy_hash: str
    prompt_version: str
    prompt_hash: str
    required_rule_hash: str
    evaluation_set_id: Optional[int] = None

# Centralized Required Rules
REQUIRED_RULES = [
    "IMPORTANT RULES:",
    "1. JSON ONLY: Your entire response must be a single valid JSON object.",
    "2. NO MARKDOWN: Do not wrap JSON in code blocks (e.g., no ```json).",
    "3. NO HALLUCINATION: Only use information provided in the document content.",
    "4. BILINGUAL: All text fields must have both 'vi' and 'ja' translations.",
    "5. SCHEMA COMPLIANCE: Strictly follow the requested output schema.",
]


def get_active_required_rule_set(session: Session) -> RequiredRuleSet:
    row = session.exec(
        select(RequiredRuleSet).where(RequiredRuleSet.status == "active").order_by(RequiredRuleSet.id.desc())
    ).first()
    if row:
        return row
    # Safe fallback/auto-seed for environments not yet initialized
    seeded = RequiredRuleSet(
        version="system-rules-v1",
        hash=stable_hash(REQUIRED_RULES),
        content=json.dumps(REQUIRED_RULES, ensure_ascii=False),
        status="active",
        created_at=_now(),
    )
    session.add(seeded)
    session.commit()
    session.refresh(seeded)
    return seeded

OUTPUT_SCHEMA_HINT = (
    "\n\nReturn JSON: {score:int, criteria_scores:{key:number}, "
    "criteria_suggestions:{vi:{key:str},ja:{key:str}}, "
    "draft_feedback:{vi:str,ja:str}, "
    "slide_reviews:[{slide_number:int,status:'OK'|'NG',"
    "title:{vi:str,ja:str},summary:{vi:str,ja:str},"
    "issues:{vi:[str],ja:[str]},suggestions:{vi:str,ja:str}}]}. "
)

def stable_hash(value: Any) -> str:
    if isinstance(value, str):
        payload = value
    else:
        payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()

class PromptComposer:
    """
    Centralized module to build the Final Prompt.
    Final Prompt = Required Rules + Rubric + Evaluation Policy + PromptVersion + Output Schema
    """
    
    @staticmethod
    def compose(
        rubric: Rubric,
        rubric_text: str,
        policy: EvaluationPolicy,
        prompt_version: PromptVersion,
        required_rules_content: Optional[list[str]] = None,
        required_rule_hash: Optional[str] = None,
    ) -> FinalPromptBundle:
        
        # 1. Required Rules
        active_rules = required_rules_content or REQUIRED_RULES
        rules_text = "\n".join(active_rules)
        rules_hash = required_rule_hash or stable_hash(active_rules)
        
        # 2. Build components
        parts = [
            rules_text,
            "--- RUBRIC ---",
            rubric_text,
            "--- EVALUATION POLICY ---",
            policy.content,
            "--- ADDITIONAL INSTRUCTIONS ---",
            prompt_version.content,
            "--- OUTPUT SCHEMA ---",
            OUTPUT_SCHEMA_HINT
        ]
        
        full_prompt = "\n\n".join(parts)
        
        return FinalPromptBundle(
            full_prompt=full_prompt,
            rubric_version=rubric.version,
            rubric_hash=stable_hash(rubric_text),
            policy_version=policy.version,
            policy_hash=stable_hash(policy.content),
            prompt_version=prompt_version.version,
            prompt_hash=stable_hash(prompt_version.content),
            required_rule_hash=rules_hash
        )


def parse_required_rules_content(raw_content: Optional[str]) -> list[str]:
    if not raw_content:
        return REQUIRED_RULES
    try:
        loaded = json.loads(raw_content)
        if isinstance(loaded, list) and all(isinstance(item, str) for item in loaded):
            return loaded
    except Exception:
        pass
    return REQUIRED_RULES
