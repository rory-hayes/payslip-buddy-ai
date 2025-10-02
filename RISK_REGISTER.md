# Risk Register — Post-Remediation

| Risk | Status | Mitigation / Evidence |
| --- | --- | --- |
| Supabase anon key exposure (A7) | Mitigated | Frontend now reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and CI guard blocks hard-coded keys.【F:src/integrations/supabase/client.ts†L1-L22】【F:scripts/ci/check_supabase_keys.sh†L1-L22】 |
| Internal job leakage (E1) | Mitigated | `/internal/jobs/{id}` requires `INTERNAL_TOKEN` or Supabase JWT; OpenAPI updated with 401/403 responses.【F:apps/api/main.py†L63-L72】【F:openapi/api.yaml†L68-L93】 |
| Export ZIP missing PDFs (D5) | Mitigated | Worker fetches each original PDF via signed URL; tests assert PDFs + CSVs in archive.【F:apps/worker/services/reports.py†L132-L161】【F:tests/test_e2e.py†L167-L175】 |
| HR pack lacked preview (D4) | Mitigated | HR pack payload now embeds a signed redacted preview with inline thumbnail and link.【F:apps/worker/tasks.py†L443-L487】【F:apps/worker/services/reports.py†L60-L95】 |
| Metrics visibility (F6) | Mitigated | `reports/pipeline_metrics.json` captures autoparse / identity rates and anomaly counts after E2E runs.【F:tests/test_e2e.py†L195-L207】【F:reports/pipeline_metrics.json†L1-L7】 |
| Vercel white-screen regression | Mitigated | Error boundary, environment gate, and Supabase health probe surface configuration errors instead of a blank page.【F:src/main.tsx†L1-L22】【F:src/components/EnvironmentGate.tsx†L1-L61】【F:src/components/SupabaseStatusProbe.tsx†L1-L71】【F:src/components/ErrorBoundary.tsx†L1-L58】 |
