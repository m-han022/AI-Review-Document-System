import hashlib
import json
import re
from collections import OrderedDict
from typing import Any, Dict, List

from google.genai import types

from sqlmodel import Session, select
from app.config import settings
from app.database import engine
from app.rubric import get_active_rubric_version, get_rubric, get_rubric_criteria_config, _select_rubric
from app.services.gemini_manager import get_gemini_client, get_model_for_level
from app.services.prompt_policy import get_prompt_policy_bundle, normalize_prompt_level, stable_hash
from app.models import EvaluationSet, Rubric, PromptVersion, EvaluationPolicy, RequiredRuleSet
from app.services.prompt_composer import PromptComposer, get_active_required_rule_set, parse_required_rules_content
from app.services.evaluation_bundle_resolver import resolve_evaluation_bundle
from app.services.output_schema import OUTPUT_SCHEMA_HINT, validate_ai_output_shape
from app.metrics import inc_counter

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
GRADING_SCHEMA_VERSION = "v2_full_coverage"

BILINGUAL_SCHEMA = OUTPUT_SCHEMA_HINT

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
    "vi": "Cháº¥m Ä‘iá»ƒm tÃ i liá»‡u sau:",
    "ja": "ä»¥ä¸‹ã®è³‡æ–™ã‚’æŽ¡ç‚¹ã—ã¦ãã ã•ã„:",
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
    project_id: str | None = None,
    rubric_version: str | None = None,
    document_version_id: int | None = None,
    binary_hash: str | None = None,
    prompt_level: str | None = "medium",
    evaluation_set_id: int | None = None,
    project_description: str | None = None,
) -> dict[str, Any]:
    normalized_document_type = document_type or "project-review"
    normalized_prompt_level = normalize_prompt_level(prompt_level)
    resolved_rubric_version = rubric_version or get_active_rubric_version(document_type=document_type)
    
    with Session(engine) as session:
        required_rule_set = get_active_required_rule_set(session)
        resolved_bundle = resolve_evaluation_bundle(
            session,
            document_type=normalized_document_type,
            level=normalized_prompt_level,
            evaluation_set_id=evaluation_set_id,
        )
        eval_set = resolved_bundle.evaluation_set
        normalized_document_type = resolved_bundle.document_type
        normalized_prompt_level = resolved_bundle.level

        rubric_obj = session.get(Rubric, eval_set.rubric_version_id)
        prompt_ver = session.get(PromptVersion, eval_set.prompt_version_id)
        policy = session.get(EvaluationPolicy, eval_set.policy_version_id)
        if eval_set.required_rule_set_id:
            scoped_rules = session.get(RequiredRuleSet, eval_set.required_rule_set_id)
            if scoped_rules:
                required_rule_set = scoped_rules
        if not rubric_obj or not prompt_ver or not policy:
            raise ValueError(
                f"Evaluation set {eval_set.id} is invalid: missing rubric/prompt/policy references"
            )

        resolved_rubric_version = rubric_obj.version
        rubric_text = rubric_obj.prompt.get("vi", "") or next(iter(rubric_obj.prompt.values()), "")

    criteria_keys, max_scores = _get_criteria_config(normalized_document_type, resolved_rubric_version)
    
    # Use PromptComposer to build final prompt and get metadata
    bundle = PromptComposer.compose(
        rubric=rubric_obj, 
        rubric_text=rubric_text,
        policy=policy,
        prompt_version=prompt_ver,
        rules_set=required_rule_set,
        required_rule_hash=required_rule_set.hash
    )

    return {
        "project_id": project_id,
        "content_hash": _get_text_hash(text),
        "binary_hash": binary_hash or "",
        "document_version_id": document_version_id,
        "language": language,
        "document_type": normalized_document_type,
        "rubric_version": resolved_rubric_version,
        "rubric_hash": bundle.rubric_hash,
        "prompt_version": bundle.prompt_version,
        "prompt_level": normalized_prompt_level,
        "prompt_hash": bundle.prompt_hash,
        "policy_version": bundle.policy_version,
        "policy_hash": bundle.policy_hash,
        "required_rule_hash": bundle.required_rule_hash,
        "required_rule_set_id": required_rule_set.id,
        "criteria_hash": _stable_json_hash({"keys": criteria_keys, "max_scores": max_scores}),
        "gemini_model": get_model_for_level(normalized_prompt_level),
        "grading_schema_version": GRADING_SCHEMA_VERSION,
        "project_description_hash": _get_text_hash(project_description or ""),
        "final_system_instruction": bundle.full_prompt,
        "evaluation_set_id": eval_set.id if eval_set else None,
        "evaluation_resolution_reason": resolved_bundle.resolution_reason,
    }


