FROM python:3.11-slim

WORKDIR /app

COPY apps/worker/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps apps

ENV PYTHONPATH=/app

CMD ["celery", "-A", "apps.worker.celery_app.celery_app", "worker", "-l", "info"]
