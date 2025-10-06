# Payslip Companion Runbooks

## Render deploy checklist
1. Confirm both services advertise Python 3.12.3 via `apps/api/runtime.txt` and `apps/worker/runtime.txt` (Render also accepts `PYTHON_VERSION=3.12.3`).
2. Build command must include `pip install --upgrade pip && pip install --prefer-binary -r requirements.txt -c ../../constraints.txt` so maturin/Cargo never runs on Render.
3. Validate environment variables for API and worker: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=payslips`, `REDIS_URL` (TLS form `rediss://default:<token>@<host>:6379`), `INTERNAL_TOKEN`, and optionally `OPENAI_API_KEY`.
4. After deploy, hit `/healthz` and expect `{"supabase":"ok","redis":"ok"}`.
5. Run `celery -A apps.worker.celery_app.celery_app inspect ping` and confirm workers respond with `OK`.
6. Upload a PDF (or run the internal trigger) and watch the job progress queued → running → done/needs_review in Supabase.

## Secrets Hygiene & Supabase Keys
1. The Supabase anon key checked into earlier commits has been rotated. Never hard-code project URLs or keys; configure them via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the web `.env` file (see `apps/web/.env.sample`).
2. Run `npm run ci:verify` locally or in CI. The chained script (`scripts/ci/check_audit_green.sh` + `scripts/ci/check_supabase_keys.sh`) confirms `AUDIT.md` still reports Green and scans tracked files for common Supabase tokens, failing fast if issues are detected.
3. If rotation is required again, update the environment variables in Lovable/CI, invalidate previous keys in the Supabase dashboard, and document the change in this section.

## LLM Outage or Spend Cap Triggered
1. Inspect the most recent `events` rows for `llm_cap_reached` or `llm_error` to confirm the failure mode.
2. Query `llm_usage` for the affected `user_id` and day: `select sum(cost) from llm_usage where user_id = :id and created_at >= date_trunc('day', now());` Compare the sum against `LLM_SPEND_DAILY_CAP_USD` in the API environment.
3. Set `meta.disable_llm=true` on queued `extract` jobs (or pause new jobs) to force the native/OCR fallback. Jobs will continue to complete but will be marked `needs_review` more frequently.
4. Notify support and update the status page that LLM-derived confidence is degraded until the cap resets at 00:00 UTC or OpenAI access is restored.
5. After reset, clear `disable_llm` metadata, restart the worker, and monitor the next five jobs to confirm tokens/costs are being recorded again.

## Storage / RLS Troubleshooting
1. Check `files` for the `user_id`/`file_id` pair and ensure `s3_key_original` matches `{user_id}/{file_id}.pdf` (fallback `storage_path` remains for legacy rows).
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

## OCR Fallback & Extraction Triage
1. `jobs.meta.ocrFallback=true` indicates the worker rasterised the PDF and used Tesseract output instead of native text.
2. Review the extracted fields under `jobs.meta.fields`; confidence ≥0.90 with all validations passing keeps the job in `done` state, otherwise it lands in review.
3. When troubleshooting, download the source PDF and the `_redacted.png` preview. If OCR missed characters, re-upload a cleaner scan or manually key values.
4. To reproduce locally, run `pytest tests/test_e2e.py::test_end_to_end_pipeline` which exercises the six golden fixtures (`scripts/fixtures/*.pdf`).

## Snapshot Baselines
1. Dossier and HR Pack rendering use deterministic payloads. Snapshot checks compare the rendered first page against hashed metrics stored in `tests/snapshots/baselines.json` (image dimensions, SHA-256 digest, mean pixel value).
2. After intentional layout changes run `pytest tests/test_snapshots.py`; failing tests print the observed metrics so you can update `baselines.json` intentionally.
3. Inspect the generated PDFs manually to confirm the change, then edit the JSON baselines with the new metrics. Keep the mean-difference tolerance within ±0.75 to catch regressions.

## ClamAV Signature Updates
1. The worker entrypoint runs `freshclam --stdout` on boot and every 24 hours; logs emit `[startup]` or `[freshclam]` lines.
2. Signature version is logged on the first successful scan (`ClamAV signature version: ...`). Check worker logs to verify freshness.
3. If updates fail, run `docker compose exec worker freshclam --stdout` (or equivalent in production) and investigate connectivity. Document incidents in `events` with type `antivirus_update_failure`.

## LLM Spend Cap Monitoring
1. `events` rows with type `llm_cap_reached` indicate the OpenAI budget was hit; the worker automatically skips further LLM calls and relies on native/OCR extraction.
2. Query `llm_usage` for cumulative cost per user/day and compare to the configured cap.
3. To re-enable, lift the cap or wait for the daily reset, then remove `disable_llm` flags from queued jobs and restart the worker.
## Exports & Data Portability
1. `jobs(kind='export_all')` now uploads a ZIP bundle containing `payslips.csv`, `files.csv`, `anomalies.csv`, `settings.csv`, and every source PDF under `pdfs/<file_id>.pdf`.
2. If a PDF is missing from the bundle, confirm the Storage object exists (`<user_id>/<file_id>.pdf`) and rerun the export job.
3. Export artifacts remain available under the user's storage prefix; signed download URLs are written to the job metadata.

## Pipeline Metrics Export
1. After `pytest tests/test_e2e.py::test_end_to_end_pipeline` completes, review `reports/pipeline_metrics.json` for the latest autoparse rate, identity validation pass rate, and anomaly rule counts.
2. The JSON report is regenerated on every end-to-end run and should show `autoparse_rate ≥ 0.85` and `identity_pass_rate ≥ 0.98` before promoting builds.
