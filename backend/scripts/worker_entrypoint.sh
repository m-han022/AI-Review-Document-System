#!/bin/sh
set -e

echo "[worker] waiting for db/redis/backend..."
WAIT_BACKEND=true python /app/scripts/wait_for_services.py

echo "[worker] starting celery worker..."
exec celery -A app.celery_app worker --loglevel=info --pool=solo
