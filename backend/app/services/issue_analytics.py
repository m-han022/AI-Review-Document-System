from __future__ import annotations

from typing import Any


def localized_issue_list(value: Any, language: str) -> list[str]:
    if isinstance(value, dict):
        localized = value.get(language)
        if isinstance(localized, list):
            return [str(item) for item in localized if item is not None]
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    return []


def primary_issue_list(issues: Any) -> list[str]:
    if not isinstance(issues, dict):
        return []
    for key in ("vi", "ja"):
        values = issues.get(key)
        if isinstance(values, list) and values:
            return [str(item) for item in values if item is not None]
    for values in issues.values():
        if isinstance(values, list) and values:
            return [str(item) for item in values if item is not None]
    return []


def issue_bucket_key(issue: str) -> str:
    normalized = issue.lower()
    if (
        "kpi" in normalized
        or "số liệu" in normalized
        or "định lượng" in normalized
        or "定量" in normalized
        or "数値" in normalized
    ):
        return "quantitative"
    if (
        "root cause" in normalized
        or "nguyên nhân" in normalized
        or "原因" in normalized
        or "論理" in normalized
    ):
        return "logic"
    if (
        "ảnh hưởng" in normalized
        or "impact" in normalized
        or "影響" in normalized
        or "scope" in normalized
    ):
        return "impact"
    if (
        "owner" in normalized
        or "sla" in normalized
        or "deadline" in normalized
        or "tracking" in normalized
        or "管理" in normalized
    ):
        return "governance"
    if (
        "diễn đạt" in normalized
        or "表現" in normalized
        or "viết" in normalized
        or "文章" in normalized
    ):
        return "expression"
    return "other"


def issue_breakdown(slide_reviews: list[Any]) -> dict[str, int]:
    buckets: dict[str, int] = {}
    for item in slide_reviews:
        for issue in primary_issue_list(getattr(item, "issues", None)):
            key = issue_bucket_key(issue)
            buckets[key] = buckets.get(key, 0) + 1
    return buckets


def issue_count(slide_reviews: list[Any], language: str | None = None) -> int:
    if language:
        return sum(len(localized_issue_list(getattr(item, "issues", None), language)) for item in slide_reviews)
    return sum(len(primary_issue_list(getattr(item, "issues", None))) for item in slide_reviews)
