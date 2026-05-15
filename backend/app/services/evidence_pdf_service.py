from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import threading

from sqlmodel import Session

from app.config import UPLOADS_DIR, settings
from app.database import engine
from app.models import SubmissionDocumentVersion


EVIDENCE_DIR = UPLOADS_DIR / "evidence_pdf"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def ensure_evidence_pdf(source_file_path: str, version_id: int) -> tuple[str | None, str, str | None]:
    source = Path(source_file_path)
    if not source.exists() or not source.is_file():
        return None, "FAILED", "Source file not found"

    ext = source.suffix.lower()
    target = EVIDENCE_DIR / f"version_{version_id}.pdf"

    if ext == ".pdf":
        try:
            shutil.copyfile(source, target)
            return str(target.resolve()), "COMPLETED", None
        except Exception as exc:
            return None, "FAILED", f"Copy PDF failed: {exc}"

    if ext not in {".pptx", ".ppt"}:
        return None, "FAILED", f"Unsupported format for evidence PDF: {ext}"

    soffice = settings.libreoffice_bin or shutil.which("soffice")
    if not soffice:
        return None, "FAILED", "LibreOffice (soffice) is not installed"

    try:
        subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(EVIDENCE_DIR), str(source)],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except Exception as exc:
        return None, "FAILED", f"PPT/PPTX to PDF conversion failed: {exc}"

    converted = EVIDENCE_DIR / f"{source.stem}.pdf"
    if not converted.exists():
        return None, "FAILED", "Converted PDF was not generated"

    try:
        if converted.resolve() != target.resolve():
            shutil.move(str(converted), str(target))
        return str(target.resolve()), "COMPLETED", None
    except Exception as exc:
        return None, "FAILED", f"Finalize converted PDF failed: {exc}"


def queue_evidence_pdf_generation(version_id: int) -> None:
    def _run():
        with Session(engine) as session:
            version = session.get(SubmissionDocumentVersion, version_id)
            if not version or not version.file_path:
                return
            version.evidence_pdf_status = "PENDING"
            version.evidence_pdf_error = None
            session.add(version)
            session.commit()
            pdf_path, status, error = ensure_evidence_pdf(version.file_path, version_id)
            version.evidence_pdf_path = pdf_path
            version.evidence_pdf_status = status
            version.evidence_pdf_error = error
            session.add(version)
            session.commit()

    threading.Thread(target=_run, daemon=True).start()
