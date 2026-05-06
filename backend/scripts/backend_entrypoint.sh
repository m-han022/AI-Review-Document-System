#!/bin/sh
set -e

echo "[backend] waiting for db/redis..."
python /app/scripts/wait_for_services.py

echo "[backend] running migrations..."
alembic -c /app/alembic.ini upgrade head

echo "[backend] starting app..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
