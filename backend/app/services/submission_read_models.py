from __future__ import annotations

from typing import Any

from app.models import GradingRunOut, SubmissionDocumentVersion


def latest_score_from_run_out(run_out: GradingRunOut | None) -> int | float | None:
    if run_out is None:
        return None
    return run_out.total_score if run_out.total_score is not None else run_out.score


def latest_status_lower(run_out: GradingRunOut | None, fallback_status: str) -> str:
    return ((run_out.status if run_out else fallback_status) or fallback_status).lower()


def latest_error_message(run_out: GradingRunOut | None) -> str | None:
    return run_out.error_message if run_out else None


def build_project_summary_row(
    *,
    project_id: str,
    project_name: str,
    total_documents: int,
    latest_updated_at: str,
    latest_run_out: GradingRunOut | None,
    fallback_status: str,
    project_description: str | None,
) -> dict[str, Any]:
    return {
        "project_id": project_id,
        "project_name": project_name,
        "total_documents": total_documents,
        "latest_updated_at": latest_updated_at,
        "latest_score": latest_score_from_run_out(latest_run_out),
        "latest_status": latest_status_lower(latest_run_out, fallback_status),
        "latest_error_message": latest_error_message(latest_run_out),
        "project_description": project_description,
    }


def build_document_summary_row(
    *,
    document_id: int,
    document_type: str,
    document_name: str,
    latest_version: SubmissionDocumentVersion | None,
    fallback_uploaded_at: str,
    latest_run_out: GradingRunOut | None,
) -> dict[str, Any]:
    return {
        "document_id": document_id,
        "document_type": document_type,
        "document_name": document_name,
        "latest_version": latest_version.document_version if latest_version else None,
        "latest_uploaded_at": latest_version.uploaded_at if latest_version else fallback_uploaded_at,
        "latest_score": latest_score_from_run_out(latest_run_out),
        "latest_status": latest_status_lower(latest_run_out, "pending"),
        "latest_error_message": latest_error_message(latest_run_out),
    }


def build_version_summary_row(
    *,
    version: SubmissionDocumentVersion,
    latest_run_out: GradingRunOut | None,
) -> dict[str, Any]:
    return {
        "document_version_id": version.id,
        "version": version.document_version,
        "filename": version.original_filename,
        "uploaded_at": version.uploaded_at,
        "is_latest": bool(version.is_latest),
        "content_hash": version.content_hash,
        "binary_hash": version.binary_hash,
        "latest_grading_score": latest_score_from_run_out(latest_run_out),
        "latest_status": latest_status_lower(latest_run_out, "pending"),
        "latest_error_message": latest_error_message(latest_run_out),
    }
