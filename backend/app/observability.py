from __future__ import annotations

import contextvars
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any


request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


def setup_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=level, format="%(message)s")


def set_request_id(request_id: str | None = None) -> str:
    rid = (request_id or "").strip() or str(uuid.uuid4())
    request_id_ctx.set(rid)
    return rid


def get_request_id() -> str:
    return request_id_ctx.get()


def log_event(event: str, **fields: Any) -> None:
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": "INFO",
        "event": event,
        "request_id": get_request_id(),
    }
    payload.update(fields)
    logging.getLogger("app").info(json.dumps(payload, ensure_ascii=False))


def log_error(event: str, error_code: str, **fields: Any) -> None:
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": "ERROR",
        "event": event,
        "error_code": error_code,
        "request_id": get_request_id(),
    }
    payload.update(fields)
    logging.getLogger("app").error(json.dumps(payload, ensure_ascii=False))
