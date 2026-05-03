import hashlib
import json
from collections import OrderedDict
from typing import Any

from google.genai import types

from app.config import settings
from app.rubric import get_active_rubric_version, get_rubric, get_rubric_criteria_config
from app.services.gemini_manager import get_gemini_client
from app.services.prompt_policy import get_prompt_policy_bundle, normalize_prompt_level, stable_hash

_GRADING_CACHE_MAX_SIZE = 200


class _BoundedCache:
    """[FIX PERF-02] LRU cache with a hard size cap to prevent unbounded memory growth."""

    def __init__(self, maxsize: int = _GRADING_CACHE_MAX_SIZE) -> None:
        self._maxsize = maxsize
        self._data: OrderedDict[str, dict[str, Any]] = OrderedDict()

    def __contains__(self, key: str) -> bool:
        return key in self._data

    def __getitem__(self, key: str) -> dict[str, Any]:
        self._data.move_to_end(key)
        return self._data[key]

    def __setitem__(self, key: str, value: dict[str, Any]) -> None:
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = value
        while len(self._data) > self._maxsize:
            self._data.popitem(last=False)  # evict least recently used

    def clear(self) -> None:
        self._data.clear()


_grading_cache: _BoundedCache = _BoundedCache()
GRADING_SCHEMA_VERSION = "v1_slide_reviews"

BILINGUAL_SCHEMA = (
    "\n\nReturn JSON: {score:int, criteria_scores:{key:number}, "
    "criteria_suggestions:{vi:{key:str},ja:{key:str}}, "
    "draft_feedback:{vi:str,ja:str}, "
    "slide_reviews:[{slide_number:int,status:'OK'|'NG',"
    "title:{vi:str,ja:str},summary:{vi:str,ja:str},"
    "issues:{vi:[str],ja:[str]},suggestions:{vi:str,ja:str}}]}. "
    "All text fields MUST have both vi and ja. NG slides MUST have issues and suggestions."
)

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
    document_version_id: int | None = None,
    prompt_level: str | None = "medium",
) -> dict[str, Any]:
    normalized_document_type = document_type or "project-review"
    resolved_rubric_version = rubric_version or get_active_rubric_version(document_type=document_type)
    rubric = get_rubric(document_type=normalized_document_type, version=resolved_rubric_version)
    criteria_keys, max_scores = _get_criteria_config(normalized_document_type, resolved_rubric_version)
    prompt_policy = get_prompt_policy_bundle(
        document_type=normalized_document_type,
        prompt_level=prompt_level,
        required_keys=criteria_keys,
        max_scores=max_scores,
    )
    final_system_instruction = _build_system_instruction(rubric, prompt_policy.policy_text, prompt_policy.prompt_text)
    return {
        "content_hash": _get_text_hash(text),
        "document_version_id": document_version_id,
        "language": language,
        "document_type": normalized_document_type,
        "rubric_version": resolved_rubric_version,
        "rubric_hash": stable_hash(rubric),
        "prompt_version": prompt_policy.prompt_version,
        "prompt_level": prompt_policy.prompt_level,
        "prompt_hash": _get_text_hash(final_system_instruction),
        "policy_version": prompt_policy.policy_version,
        "policy_hash": stable_hash(prompt_policy.policy_text),
        "required_rule_hash": prompt_policy.required_rule_hash,
        "criteria_hash": _stable_json_hash({"keys": criteria_keys, "max_scores": max_scores}),
        "gemini_model": settings.gemini_model,
        "grading_schema_version": GRADING_SCHEMA_VERSION,
    }


def _build_system_instruction(rubric: str, policy_text: str, prompt_text: str) -> str:
    return "\n\n".join(part.strip() for part in [rubric, policy_text, prompt_text] if part and part.strip())


def _build_cache_key(signature: dict[str, Any]) -> str:
    return "_".join(
        [
            signature["content_hash"],
            str(signature.get("document_version_id") or ""),
            signature["language"],
            signature["document_type"],
            signature["rubric_version"],
            signature["rubric_hash"],
            signature["prompt_version"],
            signature["prompt_level"],
            signature["prompt_hash"],
            signature["policy_version"],
            signature["policy_hash"],
            signature["required_rule_hash"],
            signature["criteria_hash"],
            signature["gemini_model"],
            signature["grading_schema_version"],
        ]
    )


