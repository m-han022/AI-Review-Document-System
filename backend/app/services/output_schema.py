from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DEFAULTS_DIR = Path(__file__).resolve().parent.parent / "defaults"
OUTPUT_SCHEMA_PATH = DEFAULTS_DIR / "output_schema.json"


def _load_output_schema() -> dict[str, Any]:
    if not OUTPUT_SCHEMA_PATH.exists():
        raise RuntimeError(f"CRITICAL: Missing output schema file at {OUTPUT_SCHEMA_PATH}")
    try:
        with open(OUTPUT_SCHEMA_PATH, "r", encoding="utf-8") as f:
            loaded = json.load(f)
        if not isinstance(loaded, dict):
            raise RuntimeError("Output schema file must be a JSON object")
        return loaded
    except Exception as exc:
        raise RuntimeError(f"CRITICAL: Failed to parse output schema at {OUTPUT_SCHEMA_PATH}: {str(exc)}")


OUTPUT_SCHEMA = _load_output_schema()
OUTPUT_SCHEMA_HINT = str(OUTPUT_SCHEMA.get("hint") or "").strip()
OUTPUT_STATUS_ENUM = set(OUTPUT_SCHEMA.get("status_enum") or ["OK", "NG"])


def validate_ai_output_shape(result: Any, required_criteria_keys: list[str]) -> list[str]:
    errors: list[str] = []
    if not isinstance(result, dict):
        return ["root_not_object"]

    required_root = OUTPUT_SCHEMA.get("required_root_keys") or []
    for key in required_root:
        if key not in result:
            errors.append(f"missing_root_key:{key}")

    if "score" in result and not isinstance(result.get("score"), (int, float)):
        errors.append("invalid_type:score")

    criteria_scores = result.get("criteria_scores")
    if not isinstance(criteria_scores, dict):
        errors.append("invalid_type:criteria_scores")
    else:
        for key in required_criteria_keys:
            if key not in criteria_scores:
                errors.append(f"missing_criteria_score:{key}")
            elif not isinstance(criteria_scores.get(key), (int, float)):
                errors.append(f"invalid_type:criteria_score:{key}")

    criteria_suggestions = result.get("criteria_suggestions")
    if not isinstance(criteria_suggestions, dict):
        errors.append("invalid_type:criteria_suggestions")
    else:
        for lang in ("vi", "ja"):
            node = criteria_suggestions.get(lang)
            if not isinstance(node, dict):
                errors.append(f"invalid_type:criteria_suggestions:{lang}")
                continue
            for key in required_criteria_keys:
                if key not in node:
                    errors.append(f"missing_criteria_suggestion:{lang}:{key}")
                else:
                    item = node.get(key)
                    if not isinstance(item, dict):
                        errors.append(f"invalid_type:criteria_suggestion:{lang}:{key}")
                    else:
                        if not isinstance(item.get("evaluation"), str):
                            errors.append(f"invalid_type:criteria_suggestion:{lang}:{key}:evaluation")
                        if not isinstance(item.get("improvement"), str):
                            errors.append(f"invalid_type:criteria_suggestion:{lang}:{key}:improvement")

    draft_feedback = result.get("draft_feedback")
    if not isinstance(draft_feedback, dict):
        errors.append("invalid_type:draft_feedback")
    else:
        for lang in ("vi", "ja"):
            if not isinstance(draft_feedback.get(lang), str):
                errors.append(f"invalid_type:draft_feedback:{lang}")

    page_reviews = result.get("page_reviews")
    if not isinstance(page_reviews, list):
        errors.append("invalid_type:page_reviews")
    else:
        for idx, item in enumerate(page_reviews):
            if not isinstance(item, dict):
                errors.append(f"invalid_type:page_reviews:{idx}")
                continue
            if not isinstance(item.get("page_number"), int):
                errors.append(f"invalid_type:page_reviews:{idx}:page_number")
            status = item.get("status")
            if not isinstance(status, str) or status.upper() not in OUTPUT_STATUS_ENUM:
                errors.append(f"invalid_value:page_reviews:{idx}:status")
            for field in ("title", "summary", "suggestions"):
                loc = item.get(field)
                if not isinstance(loc, dict):
                    errors.append(f"invalid_type:page_reviews:{idx}:{field}")
                    continue
                if not isinstance(loc.get("vi"), str):
                    errors.append(f"invalid_type:page_reviews:{idx}:{field}:vi")
                if not isinstance(loc.get("ja"), str):
                    errors.append(f"invalid_type:page_reviews:{idx}:{field}:ja")
            issues = item.get("issues")
            if not isinstance(issues, dict):
                errors.append(f"invalid_type:page_reviews:{idx}:issues")
            else:
                if not isinstance(issues.get("vi"), list):
                    errors.append(f"invalid_type:page_reviews:{idx}:issues:vi")
                if not isinstance(issues.get("ja"), list):
                    errors.append(f"invalid_type:page_reviews:{idx}:issues:ja")

    return errors
