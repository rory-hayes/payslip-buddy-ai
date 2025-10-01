from __future__ import annotations

from celery import Celery

from apps.common.config import get_settings

settings = get_settings()

celery_app = Celery(
    "payslip_companion",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.autodiscover_tasks(["apps.worker.tasks"])
