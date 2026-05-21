import io
from pathlib import Path
from PIL import Image
from app.observability import log_event
from app.metrics import inc_counter

OCR_CONFIDENCE_MIN = 0.35

def _estimate_ocr_confidence(text: str) -> float:
    cleaned = (text or "").strip()
    if not cleaned:
        return 0.0
    visible = [c for c in cleaned if not c.isspace()]
    if not visible:
        return 0.0
    informative = sum(1 for c in visible if c.isalnum())
    ratio = informative / max(len(visible), 1)
    # Heuristic confidence proxy without engine-native score.
    return round(min(1.0, max(0.0, ratio)), 3)


def _ocr_text_if_available(image: Image.Image) -> tuple[str, float, str]:
    try:
        import pytesseract  # type: ignore
    except Exception:
        return "", 0.0, "OCR_UNAVAILABLE"
    try:
        text = pytesseract.image_to_string(image) or ""
        conf = _estimate_ocr_confidence(text)
        return text.strip(), conf, "OCR_OK"
    except Exception:
        return "", 0.0, "OCR_FAILED"

def extract_multimodal_from_image(file_path: str):
    p = Path(file_path)
    with Image.open(file_path) as image:
        max_pixels = 20_000_000
        if image.width * image.height > max_pixels:
            raise ValueError("Image too large for extraction")
        ocr_text, ocr_confidence, ocr_status = _ocr_text_if_available(image)
        img_byte_arr = io.BytesIO()
        image.convert("RGB").save(img_byte_arr, format="JPEG", quality=85)
        text_block = f"[Image 1]\n{p.name}"
        ocr_quality_status = "OCR_LOW_CONFIDENCE" if (ocr_text and ocr_confidence < OCR_CONFIDENCE_MIN) else "OCR_ACCEPTED"
        if ocr_text and ocr_confidence >= OCR_CONFIDENCE_MIN:
            text_block = f"{text_block}\n\n[OCR Text]\n{ocr_text}"
        log_event(
            "image_ocr_processed",
            filename=p.name,
            ocr_status=ocr_status,
            ocr_confidence=ocr_confidence,
            ocr_quality_status=ocr_quality_status,
        )
        metric_status = {
            "OCR_OK": "OCR_SUCCESS",
            "OCR_UNAVAILABLE": "OCR_UNAVAILABLE",
            "OCR_FAILED": "OCR_FAILED",
        }.get(ocr_status, "OCR_UNKNOWN")
        metric_name = {
            "OCR_SUCCESS": "ingest_ocr_success_total",
            "OCR_UNAVAILABLE": "ingest_ocr_unavailable_total",
            "OCR_FAILED": "ingest_ocr_failed_total",
        }.get(metric_status, "ingest_ocr_failed_total")
        inc_counter(
            metric_name,
            document_type="image",
            prompt_level="ingest",
            status=metric_status,
        )
        if ocr_text and ocr_confidence < OCR_CONFIDENCE_MIN:
            inc_counter(
                "ingest_ocr_failed_total",
                document_type="image",
                prompt_level="ingest",
                status="OCR_LOW_CONFIDENCE",
            )
        return [{"text": text_block, "images": [img_byte_arr.getvalue()]}]

def extract_text_stub_from_image(file_path: str) -> str:
    return f"[Image File]\n{Path(file_path).name}"
