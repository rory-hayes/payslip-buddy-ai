# Codex Build Log — Payslip Companion Backend

## Summary
- Added FastAPI service with health check, job inspection, and dossier preview endpoints.
- Introduced Celery worker scaffold covering extract and anomaly detection flows with merge/validation helpers.
- Created shared configuration, Supabase client helpers, and enums for job orchestration.
- Documented operational, security, and privacy processes. Added OpenAPI spec, seed data, and docker-compose stack.
- Implemented unit tests for merge logic and anomaly detection heuristics.

## Local Development
1. Copy `apps/api/.env.sample` to `.env` and populate Supabase, Redis, and OpenAI credentials.
2. Start services: `docker compose -f infra/docker-compose.yml up --build`.
3. Run API locally: `uvicorn apps.api.main:app --reload`.
4. Start worker: `celery -A apps.worker.celery_app.celery_app worker -l info`.
5. Execute tests: `pytest` (ensure `PYTHONPATH=.`).

## Verification Checklist
- [ ] Upload → jobs('extract') enqueued → status transitions correctly.
- [ ] Extract produces payslips row; ≥85% of fixtures parse without review; identity rule holds (±0.50).
- [ ] Anomaly job creates expected rows.
- [ ] Dossier endpoint returns DossierResponse.
- [ ] HR pack/export jobs set jobs.meta.download_url.
- [ ] Delete-all & retention remove rows/files.
- [ ] No PII ever sent to LLM (redaction pipeline + tests).
