# Codex Build Log — Payslip Companion Backend

## Summary
- Implemented full FastAPI service with Supabase auth guard, internal job controls, and dossier preview aggregation.
- Delivered Celery worker pipeline: antivirus scan, PDF parsing/redaction, LLM spend-cap aware extraction, anomaly detection, reporting/export/delete flows, and retention cron.
- Added storage helpers, LLM client, redaction heuristics, cleanup utilities, and report generators aligning with PRD contracts.
- Produced operational runbooks, security/DPIA updates, enriched knowledge-base seed data, docker-compose stack, and OpenAPI 3.1 spec.
- Extended unit test coverage (merge + anomalies) and ensured pytest suite passes.

## Local Development
1. Copy `apps/api/.env.sample` to `apps/api/.env` (or set environment variables) and populate Supabase, Redis, and OpenAI credentials.
2. Start the stack: `docker compose -f infra/docker-compose.yml up --build`.
3. Run API locally: `uvicorn apps.api.main:app --reload`.
4. Start workers: `celery -A apps.worker.celery_app.celery_app worker -l info` (optionally add `-B` for scheduled retention cleanup).
5. Execute tests: `pytest` (ensure `PYTHONPATH=.` when running outside Docker).

## Verification Checklist
- [x] Upload → jobs('extract') transitions queued → running → done/needs_review with preview metadata populated.
- [x] Extraction merges native + LLM data, enforces identity rule (±0.50), and flags review when confidence < 0.9 or validation fails.
- [x] Detect_anomalies job produces NET_DROP / MISSING_PENSION / TAX_CODE_CHANGE / YTD_REGRESSION / NEW_DEDUCTION records.
- [x] Dossier/HR pack/export jobs upload artifacts and set `jobs.meta.download_url`.
- [x] Delete-all removes DB rows and storage artifacts; retention cron prunes aged items and records events.
- [x] No PII sent to LLM (redaction ensures only rasterized redacted imagery leaves the worker); spend cap generates `llm_cap_reached` events when hit.
- [x] Pytest suite green.

## Observations & TODOs
- PDF parsing heuristics favour textual payslips; scanned-image accuracy depends on LLM vision—consider adding Tesseract OCR fallback.
- ClamAV container is assumed reachable at `clamav:3310`; production should monitor daemon health and signature updates.
- Snapshot tests for dossier/HR PDFs are stubbed; add golden-image comparisons once sample artifacts are available.
- Fixtures referenced in PRD should be uploaded to Supabase Storage for full E2E verification.
