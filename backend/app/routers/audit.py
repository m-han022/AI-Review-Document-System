from __future__ import annotations

import csv
import io
from time import monotonic
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, col, select

from app.database import get_session
from app.metrics import inc_export_rows_total, observe_audit_query_duration_seconds, observe_export_duration_seconds
from app.models import (
    GradingRun,
    GradingRunDetailOut,
    GradingRunHistoryOut,
    GradingCriteriaResult,
    GradingSlideReview,
    Submission,
    SubmissionDocument,
    SubmissionDocumentVersion,
)
from app.services.issue_analytics import issue_count
from app.storage import store

router = APIRouter()
ALLOWED_AUDIT_STATUSES = {"PENDING", "EXTRACTING", "GRADING", "COMPLETED", "FAILED"}
AUDIT_EXPORT_BATCH_SIZE = 500


def _parse_iso_or_raise(name: str, value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "AUDIT_INVALID_TIME_RANGE",
                "field": name,
            },
        )
    return parsed.isoformat()


def _build_audit_statement(
    *,
    project_id: str | None,
    document_id: int | None,
    document_version_id: int | None,
    normalized_status: str | None,
    parsed_from_time: str | None,
    parsed_to_time: str | None,
):
    statement = (
        select(
            GradingRun,
            SubmissionDocument.id,
            SubmissionDocument.document_type,
            SubmissionDocument.document_name,
        )
        .join(Submission, Submission.id == GradingRun.submission_id)
        .join(
            SubmissionDocumentVersion,
            SubmissionDocumentVersion.id == GradingRun.document_version_id,
            isouter=True,
        )
        .join(
            SubmissionDocument,
            SubmissionDocument.id == SubmissionDocumentVersion.document_id,
            isouter=True,
        )
    )

    if project_id:
        statement = statement.where(Submission.project_id == project_id)
    if document_id is not None:
        statement = statement.where(SubmissionDocument.id == document_id)
    if document_version_id is not None:
        statement = statement.where(GradingRun.document_version_id == document_version_id)
    if normalized_status:
        # Avoid wrapping the indexed status column in SQL functions to keep index-friendly predicates.
        statement = statement.where(GradingRun.status == normalized_status)
    if parsed_from_time:
        statement = statement.where(GradingRun.graded_at >= parsed_from_time)
    if parsed_to_time:
        statement = statement.where(GradingRun.graded_at <= parsed_to_time)

    return statement


@router.get("/audit/runs", response_model=list[GradingRunHistoryOut], tags=["Audit"])
async def list_audit_runs(
    project_id: str | None = Query(default=None),
    document_id: int | None = Query(default=None),
    document_version_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    from_time: str | None = Query(default=None),
    to_time: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
) -> list[GradingRunHistoryOut]:
    started = monotonic()
    parsed_from_time = _parse_iso_or_raise("from_time", from_time)
    parsed_to_time = _parse_iso_or_raise("to_time", to_time)
    if parsed_from_time and parsed_to_time and parsed_from_time > parsed_to_time:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "AUDIT_INVALID_TIME_RANGE",
                "field": "from_time",
            },
        )

    normalized_status = None
    if status:
        normalized_status = status.strip().upper()
        if normalized_status not in ALLOWED_AUDIT_STATUSES:
            raise HTTPException(
                status_code=422,
                detail={
                    "error_code": "AUDIT_INVALID_STATUS",
                    "field": "status",
                },
            )

    statement = _build_audit_statement(
        project_id=project_id,
        document_id=document_id,
        document_version_id=document_version_id,
        normalized_status=normalized_status,
        parsed_from_time=parsed_from_time,
        parsed_to_time=parsed_to_time,
    )

    statement = statement.order_by(col(GradingRun.graded_at).desc(), col(GradingRun.id).desc()).offset(offset).limit(limit)
    try:
        rows = list(session.exec(statement).all())
        if not rows:
            observe_audit_query_duration_seconds(monotonic() - started, status="OK")
            return []

        run_ids = [run.id for run, *_ in rows if run.id is not None]
        criteria_count_rows = session.exec(
            select(GradingCriteriaResult.grading_run_id, col(GradingCriteriaResult.id))
            .where(col(GradingCriteriaResult.grading_run_id).in_(run_ids))
        ).all()
        criteria_count_map: dict[int, int] = {}
        for run_id, _ in criteria_count_rows:
            criteria_count_map[run_id] = criteria_count_map.get(run_id, 0) + 1

        slide_rows = list(
            session.exec(
                select(GradingSlideReview).where(col(GradingSlideReview.grading_run_id).in_(run_ids))
            ).all()
        )
        slides_by_run: dict[int, list[GradingSlideReview]] = {}
        for slide in slide_rows:
            slides_by_run.setdefault(slide.grading_run_id, []).append(slide)

        result: list[GradingRunHistoryOut] = []
        for run, doc_id, doc_type, doc_name in rows:
            run_id = run.id or 0
            slide_items = slides_by_run.get(run_id, [])
            ng_slide_count = sum(1 for item in slide_items if item.status == "NG")
            result.append(
                GradingRunHistoryOut(
                    id=run_id,
                    score=run.score,
                    total_score=run.total_score if run.total_score is not None else run.score,
                    document_id=doc_id,
                    document_type=doc_type,
                    document_name=doc_name,
                    document_version_id=run.document_version_id,
                    document_version=run.document_version,
                    rubric_version=run.rubric_version,
                    rubric_hash=run.rubric_hash,
                    gemini_model=run.gemini_model,
                    prompt_version=run.prompt_version,
                    prompt_level=run.prompt_level,
                    policy_version=run.policy_version,
                    policy_hash=run.policy_hash,
                    required_rule_hash=run.required_rule_hash,
                    prompt_hash=run.prompt_hash,
                    criteria_hash=run.criteria_hash,
                    grading_schema_version=run.grading_schema_version,
                    final_prompt_snapshot=run.final_prompt_snapshot,
                    status=run.status,
                    error_message=run.error_message,
                    graded_at=run.graded_at,
                    criteria_result_count=criteria_count_map.get(run_id, 0),
                    slide_review_count=len(slide_items),
                    ng_slide_count=ng_slide_count,
                    issue_count=issue_count(slide_items),
                )
            )
        observe_audit_query_duration_seconds(monotonic() - started, status="OK")
        return result
    except Exception:
        observe_audit_query_duration_seconds(monotonic() - started, status="ERROR")
        raise


