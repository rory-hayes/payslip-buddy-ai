FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-eng \
        tesseract-ocr-gle \
        clamav-freshclam \
    && rm -rf /var/lib/apt/lists/*

COPY constraints.txt constraints.txt
COPY apps/worker/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt -c constraints.txt

COPY infra/dockerfiles/worker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY apps apps

ENV PYTHONPATH=/app
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

ENTRYPOINT ["/entrypoint.sh"]
CMD ["celery", "-A", "apps.worker.celery_app.celery_app", "worker", "-l", "info"]
