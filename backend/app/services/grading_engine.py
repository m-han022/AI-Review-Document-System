import hashlib
import json
from typing import Any

from google.genai import types

from app.config import settings
from app.rubric import get_active_rubric_version, get_rubric, get_rubric_criteria_config
from app.services.gemini_manager import get_gemini_client

# In-memory cache for grading results: {hash: {score, feedback, timestamp}}
_grading_cache: dict[str, dict[str, Any]] = {}
GRADING_SCHEMA_VERSION = "v1_slide_reviews"

# Standard document types configuration
DOCUMENT_CONFIGS = {
    "project-review": {
        "keys": ["review_tong_the", "diem_tot", "diem_xau", "chinh_sach"],
        "max_scores": {
            "review_tong_the": 25,
            "diem_tot": 25,
            "diem_xau": 30,
            "chinh_sach": 20,
        }
    },
    "bug-analysis": {
        "keys": ["kha_nang_tai_hien_bug", "phan_tich_nguyen_nhan", "danh_gia_anh_huong", "giai_phap_phong_ngua"],
        "max_scores": {
            "kha_nang_tai_hien_bug": 25,
            "phan_tich_nguyen_nhan": 25,
            "danh_gia_anh_huong": 25,
            "giai_phap_phong_ngua": 25,
        }
    },
    "qa-review": {
        "keys": ["do_ro_rang", "do_bao_phu", "kha_nang_truy_vet", "tinh_thuc_thi"],
        "max_scores": {
            "do_ro_rang": 25,
            "do_bao_phu": 25,
            "kha_nang_truy_vet": 25,
            "tinh_thuc_thi": 25,
        }
    },
    "explanation-review": {
        "keys": ["do_ro_rang_de_hieu", "tinh_day_du_dung_trong_tam", "tinh_chinh_xac", "tinh_ung_dung"],
        "max_scores": {
            "do_ro_rang_de_hieu": 25,
            "tinh_day_du_dung_trong_tam": 25,
            "tinh_chinh_xac": 25,
            "tinh_ung_dung": 25,
        }
    },
    "default": {
        "keys": ["review_tong_the", "diem_tot", "diem_xau", "chat_luong_viet"],
        "max_scores": {
            "review_tong_the": 23.5,
            "diem_tot": 33.5,
            "diem_xau": 23.5,
            "chat_luong_viet": 19.5,
        }
    }
}

PROMPT_PREFIXES = {
    "vi": "Chấm điểm tài liệu sau:",
    "ja": "以下の資料を採点してください:",
}


