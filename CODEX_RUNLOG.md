# Codex Build Log — Payslip Companion Backend

## Summary
- Jun 2025 storage import fix: worker imports `StorageException` from `storage3.utils` and API/worker pin `storage3>=0.7.6,<0.9`. Verify by booting the worker (`celery -A apps.worker.celery_app.celery_app worker -l info`) and running an extract job end-to-end; it should progress to `done`/`needs_review` without `ImportError: StorageException` while connecting to Redis.
- Apr 2025 alignment: locked API/worker to Python 3.12.3 via `runtime.txt`, pinned `httpx==0.25.2` alongside `supabase==2.3.4`, refreshed wheel-friendly `constraints.txt`, and documented Render deploy/build steps (`--prefer-binary`, `-c ../constraints.txt`). Verify by running the Render build command locally and confirming `/healthz` reports `{"supabase":"ok","redis":"ok"}` after deploy.
- Implemented OCR fallback with Tesseract, confidence heuristics, and validation gates; golden fixtures autoparse 6/6 (100%).
- Delivered Celery worker pipeline with antivirus scan, PDF parsing/redaction, native/OCR merge, anomaly detection, dossier/export/delete flows, and retention cron.
- Added storage helpers, LLM client, redaction heuristics, cleanup utilities, report generators, and regression harness aligning with PRD contracts.
- Produced operational runbooks, security/DPIA updates, enriched knowledge-base seed data, docker-compose stack, and OpenAPI 3.1 spec.
- Extended unit, regression, snapshot, and end-to-end tests covering validations, anomalies, history generation, OCR fixtures, and PDF rendering.

## Render deploy guardrails (Oct 2024)
- Python 3.12 is enforced on Render via `apps/api/runtime.txt` and `apps/worker/runtime.txt`; keep both files in sync with the desired patch release (currently 3.12.3).
- Render builds should run `pip install --upgrade pip && pip install --prefer-binary -r requirements.txt -c ../constraints.txt` so wheels for orjson/pydantic-core/PyMuPDF are downloaded instead of compiling via maturin.
- Verify locally by creating a Python 3.12 virtualenv: `python -m venv .venv && source .venv/bin/activate`, check `python --version`, then run `pip install --prefer-binary -r apps/worker/requirements.txt -c constraints.txt`; the resolver should download wheels with no `maturin` compilation output while respecting the shared constraints file.
- Post-deploy checklist: `GET /healthz` should return `{"supabase":"ok","redis":"ok"}`, `celery -A apps.worker.celery_app.celery_app inspect ping` reports `OK`, and a sample PDF job moves queued → running → done/needs_review.

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
- Monitor OCR accuracy on real-world scans; tune language packs (`eng`, `enm`, `gle`) if false positives appear.
- Ensure production worker logs confirm `freshclam` updates and ClamAV signature strings after deployments.
- Snapshot baselines rely on the fallback renderer when WeasyPrint compatibility issues arise; revisit once upstream fixes land.
- Upload golden fixtures to shared storage for manual QA parity and verify spend-cap alerting in staging.
