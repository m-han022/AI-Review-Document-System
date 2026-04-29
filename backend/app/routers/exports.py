from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import Response

from app.services.excel_export import build_submissions_excel
from app.storage import store

router = APIRouter()


@router.get("/exports/submissions.xlsx")
async def export_submissions_excel():
    workbook_bytes = build_submissions_excel(store.get_all_for_export())
    filename = f"submissions_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return Response(
        content=workbook_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