def _get_text_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def _stable_json_hash(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def build_grading_signature(
    text: str,
    language: str,
    document_type: str | None,
    rubric_version: str | None = None,
) -> dict[str, str]:
    normalized_document_type = document_type or "project-review"
    resolved_rubric_version = rubric_version or get_active_rubric_version(document_type=document_type)
    rubric = get_rubric(document_type=normalized_document_type, version=resolved_rubric_version)
    criteria_keys, max_scores = _get_criteria_config(normalized_document_type, resolved_rubric_version)
    return {
        "content_hash": _get_text_hash(text),
        "language": language,
        "document_type": normalized_document_type,
        "rubric_version": resolved_rubric_version,
        "prompt_hash": _get_text_hash(rubric),
        "criteria_hash": _stable_json_hash({"keys": criteria_keys, "max_scores": max_scores}),
        "gemini_model": settings.gemini_model,
        "grading_schema_version": GRADING_SCHEMA_VERSION,
    }


def _build_cache_key(signature: dict[str, str]) -> str:
    return "_".join(
        [
            signature["content_hash"],
            signature["language"],
            signature["document_type"],
            signature["rubric_version"],
            signature["prompt_hash"],
            signature["criteria_hash"],
            signature["gemini_model"],
            signature["grading_schema_version"],
        ]
    )


def _get_criteria_config(document_type: str | None, rubric_version: str | None = None) -> tuple[list[str], dict[str, float]]:
    # 1. Try to get from dynamic rubric metadata first
    metadata_config = get_rubric_criteria_config(document_type=document_type, version=rubric_version)
    if metadata_config is not None:
        return metadata_config
        
    # 2. Fallback to hardcoded configs
    config = DOCUMENT_CONFIGS.get(document_type, DOCUMENT_CONFIGS["default"])
    return config["keys"], config["max_scores"]


def _build_fallback_scores(score: int, max_scores: dict[str, float]) -> dict[str, float]:
    return {
        key: round(score * (maximum / 100), 1)
        for key, maximum in max_scores.items()
    }


def _normalize_criteria_scores(
    score: int,
    raw_scores: Any,
    required_keys: list[str],
    max_scores: dict[str, float],
) -> dict[str, float]:
    if not isinstance(raw_scores, dict):
        return _build_fallback_scores(score, max_scores)

    criteria_scores: dict[str, float] = {}
    for key in required_keys:
        value = raw_scores.get(key)
        if isinstance(value, (int, float)):
            criteria_scores[key] = round(float(value), 1)

    if not criteria_scores:
        return _build_fallback_scores(score, max_scores)

    missing_keys = [key for key in required_keys if key not in criteria_scores]
    if not missing_keys:
        return criteria_scores

    existing_total = sum(criteria_scores.values())
    remaining = max(score - existing_total, 0)

    if remaining > 0:
        missing_total = sum(max_scores[key] for key in missing_keys)
        for key in missing_keys:
            ratio = max_scores[key] / missing_total
            criteria_scores[key] = round(remaining * ratio, 1)
    else:
        for key in missing_keys:
            criteria_scores[key] = 0.0

    return criteria_scores


def _localized_text(value: Any, language: str) -> dict[str, str]:
    if isinstance(value, str):
        return {language: value.strip(), "vi" if language == "ja" else "ja": ""}

    if isinstance(value, dict):
        vi = value.get("vi")
        ja = value.get("ja")
        return {
            "vi": vi.strip() if isinstance(vi, str) else "",
            "ja": ja.strip() if isinstance(ja, str) else "",
        }

    return {"vi": "", "ja": ""}


def _localized_list(value: Any, language: str) -> dict[str, list[str]]:
    def normalize_items(items: Any) -> list[str]:
        if isinstance(items, list):
            return [item.strip() for item in items if isinstance(item, str) and item.strip()]
        if isinstance(items, str) and items.strip():
            return [items.strip()]
        return []

    if isinstance(value, dict):
        return {
            "vi": normalize_items(value.get("vi")),
            "ja": normalize_items(value.get("ja")),
        }

    return {
        language: normalize_items(value),
        "vi" if language == "ja" else "ja": [],
    }


def _normalize_slide_reviews(raw_reviews: Any, language: str) -> list[dict[str, Any]]:
    if not isinstance(raw_reviews, list):
        return []

    normalized_reviews: list[dict[str, Any]] = []
    seen_slide_numbers: set[int] = set()

    for index, raw_item in enumerate(raw_reviews, start=1):
        if not isinstance(raw_item, dict):
            continue

        raw_slide_number = raw_item.get("slide_number", raw_item.get("slide", index))
        try:
            slide_number = int(raw_slide_number)
        except (TypeError, ValueError):
            slide_number = index

        if slide_number < 1 or slide_number in seen_slide_numbers:
            continue

        status = str(raw_item.get("status", "NG")).upper()
        if status not in {"OK", "NG"}:
            status = "NG"

        normalized_reviews.append(
            {
                "slide_number": slide_number,
                "status": status,
                "title": _localized_text(raw_item.get("title"), language),
                "summary": _localized_text(raw_item.get("summary"), language),
                "issues": _localized_list(raw_item.get("issues"), language),
                "suggestions": _localized_text(raw_item.get("suggestions"), language),
            }
        )
        seen_slide_numbers.add(slide_number)

    return sorted(normalized_reviews, key=lambda item: item["slide_number"])


def grade_submission(
    text: str,
    language: str = "ja",
    document_type: str | None = None,
    rubric_version: str | None = None,
    use_cache: bool = True,
    refresh_cache: bool = False,
) -> dict[str, Any]:
    if not settings.gemini_api_keys:
        raise RuntimeError("GEMINI_API_KEY is not configured in .env")

    signature = build_grading_signature(
        text=text,
        language=language,
        document_type=document_type,
        rubric_version=rubric_version,
    )

    cache_key = _build_cache_key(signature)

    if use_cache and not refresh_cache and cache_key in _grading_cache:
        return _grading_cache[cache_key]

    rubric = get_rubric(document_type=document_type, version=signature["rubric_version"])
    
    # Updated instruction for bilingual output
    bilingual_instruction = (
        "\n\nIMPORTANT: You MUST provide the evaluation results in BOTH Vietnamese and Japanese. "
        "The 'criteria_suggestions' and 'draft_feedback' fields must be objects with 'vi' and 'ja' keys. "
        "You MUST also review every slide/page and return 'slide_reviews' as an array. "
        "Each slide review must include slide_number, status ('OK' or 'NG'), title, summary, issues, and suggestions. "
        "If a slide/page is NG, issues and suggestions are mandatory. "
        "Structure: "
        "{"
        "  'score': number, "
        "  'criteria_scores': { 'key': number, ... }, "
        "  'criteria_suggestions': { "
        "    'vi': { 'key': 'suggestion in Vietnamese', ... }, "
        "    'ja': { 'key': 'suggestion in Japanese', ... } "
        "  }, "
        "  'draft_feedback': { "
        "    'vi': 'summary feedback in Vietnamese', "
        "    'ja': 'summary feedback in Japanese' "
        "  }, "
        "  'slide_reviews': [ "
        "    { "
        "      'slide_number': number, "
        "      'status': 'OK' | 'NG', "
        "      'title': { 'vi': string, 'ja': string }, "
        "      'summary': { 'vi': string, 'ja': string }, "
        "      'issues': { 'vi': [string], 'ja': [string] }, "
        "      'suggestions': { 'vi': string, 'ja': string } "
        "    } "
        "  ] "
        "}"
    )
    
    prompt_prefix = PROMPT_PREFIXES.get(language, PROMPT_PREFIXES["ja"])
    required_keys, max_scores = _get_criteria_config(document_type, signature["rubric_version"])

    client = get_gemini_client()
    response = client.generate_content(
        model=settings.gemini_model,
        contents=f"{prompt_prefix}\n\n{text}{bilingual_instruction}",
        config=types.GenerateContentConfig(
            system_instruction=rubric,
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )

    result = json.loads(response.text)

    score = int(result.get("score", 0))
    score = max(0, min(100, score))

    criteria_scores = _normalize_criteria_scores(
        score=score,
        raw_scores=result.get("criteria_scores"),
        required_keys=required_keys,
        max_scores=max_scores,
    )

    # Extract bilingual suggestions and feedback
    criteria_suggestions = result.get("criteria_suggestions", {})
    draft_feedback = result.get("draft_feedback", {})
    slide_reviews = _normalize_slide_reviews(result.get("slide_reviews"), language)

    # Robust handling: if it's not already bilingual, wrap the single language result
    if isinstance(draft_feedback, str):
        draft_feedback = {language: draft_feedback}
    
    # Ensure both keys exist at least as empty
    if not isinstance(draft_feedback, dict):
        draft_feedback = {"vi": "", "ja": ""}
    else:
        draft_feedback.setdefault("vi", draft_feedback.get("ja", ""))
        draft_feedback.setdefault("ja", draft_feedback.get("vi", ""))

    if not isinstance(criteria_suggestions, dict):
        criteria_suggestions = {"vi": {}, "ja": {}}
    elif "vi" not in criteria_suggestions and "ja" not in criteria_suggestions:
        # It's probably the old format { "key": "suggestion" }
        criteria_suggestions = {language: criteria_suggestions}
        criteria_suggestions.setdefault("vi" if language == "ja" else "ja", {})

    result_data = {
        "score": score,
        "content_hash": signature["content_hash"],
        "rubric_version": signature["rubric_version"],
        "gemini_model": signature["gemini_model"],
        "prompt_hash": signature["prompt_hash"],
        "criteria_hash": signature["criteria_hash"],
        "grading_schema_version": signature["grading_schema_version"],
        "criteria_scores": criteria_scores,
        "criteria_suggestions": criteria_suggestions,
        "draft_feedback": draft_feedback,
        "slide_reviews": slide_reviews,
    }

    if use_cache or refresh_cache:
        _grading_cache[cache_key] = result_data

    return result_data


def clear_grading_cache():
    global _grading_cache
    _grading_cache = {}