def _get_criteria_config(document_type: str | None, rubric_version: str | None = None) -> tuple[list[str], dict[str, float]]:
    metadata_config = get_rubric_criteria_config(document_type=document_type, version=rubric_version)
    if metadata_config is not None:
        return metadata_config
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
    document_version_id: int | None = None,
    prompt_level: str | None = "medium",
    use_cache: bool = True,
    refresh_cache: bool = False,
) -> dict[str, Any]:
    if not settings.gemini_api_keys:
        raise RuntimeError("GEMINI_API_KEY or GEMINI_API_KEYS is not configured in backend/.env")

    signature = build_grading_signature(
        text=text,
        language=language,
        document_type=document_type,
        rubric_version=rubric_version,
        document_version_id=document_version_id,
        prompt_level=prompt_level,
    )

    cache_key = _build_cache_key(signature)

    if use_cache and not refresh_cache and cache_key in _grading_cache:
        return _grading_cache[cache_key]

    rubric = get_rubric(document_type=document_type, version=signature["rubric_version"])
    prompt_prefix = PROMPT_PREFIXES.get(language, PROMPT_PREFIXES["ja"])
    required_keys, max_scores = _get_criteria_config(document_type, signature["rubric_version"])
    prompt_policy = get_prompt_policy_bundle(
        document_type=signature["document_type"],
        prompt_level=normalize_prompt_level(prompt_level),
        required_keys=required_keys,
        max_scores=max_scores,
    )
    system_instruction = _build_system_instruction(rubric, prompt_policy.policy_text, prompt_policy.prompt_text)

    client = get_gemini_client()
    response = client.generate_content(
        model=settings.gemini_model,
        contents=f"{prompt_prefix}\n\n{text}{BILINGUAL_SCHEMA}",
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )

    # [FIX SECURITY-01] Guard against empty/null response before JSON parsing
    if not response.text:
        raise RuntimeError(
            "Gemini returned an empty response. The content may have been filtered or blocked."
        )
    try:
        result = json.loads(response.text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Gemini returned an invalid JSON response. Please retry.") from exc

    score = int(result.get("score", 0))
    score = max(0, min(100, score))

    criteria_scores = _normalize_criteria_scores(
        score=score,
        raw_scores=result.get("criteria_scores"),
        required_keys=required_keys,
        max_scores=max_scores,
    )

    criteria_suggestions = result.get("criteria_suggestions", {})
    draft_feedback = result.get("draft_feedback", {})
    slide_reviews = _normalize_slide_reviews(result.get("slide_reviews"), language)

    if isinstance(draft_feedback, str):
        draft_feedback = {language: draft_feedback}
    if not isinstance(draft_feedback, dict):
        draft_feedback = {"vi": "", "ja": ""}
    else:
        draft_feedback.setdefault("vi", draft_feedback.get("ja", ""))
        draft_feedback.setdefault("ja", draft_feedback.get("vi", ""))

    if not isinstance(criteria_suggestions, dict):
        criteria_suggestions = {"vi": {}, "ja": {}}
    elif "vi" not in criteria_suggestions and "ja" not in criteria_suggestions:
        criteria_suggestions = {language: criteria_suggestions}
        criteria_suggestions.setdefault("vi" if language == "ja" else "ja", {})

    result_data = {
        "score": score,
        "total_score": score,
        "content_hash": signature["content_hash"],
        "document_version_id": signature["document_version_id"],
        "rubric_version": signature["rubric_version"],
        "rubric_hash": signature["rubric_hash"],
        "gemini_model": signature["gemini_model"],
        "prompt_version": signature["prompt_version"],
        "prompt_level": signature["prompt_level"],
        "policy_version": signature["policy_version"],
        "policy_hash": signature["policy_hash"],
        "required_rule_hash": signature["required_rule_hash"],
        "prompt_hash": signature["prompt_hash"],
        "criteria_hash": signature["criteria_hash"],
        "grading_schema_version": signature["grading_schema_version"],
        "criteria_scores": criteria_scores,
        "criteria_suggestions": criteria_suggestions,
        "draft_feedback": draft_feedback,
        "slide_reviews": slide_reviews,
    }

    # [FIX BUG-04] Only write to cache when use_cache=True.
    # refresh_cache=True means "force re-grade", not "cache the result for future use_cache=False calls".
    if use_cache:
        _grading_cache[cache_key] = result_data

    return result_data


def clear_grading_cache() -> None:
    _grading_cache.clear()
