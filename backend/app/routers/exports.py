from datetime import datetime

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.services.excel_export import build_submissions_excel
from app.storage import store

router = APIRouter()


@router.get("/exports/submissions.xlsx")
async def export_submissions_excel(
    include_ai_details: bool = Query(default=False),
    project_id: str | None = Query(default=None),
    from_time: str | None = Query(default=None),
    to_time: str | None = Query(default=None),
):
    submissions = store.get_all_for_export()

    if project_id:
        submissions = [s for s in submissions if s.project_id == project_id]

    if from_time or to_time:
        def _in_range(ts: str | None) -> bool:
            if not ts:
                return False
            try:
                value = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                return False
            if from_time:
                start = datetime.fromisoformat(from_time.replace("Z", "+00:00"))
                if value < start:
                    return False
            if to_time:
                end = datetime.fromisoformat(to_time.replace("Z", "+00:00"))
                if value > end:
                    return False
            return True

        filtered = []
        for submission in submissions:
            latest_graded = getattr(getattr(submission, "latest_run", None), "graded_at", None)
            if _in_range(latest_graded):
                filtered.append(submission)
                continue
            run_history = getattr(submission, "run_history", []) or []
            if any(_in_range(getattr(run, "graded_at", None)) for run in run_history):
                filtered.append(submission)
        submissions = filtered

    workbook_bytes = build_submissions_excel(
        submissions,
        include_ai_details=include_ai_details,
    )
    filename = f"submissions_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return Response(
        content=workbook_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