def _build_system_instruction(rubric: str, policy_text: str, prompt_text: str) -> str:
    return "\n\n".join(part.strip() for part in [rubric, policy_text, prompt_text] if part and part.strip())


def _build_cache_key(signature: dict[str, Any]) -> str:
    return "_".join(
        [
            str(signature.get("project_id") or ""),
            signature["content_hash"],
            str(signature.get("binary_hash") or ""),
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
            signature.get("project_description_hash") or "",
        ]
    )


def _get_criteria_config(document_type: str | None, rubric_version: str | None = None) -> tuple[list[str], dict[str, float]]:
    metadata_config = get_rubric_criteria_config(document_type=document_type, version=rubric_version)
    if metadata_config is not None:
        keys, max_scores = metadata_config
        if keys and max_scores:
            return keys, max_scores
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

        raw_slide_number = raw_item.get("page_number", raw_item.get("slide_number", raw_item.get("slide", index)))
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
                "page_number": slide_number,
                "status": status,
                "title": _localized_text(raw_item.get("title"), language),
                "summary": _localized_text(raw_item.get("summary"), language),
                "issues": _localized_list(raw_item.get("issues"), language),
                "suggestions": _localized_text(raw_item.get("suggestions"), language),
            }
        )
        seen_slide_numbers.add(slide_number)

    return sorted(normalized_reviews, key=lambda item: item["slide_number"])


def _ensure_ui_json_contract(
    result: dict[str, Any],
    required_keys: list[str],
    language: str,
    text: str,
) -> dict[str, Any]:
    if not isinstance(result, dict):
        result = {}
    if not isinstance(result.get("criteria_scores"), dict):
        result["criteria_scores"] = {}
    if not isinstance(result.get("criteria_suggestions"), dict):
        result["criteria_suggestions"] = {"vi": {}, "ja": {}}
    if not isinstance(result.get("draft_feedback"), (dict, str)):
        result["draft_feedback"] = {"vi": "", "ja": ""}
    # Compatibility contract:
    # - `page_reviews` is canonical.
    # - `slide_reviews` is deprecated but still accepted/returned for legacy clients.
    if not isinstance(result.get("page_reviews"), list):
        if isinstance(result.get("slide_reviews"), list):
            result["page_reviews"] = result["slide_reviews"]
        else:
            result["page_reviews"] = []
    if not isinstance(result.get("slide_reviews"), list):
        result["slide_reviews"] = result["page_reviews"]
    if "score" not in result:
        result["score"] = 0

    # Ensure required keys exist in criteria_scores
    for key in required_keys:
        if key not in result["criteria_scores"] or not isinstance(result["criteria_scores"].get(key), (int, float)):
            result["criteria_scores"][key] = 0

    # Ensure bilingual suggestions per key
    cs = result["criteria_suggestions"]
    if "vi" not in cs or not isinstance(cs.get("vi"), dict):
        cs["vi"] = {}
    if "ja" not in cs or not isinstance(cs.get("ja"), dict):
        cs["ja"] = {}
    for key in required_keys:
        vi_item = cs["vi"].get(key)
        ja_item = cs["ja"].get(key)
        if not isinstance(vi_item, dict):
            vi_item = {"evaluation": "", "improvement": ""}
        if not isinstance(ja_item, dict):
            ja_item = {"evaluation": "", "improvement": ""}
        vi_item.setdefault("evaluation", "")
        vi_item.setdefault("improvement", "")
        ja_item.setdefault("evaluation", "")
        ja_item.setdefault("improvement", "")
        cs["vi"][key] = vi_item
        cs["ja"][key] = ja_item

    # Ensure there is at least placeholder slide review when no parsed slides.
    if not result["page_reviews"]:
        fallback = _recover_minimal_result_from_text("", required_keys, language, text)
        result["page_reviews"] = fallback["slide_reviews"]
        result["slide_reviews"] = fallback["slide_reviews"]
        if not result.get("draft_feedback"):
            result["draft_feedback"] = fallback["draft_feedback"]

    return result


