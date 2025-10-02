# Security Overview

## Threat Model
- **Data at Rest**: Payslip PDFs and derived previews are stored in Supabase Storage under the `payslips` bucket. Objects are namespaced by `{user_id}/{file_id}` and protected by bucket RLS enforcing prefix ownership. Database tables (`files`, `payslips`, `redactions`, `jobs`, `events`, `llm_usage`) enforce row-level security keyed on `user_id`.
- **Data in Transit**: API and worker services communicate with Supabase and OpenAI over HTTPS. Redis and ClamAV run inside the private Compose network. Internal endpoints require the `X-Internal-Token` shared secret.
- **Attack Surface**: Public FastAPI exposes only `/healthz` and authenticated dossier preview. Internal job controls are locked behind service role token. Workers pull jobs via Celery/Redis.

## Authentication & Authorization
- User-facing requests carry Supabase JWTs. The API validates bearer tokens, checks the `sub` against Supabase URL/audience, and derives `user_id` for queries.
- Internal automation uses the service-role key exclusively on the backend. Keys are injected via environment variables and never exposed client-side.
- Storage access always goes through signed URLs generated server-side; the worker uploads redacted previews using the service role.
- Knowledge base articles (`kb`) are readable only by authenticated application users. No anonymous policy is enabled in production; Supabase RLS enforces `auth.uid()` checks as documented in the PRD.

## PII Minimisation & LLM Safety
- Native parsing (pdfplumber/PyMuPDF) and OCR (Tesseract) run entirely inside the worker. OCR text stays in memory long enough to improve native field extraction and is never persisted or transmitted externally.
- The redaction step executes before any LLM call; only the generated redacted preview PNGs (stored as `{user_id}/{file_id}_redacted.png`) are shared with OpenAI. Raw PDFs, native text, and OCR output remain local to the worker and never cross the network boundary.
- If the LLM spend cap is hit or OpenAI errors, the system falls back to native/OCR extraction and flags the job for manual review. No additional data leaves the environment during fallback.
- `llm_usage` logs capture tokens and cost to support audit and cap enforcement.

## Operational Hardening
- ClamAV scans every PDF before processing. Signatures refresh via `freshclam` at boot and daily thereafter; the worker logs the active signature banner when the daemon is first contacted.
- Retention cleanup runs daily (`cron.retention_cleanup`) deleting payslips older than the configured retention window and recording the count removed.
- Export bundles and HR/Dossier PDFs are uploaded with unique filenames, and download links are scoped to the authenticated user.
- Logs (Docker, Celery) should be forwarded to a central sink with secrets redacted; environment variables are limited to required credentials.
