import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import UPLOADS_DIR
from app.models import LanguageCode, UploadResponse
from app.services.pdf_parser import detect_language_from_text, extract_text_from_file
from app.storage import store

router = APIRouter()

PROJECT_PATTERN = re.compile(r"^(P\d+)[_\-](.+?)\.(pdf|pptx)$", re.IGNORECASE)

MESSAGES = {
    "vi": {
        "pdf_only": "Chỉ chấp nhận file PDF và PowerPoint (.pptx).",
        "invalid_filename": "Tên file không đúng định dạng. Yêu cầu: P<mã_dự_án>_<tên_dự_án>.pdf hoặc .pptx (ví dụ: P001_ThietKeWeb.pptx)",
        "empty_file": "File tải lên đang rỗng.",
        "empty_pdf": "Không thể trích xuất nội dung từ file. File có thể là ảnh scan hoặc không có text.",
        "upload_failed": "Tải lên thất bại trong quá trình xử lý file.",
        "upload_success": "Tải lên dự án thành công",
    },
    "ja": {
        "pdf_only": "PDF および PowerPoint (.pptx) ファイルのみ受け付けます。",
        "invalid_filename": "ファイル名の形式が正しくありません。形式: P<プロジェクトID>_<プロジェクト名>.pdf または .pptx (例: P001_WebsiteDesign.pptx)",
        "empty_file": "アップロードされたファイルが空です。",
        "empty_pdf": "ファイルからテキストを抽出できませんでした。画像ベースまたは空のファイルの可能性があります。",
        "upload_failed": "ファイル処理中にアップロードに失敗しました。",
        "upload_success": "プロジェクトのアップロードに成功しました",
    },
}


def _cleanup_uploaded_file(path: Path) -> None:
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass


def _unique_upload_path(filename: str) -> Path:
    safe_name = Path(filename).name
    candidate = UPLOADS_DIR / safe_name
    if not candidate.exists():
        return candidate

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix
    return UPLOADS_DIR / f"{stem}__{timestamp}{suffix}"


@router.post("/upload", response_model=UploadResponse)
async def upload_project(
    file: UploadFile = File(...),
    ui_language: LanguageCode = Form(default="ja", alias="language"),
    project_id: str | None = Form(default=None),
    project_name: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
    document_name: str | None = Form(default=None),
    project_description: str | None = Form(default=None),
):
    if not file.filename or not file.filename.lower().endswith((".pdf", ".pptx")):
        raise HTTPException(status_code=400, detail=MESSAGES[ui_language]["pdf_only"])

    match = PROJECT_PATTERN.match(file.filename)
    resolved_project_id = (project_id or "").strip().upper()
    if not resolved_project_id and match:
        resolved_project_id = match.group(1).upper()
    if not resolved_project_id:
        raise HTTPException(
            status_code=400,
            detail=MESSAGES[ui_language]["invalid_filename"],
        )

    resolved_project_name = (project_name or "").strip()
    if not resolved_project_name and match:
        resolved_project_name = match.group(2).replace("_", " ").replace("-", " ")
    if not resolved_project_name:
        resolved_project_name = Path(file.filename).stem
    original_filename = Path(file.filename).name
    save_path = _unique_upload_path(original_filename)
    stored_filename = save_path.name

    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=400,
                detail=MESSAGES[ui_language]["empty_file"],
            )

        with open(save_path, "wb") as saved_file:
            saved_file.write(content)

        extracted_text = extract_text_from_file(str(save_path))
        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail=MESSAGES[ui_language]["empty_pdf"],
            )

        detected_language = detect_language_from_text(extracted_text)
        message_bundle = MESSAGES.get(detected_language, MESSAGES["ja"])

        resolved_document_type = document_type or "project-review"
        resolved_document_name = (document_name or resolved_project_name or Path(original_filename).stem).strip()
        submission = store.save_upload(
            project_id=resolved_project_id,
            project_name=resolved_project_name,
            project_description=project_description,
            filename=stored_filename,
            original_filename=original_filename,
            document_type=resolved_document_type,
            document_name=resolved_document_name,
            language=detected_language,
            file_path=str(save_path),
            extracted_text=extracted_text,
            content_hash=hashlib.md5(extracted_text.encode()).hexdigest(),
            uploaded_at=datetime.now(timezone.utc).isoformat(),
        )

        return UploadResponse(
            project_id=resolved_project_id,
            project_name=resolved_project_name,
            filename=original_filename,
            document_type=submission.document_type,
            document_id=submission.latest_document_id,
            document_name=submission.latest_document_name,
            document_version_id=submission.latest_document_version_id,
            document_version=submission.latest_document_version,
            message=message_bundle["upload_success"],
            language=detected_language,
        )
    except HTTPException:
        _cleanup_uploaded_file(save_path)
        raise
    except Exception as exc:
        _cleanup_uploaded_file(save_path)
        raise HTTPException(
            status_code=500,
            detail=f"{MESSAGES[ui_language]['upload_failed']} {str(exc)}",
        ) from exc
    finally:
        await file.close()