def _extract_balanced_json_object(raw_text: str) -> str | None:
    start = raw_text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    last_balanced_end = -1

    for idx in range(start, len(raw_text)):
        ch = raw_text[idx]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                last_balanced_end = idx
            if depth < 0:
                break

    if last_balanced_end == -1:
        return None
    return raw_text[start : last_balanced_end + 1]


def _parse_llm_json_response(raw_text: str) -> dict[str, Any]:
    cleaned_text = raw_text.strip()
    # Remove common markdown wrappers that occasionally appear despite JSON-only rules.
    cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text, flags=re.IGNORECASE)
    cleaned_text = re.sub(r"\s*```$", "", cleaned_text)
    start_idx = cleaned_text.find("{")
    end_idx = cleaned_text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
        cleaned_text = cleaned_text[start_idx : end_idx + 1]

    # Repair common LLM JSON issues: trailing commas before closing object/array.
    cleaned_text = re.sub(r",(\s*[}\]])", r"\1", cleaned_text)

    try:
        parsed = json.loads(cleaned_text, strict=False)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    balanced = _extract_balanced_json_object(raw_text)
    if balanced:
        parsed = json.loads(balanced, strict=False)
        if isinstance(parsed, dict):
            return parsed

    raise json.JSONDecodeError("Could not decode response as JSON object", cleaned_text, 0)


def _recover_minimal_result_from_text(
    raw_text: str,
    required_keys: list[str],
    language: str,
    document_text: str,
) -> dict[str, Any]:
    def _extract_page_snippets(source_text: str, limit: int = 180) -> dict[int, str]:
        snippets: dict[int, str] = {}
        if not source_text:
            return snippets
        pattern = re.compile(
            r"\[(?:Page|Slide)\s+(\d+)\](.*?)(?=\[(?:Page|Slide)\s+\d+\]|$)",
            re.IGNORECASE | re.DOTALL,
        )
        for match in pattern.finditer(source_text):
            page_no = int(match.group(1))
            body = re.sub(r"\s+", " ", (match.group(2) or "").strip())
            if body:
                snippets[page_no] = body[:limit]
        return snippets

    score_match = re.search(r'"score"\s*:\s*(-?\d+)', raw_text)
    score = int(score_match.group(1)) if score_match else 0

    criteria_scores: dict[str, float] = {}
    for key in required_keys:
        key_pattern = rf'"{re.escape(key)}"\s*:\s*(-?\d+(?:\.\d+)?)'
        key_match = re.search(key_pattern, raw_text)
        if key_match:
            criteria_scores[key] = round(float(key_match.group(1)), 1)

    empty_lang = {"vi": {}, "ja": {}}
    draft_vi = "Phản hồi AI không đúng định dạng JSON. Hệ thống đã tự phục hồi dữ liệu tối thiểu để tiếp tục hiển thị."
    draft_ja = "AI応答のJSON形式が不正だったため、表示継続のため最小限データで自動復旧しました。"
    draft_feedback = {"vi": draft_vi, "ja": draft_ja}
    if language == "vi":
        draft_feedback["ja"] = ""
    if language == "ja":
        draft_feedback["vi"] = ""

    page_matches = re.findall(r"\[(?:Page|Slide)\s+(\d+)\]", document_text or "", flags=re.IGNORECASE)
    total_slides = max((int(num) for num in page_matches), default=0)
    page_snippets = _extract_page_snippets(document_text or "")
    slide_reviews: list[dict[str, Any]] = []
    for i in range(1, total_slides + 1):
        snippet = page_snippets.get(i, "")
        slide_reviews.append(
            {
                "slide_number": i,
                "page_number": i,
                "status": "OK",
                "title": {"vi": f"Trang {i}", "ja": f"ページ {i}"},
                "summary": {
                    "vi": (
                        f"Tự phục hồi dữ liệu trang từ nội dung trích xuất: {snippet}"
                        if snippet
                        else "Tự phục hồi dữ liệu trang do phản hồi AI sai định dạng JSON."
                    ),
                    "ja": (
                        f"抽出テキストからページデータを自動復旧: {snippet}"
                        if snippet
                        else "AI応答JSON不正のため、ページデータを自動復旧しました。"
                    ),
                },
                "issues": {"vi": [], "ja": []},
                "suggestions": {"vi": "", "ja": ""},
            }
        )

    return {
        "score": max(0, min(100, score)),
        "criteria_scores": criteria_scores,
        "criteria_suggestions": empty_lang,
        "draft_feedback": draft_feedback,
        "slide_reviews": slide_reviews,
        "page_reviews": slide_reviews,
    }
