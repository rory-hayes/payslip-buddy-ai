from __future__ import annotations

import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from celery import Celery

from apps.common.config import get_settings

settings = get_settings()
redis_url = os.getenv("REDIS_URL", settings.redis_url)

if redis_url.startswith("rediss://"):
    parsed_url = urlparse(redis_url)
    query_params = dict(parse_qsl(parsed_url.query, keep_blank_values=True))

    if "ssl_cert_reqs" not in query_params:
        query_params["ssl_cert_reqs"] = "CERT_REQUIRED"
        updated_query = urlencode(query_params)
        parsed_url = parsed_url._replace(query=updated_query)
        redis_url = urlunparse(parsed_url)

celery_app = Celery(
    "payslip_companion",
    broker=redis_url,
    backend=redis_url,
)

celery_app.autodiscover_tasks(["apps.worker.tasks"])
