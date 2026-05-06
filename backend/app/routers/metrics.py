from fastapi import APIRouter, Response

from app.metrics import render_prometheus_metrics

router = APIRouter()


@router.get("/metrics")
async def get_metrics() -> Response:
    payload = render_prometheus_metrics()
    return Response(content=payload, media_type="text/plain; version=0.0.4; charset=utf-8")