@router.get("/audit/export", tags=["Audit"])
async def export_audit_runs_csv(
    project_id: str = Query(...),
    document_id: int | None = Query(default=None),
    version_id: int | None = Query(default=None),
    format: str = Query(default="csv"),
    status: str | None = Query(default=None),
    from_time: str | None = Query(default=None),
    to_time: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    started = monotonic()
    if format.lower() != "csv":
        raise HTTPException(status_code=422, detail={"error_code": "AUDIT_EXPORT_FORMAT_NOT_SUPPORTED", "field": "format"})

    parsed_from_time = _parse_iso_or_raise("from_time", from_time)
    parsed_to_time = _parse_iso_or_raise("to_time", to_time)
    if parsed_from_time and parsed_to_time and parsed_from_time > parsed_to_time:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "AUDIT_INVALID_TIME_RANGE",
                "field": "from_time",
            },
        )

    normalized_status = None
    if status:
        normalized_status = status.strip().upper()
        if normalized_status not in ALLOWED_AUDIT_STATUSES:
            raise HTTPException(
                status_code=422,
                detail={
                    "error_code": "AUDIT_INVALID_STATUS",
                    "field": "status",
                },
            )

    base_statement = _build_audit_statement(
        project_id=project_id,
        document_id=document_id,
        document_version_id=version_id,
        normalized_status=normalized_status,
        parsed_from_time=parsed_from_time,
        parsed_to_time=parsed_to_time,
    )
    page_size = AUDIT_EXPORT_BATCH_SIZE
    rows_emitted = 0

    def row_to_csv(run: GradingRun, doc_id: int | None) -> str:
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(
            [
                project_id,
                doc_id or "",
                run.document_version_id or "",
                run.id or "",
                run.total_score if run.total_score is not None else run.score if run.score is not None else "",
                run.status or "",
                run.prompt_level or "",
                run.evaluation_set_id if run.evaluation_set_id is not None else "",
                run.graded_at or "",
            ]
        )
        return output.getvalue()

    def iter_csv():
        nonlocal rows_emitted
        try:
            header_io = io.StringIO()
            header_writer = csv.writer(header_io, lineterminator="\n")
            header_writer.writerow(
                [
                    "project_id",
                    "document_id",
                    "document_version_id",
                    "grading_run_id",
                    "score",
                    "status",
                    "prompt_level",
                    "evaluation_set_id",
                    "graded_at",
                ]
            )
            yield header_io.getvalue()

            offset = 0
            while True:
                statement = (
                    base_statement
                    .order_by(col(GradingRun.graded_at).desc(), col(GradingRun.id).desc())
                    .offset(offset)
                    .limit(page_size)
                )
                rows = list(session.exec(statement).all())
                if not rows:
                    break

                for run, doc_id, _, _ in rows:
                    yield row_to_csv(run, doc_id)
                    rows_emitted += 1

                if len(rows) < page_size:
                    break
                offset += page_size
            observe_export_duration_seconds("/api/audit/export", monotonic() - started, status="OK")
        except Exception:
            observe_export_duration_seconds("/api/audit/export", monotonic() - started, status="ERROR")
            raise
        finally:
            if rows_emitted > 0:
                inc_export_rows_total("/api/audit/export", rows_emitted)

    filename = f"audit_export_{project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/audit/runs/{run_id}", response_model=GradingRunDetailOut, tags=["Audit"])
async def get_audit_run_detail(run_id: int):
    detail = store.get_grading_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Grading run {run_id} not found")
    return detail
