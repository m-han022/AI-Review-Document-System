from __future__ import annotations

import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import create_db_and_tables  # noqa: E402
from app.storage import store  # noqa: E402


PROJECT_ID = "PVERIFYAGENTSV2"


def _upload(
    *,
    document_type: str,
    document_name: str,
    filename: str,
    content_hash: str,
):
    return store.save_upload(
        project_id=PROJECT_ID,
        project_name="Agents V2 Verification",
        filename=filename,
        original_filename=filename,
        document_type=document_type,
        document_name=document_name,
        language="vi",
        file_path=f"backend/uploads/{filename}",
        extracted_text=f"[Slide 1] Verification content for {document_name}",
        content_hash=content_hash,
        uploaded_at="2026-05-03T00:00:00+00:00",
    )


def _grading_result(document_version_id: int, document_version: str, content_hash: str):
    return {
        "document_version_id": document_version_id,
        "document_version": document_version,
        "rubric_version": "v1",
        "rubric_hash": "verify-rubric-hash",
        "gemini_model": "verify-model",
        "prompt_version": "verify-prompt-v1",
        "prompt_level": "medium",
        "policy_version": "verify-policy-v1",
        "policy_hash": "verify-policy-hash",
        "required_rule_hash": "verify-rule-hash",
        "prompt_hash": "verify-prompt-hash",
        "criteria_hash": "verify-criteria-hash",
        "grading_schema_version": "v1_slide_reviews",
        "content_hash": content_hash,
        "score": 78,
        "total_score": 78,
        "criteria_scores": {
            "review_tong_the": 20,
            "diem_tot": 20,
            "diem_xau": 22,
            "chinh_sach": 16,
        },
        "criteria_suggestions": {
            "review_tong_the": "Add clearer scope.",
            "diem_tot": "Keep measurable strengths.",
            "diem_xau": "Prioritize high-risk issues.",
            "chinh_sach": "Assign owner and deadline.",
        },
        "draft_feedback": {"vi": "Verification feedback", "ja": "Verification feedback"},
        "slide_reviews": [
            {
                "slide_number": 1,
                "status": "OK",
                "title": {"vi": "Tong quan", "ja": "Overview"},
                "summary": {"vi": "Du thong tin", "ja": "Enough information"},
                "issues": {"vi": [], "ja": []},
                "suggestions": {"vi": "Giu cau truc hien tai.", "ja": "Keep the current structure."},
            }
        ],
    }


def main() -> int:
    create_db_and_tables()
    store.delete(PROJECT_ID)

    try:
        first = _upload(
            document_type="project-review",
            document_name="Retrospective Deck",
            filename="PVERIFYAGENTSV2_Retrospective_v1.pptx",
            content_hash="verify-hash-v1",
        )
        assert first.latest_document_version == "v1", "first upload must create v1"

        second = _upload(
            document_type="project-review",
            document_name="Retrospective Deck",
            filename="PVERIFYAGENTSV2_Retrospective_v2.pptx",
            content_hash="verify-hash-v2",
        )
        assert second.latest_document_version == "v2", "same document upload must create v2"

        third = _upload(
            document_type="qa-review",
            document_name="QA Checklist",
            filename="PVERIFYAGENTSV2_QA_Checklist.pptx",
            content_hash="verify-hash-qa-v1",
        )
        assert third.latest_document_version == "v1", "different document must start at v1"

        documents = store.list_documents(PROJECT_ID)
        versions = store.list_document_versions(PROJECT_ID)
        assert len(documents) == 2, "project must have two logical documents"
        assert sorted(version.document_version for version in versions) == ["v1", "v1", "v2"]

        target_version = next(
            version
            for version in versions
            if version.document_name == "Retrospective Deck" and version.document_version == "v2"
        )
        before_runs = len(store.list_grading_runs(PROJECT_ID))
        store.save_grading_result(
            PROJECT_ID,
            _grading_result(target_version.id, target_version.document_version, target_version.content_hash),
            started_at="2026-05-03T00:01:00+00:00",
            graded_at="2026-05-03T00:02:00+00:00",
        )
        store.save_grading_result(
            PROJECT_ID,
            _grading_result(target_version.id, target_version.document_version, target_version.content_hash),
            started_at="2026-05-03T00:03:00+00:00",
            graded_at="2026-05-03T00:04:00+00:00",
        )
        after_runs = len(store.list_grading_runs(PROJECT_ID))
        assert after_runs == before_runs + 2, "each grading must append a new run"

        detail = store.get_grading_run_detail(store.list_grading_runs(PROJECT_ID)[0].id)
        assert detail is not None
        assert detail.document_version is not None
        assert detail.document_version.id == target_version.id

        print("AGENTS v2 verification passed")
        return 0
    finally:
        store.delete(PROJECT_ID)


if __name__ == "__main__":
    raise SystemExit(main())
