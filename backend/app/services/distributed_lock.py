from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from typing import Iterator
from urllib.parse import urlparse

import redis

from app.config import settings
from app.observability import log_event

_REDIS_CLIENT: redis.Redis | None = None
_REDIS_DISABLED_UNTIL: float = 0.0


def _redis_url_for_lock() -> str:
    # Prefer broker Redis so API and workers share the same lock space.
    return settings.celery_broker_url


def _get_redis_client() -> redis.Redis | None:
    global _REDIS_CLIENT, _REDIS_DISABLED_UNTIL

    now = time.monotonic()
    if now < _REDIS_DISABLED_UNTIL:
        return None
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT

    try:
        parsed = urlparse(_redis_url_for_lock())
        # Keep socket timeouts short so API path does not stall.
        _REDIS_CLIENT = redis.Redis(
            host=parsed.hostname or "localhost",
            port=parsed.port or 6379,
            db=int((parsed.path or "/0").strip("/") or "0"),
            username=parsed.username,
            password=parsed.password,
            ssl=parsed.scheme == "rediss",
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            decode_responses=True,
        )
        _REDIS_CLIENT.ping()
        return _REDIS_CLIENT
    except Exception as exc:
        _REDIS_CLIENT = None
        _REDIS_DISABLED_UNTIL = now + 30.0
        log_event("grading_lock_backend_unavailable", detail=str(exc))
        return None


def _release_lock(client: redis.Redis, key: str, token: str) -> None:
    release_script = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
"""
    try:
        client.eval(release_script, 1, key, token)
    except Exception:
        # Best effort release; lock will auto-expire via TTL.
        pass


@contextmanager
def grading_lock(
    key: str,
    *,
    ttl_seconds: int = 30,
    wait_timeout_seconds: float = 2.0,
    retry_interval_seconds: float = 0.05,
) -> Iterator[bool]:
    client = _get_redis_client()
    if client is None:
        yield False
        return

    token = str(uuid.uuid4())
    deadline = time.monotonic() + wait_timeout_seconds
    acquired = False
    while time.monotonic() < deadline:
        try:
            acquired = bool(client.set(key, token, nx=True, ex=ttl_seconds))
        except Exception:
            acquired = False
        if acquired:
            break
        time.sleep(retry_interval_seconds)

    try:
        yield acquired
    finally:
        if acquired:
            _release_lock(client, key, token)

