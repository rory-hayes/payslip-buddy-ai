# Payslip Companion Runbooks

## LLM Outage or Spend Cap Triggered
1. Inspect the most recent `events` rows for `llm_cap_reached` or `llm_error` to confirm the failure mode.
2. Query `llm_usage` for the affected `user_id` and day: `select sum(cost) from llm_usage where user_id = :id and created_at >= date_trunc('day', now());` Compare the sum against `LLM_SPEND_DAILY_CAP_USD` in the API environment.
3. Set `meta.disable_llm=true` on queued `extract` jobs (or pause new jobs) to force the native/OCR fallback. Jobs will continue to complete but will be marked `needs_review` more frequently.
4. Notify support and update the status page that LLM-derived confidence is degraded until the cap resets at 00:00 UTC or OpenAI access is restored.
5. After reset, clear `disable_llm` metadata, restart the worker, and monitor the next five jobs to confirm tokens/costs are being recorded again.

## Storage / RLS Troubleshooting
1. Check `files` for the `user_id`/`file_id` pair and ensure `storage_path` matches `{user_id}/{file_id}.pdf`.
2. With the service role key, call the Supabase Storage signed URL API; if the object is missing, re-upload from the original PDF (kept in the export bundle under `/pdfs`).
3. Validate storage policies: the payslips bucket must enforce `starts_with(object.name, auth.uid())`.
4. If RLS blocks table reads, verify JWT `sub` equals the `user_id` and that the role has `files`/`payslips` select policies granting access.

## Cron / Retention Failures
1. Inspect Celery Beat or Edge Function logs for `cron.retention_cleanup`. Failures emit `retention_cleanup` events with `removed=0`.
2. Manually run `celery -A apps.worker.celery_app.celery_app call cron.retention_cleanup` to replay the cleanup.
3. For stubborn rows, enqueue a `delete_all` job with `meta.retention_force=true` for the user; confirm Storage objects are purged via Supabase dashboard.
4. Document the incident in `events` as `retention_manual_replay` with `payload.cause`.

## Job Queue Backlog
1. Run `celery -A apps.worker.celery_app.celery_app inspect active` and `inspect reserved` to gauge load.
2. Increase worker concurrency (`celery worker -l info -c 8`) or scale replicas via Docker/Kubernetes.
3. Check Redis memory/latency; if needed, adjust `REDIS_URL` to a bigger instance.
4. Use `GET /internal/jobs/{id}` with the internal token to confirm API visibility; stuck jobs can be requeued by setting `status='queued'` via Supabase SQL.

## Malware Positive Handling
1. In the worker logs locate the failed job error `Antivirus detected threat`.
2. Confirm with ClamAV: `clamdscan /path/to/file`.
3. Notify the customer; do **not** attempt to open the PDF locally. Delete the Storage object and mark the `files` row as quarantined via `status='blocked'`.
4. Create an incident ticket referencing the ClamAV signature returned.