def grade_submission(
    text: str,
    language: str = "ja",
    document_type: str | None = None,
    project_id: str | None = None,
    rubric_version: str | None = None,
    document_version_id: int | None = None,
    binary_hash: str | None = None,
    prompt_level: str | None = "medium",
    evaluation_set_id: int | None = None,
    project_description: str | None = None,
    use_cache: bool = True,
    refresh_cache: bool = False,
    multimodal_content: List[Dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not settings.gemini_api_keys:
        raise RuntimeError("GEMINI_API_KEY or GEMINI_API_KEYS is not configured in backend/.env")

    signature = build_grading_signature(
        text=text,
        language=language,
        document_type=document_type,
        project_id=project_id,
        rubric_version=rubric_version,
        document_version_id=document_version_id,
        binary_hash=binary_hash,
        prompt_level=prompt_level,
        evaluation_set_id=evaluation_set_id,
        project_description=project_description,
    )

    cache_key = _build_cache_key(signature)

    required_keys, max_scores = _get_criteria_config(document_type, signature["rubric_version"])
    
    # 1. Check Memory Cache
    if use_cache and not refresh_cache and cache_key in _grading_cache:
        return _grading_cache[cache_key]
    
    # 2. Check Database Cache (Persistent)
    if use_cache and not refresh_cache:
        from app.storage import store
        existing_run = store.find_matching_run(signature.get("project_id") or "", signature)
        if existing_run and (existing_run.status or "").upper() == "COMPLETED":
            print(f"[Grading] Persistent cache hit for {cache_key}")
            # Format back to result_data structure
            result_data = {
                "score": existing_run.score,
                "total_score": existing_run.total_score,
                "content_hash": signature["content_hash"],
                "document_version_id": existing_run.document_version_id,
                "rubric_version": existing_run.rubric_version,
                "rubric_hash": existing_run.rubric_hash,
                "gemini_model": existing_run.gemini_model,
                "prompt_version": existing_run.prompt_version,
                "prompt_level": existing_run.prompt_level,
                "policy_version": existing_run.policy_version,
                "policy_hash": existing_run.policy_hash,
                "required_rule_hash": existing_run.required_rule_hash,
                "prompt_hash": existing_run.prompt_hash,
                "criteria_hash": existing_run.criteria_hash,
                "grading_schema_version": existing_run.grading_schema_version,
                "project_description_hash": signature.get("project_description_hash"),
                "final_prompt_snapshot": existing_run.final_prompt_snapshot,
                "evaluation_set_id": existing_run.evaluation_set_id,
                "criteria_scores": {item.key: item.score for item in existing_run.criteria_results},
                "criteria_suggestions": {
                    "vi": {
                        item.key: (
                            item.suggestion.get("vi")
                            if isinstance(item.suggestion.get("vi"), dict)
                            else {"evaluation": str(item.suggestion.get("vi", "")), "improvement": ""}
                        )
                        for item in existing_run.criteria_results if item.suggestion
                    },
                    "ja": {
                        item.key: (
                            item.suggestion.get("ja")
                            if isinstance(item.suggestion.get("ja"), dict)
                            else {"evaluation": str(item.suggestion.get("ja", "")), "improvement": ""}
                        )
                        for item in existing_run.criteria_results if item.suggestion
                    }
                },
                "draft_feedback": existing_run.draft_feedback or {"vi": "", "ja": ""},
                "slide_reviews": [
                    {
                        "slide_number": s.slide_number,
                        "status": s.status,
                        "title": s.title,
                        "summary": s.summary,
                        "issues": s.issues,
                        "suggestions": s.suggestions
                    } for s in existing_run.slide_reviews
                ]
            }
            _grading_cache[cache_key] = result_data
            return result_data

    system_instruction = signature["final_system_instruction"]
    prompt_prefix = PROMPT_PREFIXES.get(language, PROMPT_PREFIXES["ja"])
    
    client = get_gemini_client()
    target_model = signature.get("gemini_model") or get_model_for_level(prompt_level or "medium")

    # Construct Multimodal contents
    contents = []
    contents.append(f"{prompt_prefix}\n\n")
    contents.append("ADDITIONAL PROJECT CONTEXT (FOR REFERENCE ONLY):\n")
    contents.append(f"{project_description or 'No additional context provided.'}\n\n")
    contents.append("IMPORTANT: Use the project context only to better understand the domain. ")
    contents.append("All grading decisions must be based on evidence found within the DOCUMENT CONTENT below.\n\n")
    
    if multimodal_content:
        contents.append("DOCUMENT CONTENT (Text + Visuals):\n")
        for item in multimodal_content:
            contents.append(f"{item['text']}\n")
            for img_bytes in item.get("images", []):
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type="image/png"))
    else:
        contents.append(f"DOCUMENT CONTENT:\n{text}")

    response = client.generate_content(
        model=target_model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            temperature=0.3,
            max_output_tokens=8192,
        ),
    )

    # [FIX SECURITY-01] Guard against empty/null response before JSON parsing
    if not response.text:
        raise RuntimeError(
            "Gemini returned an empty response. The content may have been filtered or blocked."
        )
    try:
        result = _parse_llm_json_response(response.text)
        parse_failed = False
    except json.JSONDecodeError:
        parse_failed = True
        try:
            result = _recover_minimal_result_from_text(
                raw_text=response.text or "",
                required_keys=required_keys,
                language=language,
                document_text=text,
            )
            used_recovery_fallback = True
        except Exception:
            # Hard-stop fallback with explicit invalid AI response marker.
            result = {
                "score": 0,
                "criteria_scores": {key: 0 for key in required_keys},
                "criteria_suggestions": {"vi": {}, "ja": {}},
                "draft_feedback": {"vi": "", "ja": ""},
                "slide_reviews": [],
                "page_reviews": [],
                "_invalid_ai_response": True,
            }
            used_recovery_fallback = False
    else:
        used_recovery_fallback = False

    result = _ensure_ui_json_contract(
        result=result,
        required_keys=required_keys,
        language=language,
        text=text,
    )

    # Validate AFTER UI-contract normalization so legacy/near-miss payloads
    # that can be safely repaired are not incorrectly marked as hard failures.
    contract_errors = validate_ai_output_shape(result, required_keys)
    if contract_errors:
        result["_invalid_ai_response"] = True
        result["_invalid_ai_response_reason"] = ";".join(contract_errors)

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
    raw_reviews = result.get("page_reviews") if isinstance(result.get("page_reviews"), list) else result.get("slide_reviews")
    slide_reviews = _normalize_slide_reviews(raw_reviews, language)

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
        "project_description_hash": signature.get("project_description_hash"),
        "final_prompt_snapshot": signature.get("final_system_instruction"),
        "evaluation_set_id": signature.get("evaluation_set_id"),
        "criteria_scores": criteria_scores,
        "criteria_suggestions": criteria_suggestions,
        "draft_feedback": draft_feedback,
        "slide_reviews": slide_reviews,
        "page_reviews": slide_reviews,
        "status": "FAILED_INVALID_AI_RESPONSE" if result.get("_invalid_ai_response") else "COMPLETED",
        "invalid_ai_response_reason": result.get("_invalid_ai_response_reason"),
        "ai_parse_failed": parse_failed,
        "ai_used_recovery_fallback": used_recovery_fallback,
        "ai_invalid_schema": bool(contract_errors),
    }

    metric_context = {
        "document_type": signature.get("document_type", "unknown"),
        "prompt_level": signature.get("prompt_level", "unknown"),
    }
    if parse_failed:
        inc_counter("grading_ai_parse_failed_total", status="PARSE_FAILED", **metric_context)
    if used_recovery_fallback:
        inc_counter("grading_ai_fallback_total", status="RECOVERY_FALLBACK", **metric_context)
    if contract_errors:
        inc_counter("grading_ai_invalid_schema_total", status="INVALID_SCHEMA", **metric_context)
        inc_counter("grading_ai_normalize_fallback_total", status="CONTRACT_REPAIRED", **metric_context)

    # [FIX BUG-04] Only write to cache when use_cache=True.
    # refresh_cache=True means "force re-grade", not "cache the result for future use_cache=False calls".
    if use_cache:
        _grading_cache[cache_key] = result_data

    return result_data


def clear_grading_cache() -> None:
    _grading_cache.clear()
