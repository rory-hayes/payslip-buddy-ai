from __future__ import annotations

import os

from celery import Celery

from apps.common.config import get_settings

settings = get_settings()
redis_url = os.getenv("REDIS_URL", settings.redis_url)

celery_app = Celery(
    "payslip_companion",
    broker=redis_url,
    backend=redis_url,
)

celery_app.autodiscover_tasks(["apps.worker.tasks"])
