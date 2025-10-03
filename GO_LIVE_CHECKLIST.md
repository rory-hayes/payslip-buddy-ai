# Go-Live Checklist — Payslip Companion

- [x] Supabase URL/anon key pulled from environment; `.env` sample updated.【F:src/integrations/supabase/client.ts†L1-L22】【F:apps/web/.env.sample†L1-L3】
- [x] Supabase/Audit guard enabled in CI (`npm run ci:verify`).【F:scripts/ci/check_audit_green.sh†L1-L15】【F:scripts/ci/check_supabase_keys.sh†L1-L22】【9a1749†L1-L14】【162e38†L1-L1】
- [x] `/internal/jobs/{id}` requires `INTERNAL_TOKEN` or authenticated JWT; OpenAPI documents 401/403.【F:apps/api/main.py†L63-L72】【F:openapi/api.yaml†L68-L93】
- [x] Export ZIP contains payslips/files/anomalies/settings CSVs and every source PDF; tests enforce coverage.【F:apps/worker/services/reports.py†L132-L161】【F:tests/test_e2e.py†L167-L175】
- [x] HR pack PDF includes redacted preview thumbnail/link; snapshot updated.【F:apps/worker/services/reports.py†L48-L95】【F:tests/test_snapshots.py†L48-L60】
- [x] Knowledge base access documented as app-authenticated read.【F:docs/SECURITY.md†L8-L13】
- [x] Pipeline metrics JSON generated after E2E with autoparse ≥ 0.85 and identity ≥ 0.98 (observed 1.0/1.0).【F:tests/test_e2e.py†L195-L207】【F:reports/pipeline_metrics.json†L1-L7】
- [x] Test suite (`pytest`) passes on clean workspace.【102380†L1-L14】
- [x] Review drawer auto-opens for needs_review jobs, enforces confirmation, and updates payslip + job status.【F:src/pages/Upload.tsx†L20-L139】【F:tests/test_e2e.py†L132-L159】
