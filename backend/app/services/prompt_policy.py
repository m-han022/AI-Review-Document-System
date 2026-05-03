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


LEVEL_LABELS = {
    "low": "PMO thấp",
    "medium": "PMO vừa",
    "high": "PMO cao",
}

POLICY_TEXT = {
    "low": (
        "Đánh giá ở mức PMO thấp: tập trung vào lỗi rõ ràng, khả năng đọc hiểu, "
        "thiếu thông tin quan trọng và hành động sửa trực tiếp."
    ),
    "medium": (
        "Đánh giá ở mức PMO vừa: ngoài lỗi rõ ràng, phân tích tính nhất quán, "
        "độ đủ bằng chứng, tác động vận hành và khả năng phòng ngừa tái diễn."
    ),
    "high": (
        "Đánh giá ở mức PMO cao: áp dụng chuẩn quản trị nghiêm ngặt, kiểm tra "
        "logic nguyên nhân gốc, KPI, owner, deadline, policy, risk và khả năng audit."
    ),
}


def normalize_prompt_level(prompt_level: str | None) -> str:
    normalized = (prompt_level or "medium").strip().lower()
    return normalized if normalized in VALID_PROMPT_LEVELS else "medium"


def stable_hash(value: Any) -> str:
    if isinstance(value, str):
        payload = value
    else:
        payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def get_prompt_policy_bundle(
    *,
    document_type: str,
    prompt_level: str | None,
    required_keys: list[str],
    max_scores: dict[str, float],
) -> PromptPolicyBundle:
    level = normalize_prompt_level(prompt_level)
    prompt_version = f"{document_type}-{level}-prompt-v1"
    policy_version = f"pmo-{level}-policy-v1"
    required_rules = {
        "document_type": document_type,
        "prompt_level": level,
        "criteria_keys": required_keys,
        "max_scores": max_scores,
        "output_schema": "bilingual_criteria_slide_reviews",
    }
    prompt_text = (
        f"Mức đánh giá: {LEVEL_LABELS[level]}. "
        "Luôn bám theo rubric/version đã chọn, không dùng tiêu chí ngoài rubric. "
        "Kết quả phải giải thích được điểm số, issue, slide/page và hành động tiếp theo."
    )
    return PromptPolicyBundle(
        prompt_version=prompt_version,
        prompt_level=level,
        prompt_text=prompt_text,
        policy_version=policy_version,
        policy_text=POLICY_TEXT[level],
        required_rule_hash=stable_hash(required_rules),
    )
