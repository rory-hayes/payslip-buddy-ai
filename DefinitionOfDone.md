# Definition of Done (DoD) — Payslip Companion (v1.0)

This DoD is the single source of truth for release readiness. No PR/Codex run is considered complete unless all applicable criteria are met with evidence.

In scope: everything in docs/PRD.md.
Non-goals: performance tuning, analytics dashboards, new features, integrations, billing (post-MVP unless PRD states otherwise).

## A. Security & Privacy
- [ ] Storage RLS owner-prefix `{user_id}/{file_id}.pdf` in payslips bucket; evidence: policy SQL path:line
- [ ] Table RLS: own-row on files/payslips/anomalies/jobs/redactions/llm_usage/events; `kb` policy matches PRD (public or authenticated with doc note)
- [ ] No service-role keys in FE; FE reads Supabase vars from env; prior keys rotated; CI guard blocks hard-coded secrets
- [ ] LLM privacy: only **redacted images** to LLM; OCR locally; prompts strict JSON schema + temperature 0
- [ ] Spend-cap: usage logged; daily cap → native+OCR fallback + event
- [ ] Docs (SECURITY, DPIA, RUNBOOKS) reflect exact data flow and sub-processors

## B. Database & Migrations
- [ ] Tables/columns per PRD (incl. `redactions.user_id`); migrations are additive/idempotent
- [ ] Supabase types regenerated to include latest columns

## C. Frontend Contracts (Lovable)
- [ ] ReviewDrawer props and **percent (0–100)** highlights; exit gated on review; ARIA overlays
- [ ] Upload SHA-256 dedupe; password modal; enqueue extract; status-driven stepper
- [ ] Dashboard filters (employer/period); conflict resolution (single `conflict=false`); anomalies scoped to user; KPIs ignore conflicts
- [ ] Settings: `export_all`/`delete_all` jobs; disabled while running; completed exports show `jobs.meta.download_url`
- [ ] DossierModal == `DossierResponse`; enums/utils centralised

## D. Worker Pipeline & Jobs
- [ ] extract → ClamAV → rasterize → **redact** → native+OCR → LLM (redacted) → merge+validate (identity ±0.50; YTD monotonic; date/tax) → persist → log usage → enqueue detect_anomalies → status done/needs_review
- [ ] detect_anomalies: NET_DROP/MISSING_PENSION/TAX_CODE_CHANGE/YTD_REGRESSION/NEW_DEDUCTION
- [ ] dossier: payload + optional PDF; download URL exposed
- [ ] hr_pack: PDF includes linked redacted preview
- [ ] export_all: ZIP contains CSVs **and all PDFs**
- [ ] delete_all: purges storage + user rows; preserves profiles/settings unless purge_all
- [ ] retention: cron deletes per retention_days; events logged

## E. API & OpenAPI
- [ ] healthz
- [ ] /internal/jobs/{id} **requires** X-Internal-Token or JWT (401/403 otherwise)
- [ ] /internal/jobs/trigger requires token
- [ ] /dossier/preview requires auth
- [ ] openapi/api.yaml matches implementation & security

## F. Tests & Fixtures
- [ ] Fixtures present: uk_text, uk_scan, ie_text, ie_scan, password (pwd test123), multi_page
- [ ] E2E autoparse ≥ 0.85; identity ≥ 0.98 after single confirm
- [ ] Unit tests (merge/identity/YTD/anomaly rules)
- [ ] Snapshot tests for Dossier & HR pack (image diffs)
- [ ] Metrics JSON written to reports/pipeline_metrics.json (autoparse/identity/anomalies)

## G. Ops & Infra
- [ ] docker-compose runs api/worker/redis/clamav; freshclam on boot + daily
- [ ] RUNBOOKS detail LLM fallback, spend-cap, freshclam, retention, RLS, snapshots
- [ ] GO_LIVE_CHECKLIST all ✅

## H. Audit Artifacts
- [ ] AUDIT.md (GREEN), audit_report.json, OPENAPI_REPORT.md, TEST_REPORT.md, RISK_REGISTER.md, GO_LIVE_CHECKLIST.md

Any change not in PRD/DoD requires a Change Request.
