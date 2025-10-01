# Security Overview

## Threat Model
- **Data at Rest**: Payslip PDFs and derived previews are stored in Supabase Storage under the `payslips` bucket. Objects are namespaced by `{user_id}/{file_id}` and protected by bucket RLS enforcing prefix ownership. Database tables (`files`, `payslips`, `redactions`, `jobs`, `events`, `llm_usage`) enforce row-level security keyed on `user_id`.
- **Data in Transit**: API and worker services communicate with Supabase and OpenAI over HTTPS. Redis and ClamAV run inside the private Compose network. Internal endpoints require the `X-Internal-Token` shared secret.
- **Attack Surface**: Public FastAPI exposes only `/healthz` and authenticated dossier preview. Internal job controls are locked behind service role token. Workers pull jobs via Celery/Redis.

## Authentication & Authorization
- User-facing requests carry Supabase JWTs. The API validates bearer tokens, checks the `sub` against Supabase URL/audience, and derives `user_id` for queries.
- Internal automation uses the service-role key exclusively on the backend. Keys are injected via environment variables and never exposed client-side.
- Storage access always goes through signed URLs generated server-side; the worker uploads redacted previews using the service role.

## PII Minimisation & LLM Safety
- Native parsing happens locally using pdfplumber/PyMuPDF; the worker redacts NI/PPS numbers, IBANs, DOBs, and address tokens before generating preview images.
- Only redacted raster images are sent to OpenAI. Raw text or original PDFs never leave the secure environment. If the LLM spend cap is hit or OpenAI errors, the system falls back to native extraction and flags the job for manual review.
- `llm_usage` logs capture tokens and cost to support audit and cap enforcement.

## Operational Hardening
- ClamAV scans every PDF before processing. Infections mark the job failed and emit an event for the incident runbook.
- Retention cleanup runs daily (`cron.retention_cleanup`) deleting payslips older than the configured retention window and recording the count removed.
- Export bundles and HR/Dossier PDFs are uploaded with unique filenames, and download links are scoped to the authenticated user.
- Logs (Docker, Celery) should be forwarded to a central sink with secrets redacted; environment variables are limited to required credentials.
