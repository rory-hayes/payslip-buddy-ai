# Payslip Companion — PRD Compliance Audit (Final)

## 1. Executive Summary
**Overall Status: Green.** OCR fallback, validation heuristics, and end-to-end automation align with the PRD. All golden fixtures autoparse without review, anomaly regression harness covers every rule, and ClamAV signature management is automated with runbook support. No blocking gaps remain for launch-readiness.

## 2. Scope & Version
- Commit: 4646778d6739346dccaf5e87852e5870eb58f1d7
- Date: 2025-02-14
- Environment: Local container (pytest, Node 18)

## 3. Feature Compliance Matrix
| PRD Area | Requirement | Status | Evidence (path:line) | Notes |
| --- | --- | --- | --- | --- |
| Storage RLS | Owner-prefix enforced for storage bucket and tables | Pass | `supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql`【F:supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql†L4-L45】 | Policies gate access to `{user_id}/...` keys and per-user rows. |
| Table RLS | Files, payslips, anomalies, settings, jobs, redactions, llm_usage, events | Pass | `supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql`【F:supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql†L20-L133】 | RLS enabled with CRUD policies scoped by `user_id`. |
| Frontend contracts | ReviewDrawer props & confidence UI | Pass | `src/components/ReviewDrawer.tsx`【F:src/components/ReviewDrawer.tsx†L18-L170】 | Drawer maintains prop surface and gating thresholds. |
| Frontend contracts | Dashboard conflict resolve / snooze / mute workflows | Pass | `src/pages/Dashboard.tsx`【F:src/pages/Dashboard.tsx†L1-L195】 | Conflict resolution, snooze, and mute flows wired to Supabase. |
| Frontend contracts | Upload stepper & password flow | Pass | `src/pages/Upload.tsx`【F:src/pages/Upload.tsx†L1-L137】 | Upload screen handles drag/drop, password prompts, and job polling. |
| Frontend contracts | Settings jobs (retention, locale, region) | Pass | `src/pages/Settings.tsx`【F:src/pages/Settings.tsx†L16-L259】 | Settings page reads/writes retention, locale, and regional options. |
| Worker pipeline | Extract → anomalies → dossier/export/delete/retention | Pass | `apps/worker/tasks.py`【F:apps/worker/tasks.py†L154-L422】 | Pipeline enforces OCR fallback, validations, anomaly chaining, and artifact jobs. |
| OCR fallback | Rasterise + Tesseract when native text weak | Pass | `apps/worker/services/pdf.py`【F:apps/worker/services/pdf.py†L70-L201】, `apps/worker/tasks.py`【F:apps/worker/tasks.py†L170-L205】 | Native parse merges OCR output before validations. |
| Spend cap controls | LLM spend cap gating + usage logging | Pass | `apps/worker/services/llm.py`【F:apps/worker/services/llm.py†L70-L152】 | Blocks vision calls past cap and records tokens/cost. |
| Redaction policy | Only redacted imagery leaves worker | Pass | `apps/worker/tasks.py`【F:apps/worker/tasks.py†L180-L205】 | Rasterised previews created prior to any LLM invocation. |
| Docs & Ops | RUNBOOKS, SECURITY, DPIA refreshed | Pass | `docs/RUNBOOKS.md`【F:docs/RUNBOOKS.md†L34-L53】, `docs/SECURITY.md`【F:docs/SECURITY.md†L13-L21】, `docs/DPIA.md`【F:docs/DPIA.md†L13-L39】 | New sections cover OCR triage, ClamAV updates, and privacy posture. |

## 4. Schema Snapshot
- Storage prefix policies ensure objects live under `{user_id}/…` paths for upload, read, and delete.【F:supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql†L4-L33】
- Core tables (`files`, `payslips`, `anomalies`, `settings`, `jobs`, `redactions`, `llm_usage`, `events`) enforce per-user RLS with CRUD policies.【F:supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql†L20-L133】

## 5. Security & Privacy
- Native parsing and OCR execute inside the worker; OCR text never leaves the container.【F:docs/SECURITY.md†L13-L17】
- Redaction renders previews prior to LLM calls ensuring only masked imagery is shared externally.【F:apps/worker/tasks.py†L180-L205】
- Spend cap enforcement prevents overuse and logs cost telemetry in `llm_usage`.【F:apps/worker/services/llm.py†L85-L152】
- ClamAV signatures refresh on boot and daily via entrypoint cron; version logged during first scan.【F:infra/dockerfiles/worker-entrypoint.sh†L4-L15】【F:apps/worker/services/antivirus.py†L19-L43】

## 6. Test Results
- Fixture autoparse: 6/6 golden PDFs completed without review via `tests/test_e2e.py::test_end_to_end_pipeline`.【F:tests/test_e2e.py†L60-L166】
- Anomaly regression: synthetic history triggers every rule and keeps neutral sequences clean.【F:tests/test_anomalies.py†L38-L61】【F:scripts/generate_history.py†L22-L87】
- Snapshot baselines: dossier and HR Pack PDFs match stored images within RMS tolerance.【F:tests/test_snapshots.py†L34-L45】
- Full suite: `pytest` (15 tests) passed in container.【fc4782†L1-L12】

## 7. Known Limitations / Future Work
- Monitor OCR accuracy on real-world scans; adjust language packs (`eng`, `enm`, `gle`) if noise appears.【F:CODEX_RUNLOG.md†L26-L30】
- Upstream WeasyPrint/Pydyf compatibility would remove the fallback renderer currently used for PDF snapshots.【F:CODEX_RUNLOG.md†L26-L30】【F:apps/worker/services/reports.py†L63-L82】
- Ensure production logging captures `[freshclam]` updates after deployments.【F:docs/RUNBOOKS.md†L45-L48】

## 8. Definition of Done Sign-off
- [x] OCR fallback implemented with confidence gating.【F:apps/worker/tasks.py†L170-L264】
- [x] Golden fixtures, anomaly regression, e2e, and snapshot tests automated.【F:tests/test_e2e.py†L60-L166】【F:tests/test_anomalies.py†L38-L61】【F:tests/test_snapshots.py†L34-L45】
- [x] ClamAV signature automation documented and operational.【F:infra/dockerfiles/worker-entrypoint.sh†L4-L15】【F:docs/RUNBOOKS.md†L45-L48】
- [x] RUNBOOKS, SECURITY, DPIA reflect OCR/ClamAV updates.【F:docs/RUNBOOKS.md†L34-L53】【F:docs/SECURITY.md†L13-L21】【F:docs/DPIA.md†L13-L39】
