---BEGIN AUDIT.md---
# Payslip Companion Audit

## Executive Summary
**Overall status: RED.** Storage and job RLS policies exist, but a live Supabase anon key is committed in the frontend, the internal job inspector endpoint is publicly accessible, and export bundles omit the underlying PDFs, blocking go-live until remediated.





## Scope & Version
- Repository: payslip-buddy-ai
- Commit: `e4bd630aadbf2af63e05b844be6cc8f13f1cc155`
- Audit Date: 2025-03 (automated review)

## Feature Compliance Matrix
| ID | Requirement | Status | Severity | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | Storage RLS owner-prefix enforced | pass | critical | 


 | Policies require `{user_id}/…` prefixes and the uploader writes to that structure. |
| A2 | Table RLS coverage & public KB | partial | high | 

 | All core tables enforce own-row RLS, but the KB select policy is limited to the authenticated role instead of anonymous public access. |
| A3 | Service role isolated from FE | pass | high | 


 | FE uses the anon key; backend instantiates the service-role client server-side. |
| A4 | LLM privacy & prompt controls | pass | high | 



 | Only redacted previews reach the LLM, prompts enforce JSON schema with temperature 0, and tests assert percent-based highlights. |
| A5 | DPIA / Security / Runbooks coverage | pass | medium | 



 | Documentation covers OCR fallback, spend caps, incident handling, and sub-processors. |
| A6 | Spend-cap handling & logging | pass | high | 


 | Daily spend is checked before inference, cap hits emit `llm_cap_reached` events, and processing proceeds without LLM. |
| A7 | Secrets hygiene | missing | high | 

 | A live Supabase URL and anon key are committed instead of being loaded via environment variables. |
| B1 | Core schema present & constrained | pass | high | 


 | Tables for files, payslips, anomalies, settings, jobs, redactions, llm_usage, and events match PRD expectations with FKs and enum checks. |
| B2 | Migrations additive / non-destructive | pass | medium | 


 | Migrations use `create table if not exists` / `add column if not exists`. |
| B3 | Supabase client types up to date | partial | medium | 


 | Generated types omit newly added columns (`storage_path`, `redactions.user_id`), risking runtime mismatch. |
| C1 | ReviewDrawer contract | pass | medium | 

 | Props accept percent highlights, require confirmation when low confidence, and apply ARIA labels. |
| C2 | Upload flow (dedupe, passwords, stepper) | pass | high | 

 | SHA-256 dedupe, PDF password modal, meta storage, and status-driven stepper are implemented. |
| C3 | Dashboard filters, conflicts, anomaly scoping | pass | high | 


 | Filters use `inferPeriodType`, anomalies scoped by `user_id`, KPIs exclude conflicts, and conflict resolution forces a single winner. |
| C4 | Settings jobs & export link | pass | medium | 

 | Export/delete enqueue jobs, buttons disable during active runs, and completed exports surface `download_url`. |
| C5 | DossierModal shape | pass | medium | 

 | Modal matches the specified response schema with totals, monthly breakdown, and checklist. |
| C6 | Centralised enums/utilities | pass | medium | 



 | Job kind/status and formatting utilities are centralised per Lovable contract. |
| D1 | Extract pipeline stages | pass | critical | 

 | Pipeline runs ClamAV, native parse, OCR fallback, redaction, LLM merge, validations, event logging, and enqueues anomaly detection. |
| D2 | detect_anomalies job rules | pass | high | 


 | NET_DROP, MISSING_PENSION, TAX_CODE_CHANGE, YTD_REGRESSION, and NEW_DEDUCTION rules analyse historical context. |
| D3 | dossier job | pass | medium | 

 | Dossier payload is fetched, rendered to PDF, stored, and `download_url` returned. |
| D4 | hr_pack job output | partial | medium | 


 | HR pack produces a JSON dump PDF but lacks the employer preview/link described in the PRD. |
| D5 | export_all job completeness | missing | high | 

 | Export bundle writes JSON metadata but stubs PDFs with empty strings, so users cannot retrieve source documents. |
| D6 | delete_all job scope | pass | high | 


 | Storage objects and table rows under `{user_id}` are purged while preserving settings unless `purge_all`. |
| D7 | Retention cron | pass | medium | 


 | Cleanup honours user retention days, removes aged files/payslips, and logs `retention_cleanup` events. |
| E1 | API endpoints & auth | missing | high | 


 | `/internal/jobs/{id}` falls back to unauthenticated access despite security docs claiming it is internal-only. |
| E2 | OpenAPI alignment | pass | medium | 


 | Paths and payloads in `api.yaml` mirror the FastAPI implementations. |
| F1 | Fixture coverage | pass | medium | 

 | All six golden PDFs are enumerated for pipeline tests. |
| F2 | Merge/validation unit tests | pass | medium | 


 | Tests cover native vs LLM merge, identity rule, period inference, and validations. |
| F3 | Anomaly rule tests | pass | medium | 

 | Synthetic histories trigger each anomaly type plus neutral control. |
| F4 | End-to-end pipeline & autoparse | pass | high | 


 | Uploading all fixtures drives extract→anomalies jobs with autoparse rate asserted at ≥85% and downstream jobs verified. |
| F5 | Snapshot PDF regression tests | pass | medium | 


 | Dossier and HR pack snapshots are compared via hash/mean tolerances. |
| F6 | Reporting autoparse/anomaly coverage | partial | low | 

 | Run log narrates autoparse 6/6 but no persistent metric output is generated. |
| G1 | Docker compose coverage | pass | medium | 

 | Compose stack launches API, worker, Redis, and ClamAV services. |
| G2 | ClamAV signature automation | pass | medium | 

 | Worker entrypoint triggers `freshclam` on boot and daily. |
| G3 | Runbooks breadth | pass | medium | 

 | Runbooks address LLM outage fallback, spend caps, freshclam, storage/RLS, cron, and snapshot upkeep. |
| G4 | Security documentation | pass | medium | 

 | Security overview reinforces redacted-only LLM usage and RLS model. |
| H1 | Blocking calls / performance | pass | low | 

 | PDF downloads use short-lived signed URLs; no egregious synchronous waits detected in request handlers. |
| H2 | Celery parallelism visibility | partial | low | 

 | Celery app is configured but concurrency/queue sizing is not documented. |
| H3 | Spend tracking instrumentation | pass | medium | 

 | LLM usage writes token/cost records and enforces configured caps. |

## Schema Snapshot
- `public.files`: stores Supabase object keys, SHA-256 hash, and cascades to auth users; RLS enabled.


- `public.payslips`: employer/pay dates, monetary fields, conflict flag, and timestamps; update trigger applied.


- `public.jobs`: typed `kind`/`status` enums with RLS for all operations and updated_at trigger.


- `public.redactions`, `public.llm_usage`, `public.events`: each enforces user ownership and cascades on delete.



## Security & Privacy
- Storage and table RLS policies correctly restrict access by `auth.uid`, and runbooks document recovery steps.



- Extraction redacts sensitive text prior to LLM calls and records percent-based highlight metadata for the review workflow.


- Spend cap enforcement logs events and falls back to native/OCR processing without leaking additional data.


- Gaps: frontend commits a live Supabase anon key, the KB policy is not truly public, and `/internal/jobs/{id}` can be queried without the internal token, contradicting the security overview.





## Testing Results
- Golden fixtures (UK/IE text & scan, password, multi-page) drive end-to-end assertions with an autoparse floor of 85%.



- Anomaly rule tests validate detection coverage for all rule types plus neutral sequences.


- Merge/validation units exercise identity tolerance, YTD monotonicity, and tax/date validation.



- Snapshot tests guard dossier/HR PDFs against regression using mean/hash comparisons.


- Autoparse and anomaly coverage are described qualitatively in the run log but not exported as metrics.




## Performance & Cost Notes
- Celery broker/backend share Redis; no explicit concurrency tuning is documented, so worker parallelism defaults should be revisited for production sizing.


- Storage downloads rely on signed URLs with short timeouts; no long-running synchronous operations were observed on API endpoints, but export bundles skip fetching PDFs entirely (functional issue noted above).




## Known Limitations / Future Work
1. Replace hard-coded Supabase credentials in the frontend with environment-driven configuration and rotate the published key.


2. Tighten `/internal/jobs/{id}` to require the internal token (or equivalent server authentication) to align with security docs.


3. Modify `build_export_zip` to embed actual PDF bytes (or signed URLs) instead of zero-length placeholders.


4. Expose the knowledge base to anonymous clients per PRD, or update documentation to match current behaviour.


5. Regenerate Supabase TypeScript definitions so client code sees newly added columns like `storage_path` and `redactions.user_id`.



6. Instrument autoparse and identity rule pass rates to satisfy go-live gate reporting expectations.



## Definition of Done Sign-off
- ❌ Security & Privacy (A) – Blocked by exposed Supabase key, non-public KB policy, and unauthenticated internal job endpoint.
- ✅ Database & Migrations (B)
- ✅ Front-End Contracts (C)
- ❌ Worker Pipeline & Jobs (D) – Export bundles omit PDFs; HR pack lacks preview link.
- ❌ API & OpenAPI (E) – Internal job inspector is unauthenticated.
- ✅ Testing & Fixtures (F)
- ✅ Ops & Infra (G)
- ⚠️ Performance & Cost (H) – Concurrency guidance/documentation pending.

**Go-live Gate: FAIL** (high severity findings remain in areas A, D, and E; autoparse metric reporting needs instrumentation).
---END AUDIT.md---

---BEGIN audit_report.json---
{
  "summary": "red",
  "areas": {
    "security_privacy": {
      "status": "red",
      "notes": "RLS and redaction workflows are in place, but the frontend ships a live Supabase anon key, the knowledge base policy is not publicly readable, and /internal/jobs/{id} is reachable without the internal token.",
      "evidence": [
        "F:supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql†L4-L178",
        "F:src/integrations/supabase/client.ts†L5-L17",
        "F:apps/api/main.py†L58-L67"
      ]
    },
    "schema_migrations": {
      "status": "yellow",
      "notes": "Core tables match the PRD and migrations are additive, but generated Supabase types lag behind new columns.",
      "evidence": [
        "F:supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql†L4-L178",
        "F:src/integrations/supabase/types.ts†L24-L118"
      ]
    },
    "frontend_contracts": {
      "status": "green",
      "notes": "Lovable UI contracts (ReviewDrawer, Upload, Dashboard, Settings, DossierModal, enums/utilities) are satisfied.",
      "evidence": [
        "F:src/components/ReviewDrawer.tsx†L16-L200",
        "F:src/pages/Upload.tsx†L145-L259",
        "F:src/pages/Dashboard.tsx†L30-L211",
        "F:src/pages/Settings.tsx†L24-L204",
        "F:src/components/DossierModal.tsx†L16-L133"
      ]
    },
    "workers_jobs": {
      "status": "red",
      "notes": "Extraction, anomaly detection, dossier, and delete flows work, but export_all writes empty PDFs and HR packs lack the required preview link.",
      "evidence": [
        "F:apps/worker/tasks.py†L201-L492",
        "F:apps/worker/services/reports.py†L45-L98"
      ]
    },
    "api_openapi": {
      "status": "red",
      "notes": "OpenAPI matches the FastAPI routes, yet /internal/jobs/{id} does not enforce the internal token, exposing job metadata.",
      "evidence": [
        "F:openapi/api.yaml†L34-L88",
        "F:apps/api/main.py†L41-L67"
      ]
    },
    "tests_fixtures": {
      "status": "green",
      "notes": "Fixtures, unit coverage for merge/validation/anomalies, E2E pipeline, and snapshot tests are present.",
      "evidence": [
        "F:scripts/fixtures/README.md†L3-L9",
        "F:tests/test_merge.py†L8-L75",
        "F:tests/test_validation.py†L18-L75",
        "F:tests/test_anomalies.py†L17-L54",
        "F:tests/test_e2e.py†L63-L177",
        "F:tests/test_snapshots.py†L1-L43"
      ]
    },
    "ops_infra": {
      "status": "green",
      "notes": "Docker compose, freshclam automation, and runbooks/security docs align with operational expectations.",
      "evidence": [
        "F:infra/docker-compose.yml†L1-L26",
        "F:infra/dockerfiles/worker-entrypoint.sh†L1-L17",
        "F:docs/RUNBOOKS.md†L3-L53",
        "F:docs/SECURITY.md†L3-L23"
      ]
    },
    "perf_cost": {
      "status": "yellow",
      "notes": "No blocking calls observed, spend tracking is instrumented, but Celery concurrency guidance is undocumented and exports omit PDF retrieval.",
      "evidence": [
        "F:apps/worker/services/storage.py†L31-L55",
        "F:apps/worker/celery_app.py†L7-L13",
        "F:apps/worker/services/llm.py†L72-L103",
        "F:apps/worker/services/reports.py†L87-L98"
      ]
    }
  },
  "requirements": [
    {"id":"A1","title":"Storage RLS owner-prefix","status":"pass","severity":"critical","evidence":["F:supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql†L4-L47","F:src/pages/Upload.tsx†L151-L207"],"notes":""},
    {"id":"A2","title":"Table RLS and public KB","status":"partial","severity":"high","evidence":["F:supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql†L32-L178"],"notes":"KB select policy targets only authenticated role, not anonymous public access."},
    {"id":"A3","title":"No service role in frontend","status":"pass","severity":"high","evidence":["F:src/integrations/supabase/client.ts†L5-L17","F:apps/common/supabase.py†L9-L27"],"notes":""},
    {"id":"A4","title":"LLM privacy controls","status":"pass","severity":"high","evidence":["F:apps/worker/tasks.py†L201-L235","F:apps/worker/services/llm.py†L55-L103","F:tests/test_privacy.py†L1-L48"],"notes":""},
    {"id":"A5","title":"DPIA, Security, Runbooks","status":"pass","severity":"medium","evidence":["F:docs/RUNBOOKS.md†L3-L53","F:docs/SECURITY.md†L3-L23","F:docs/DPIA.md†L12-L39"],"notes":""},
    {"id":"A6","title":"Spend-cap fallback & logging","status":"pass","severity":"high","evidence":["F:apps/worker/services/llm.py†L72-L103","F:apps/worker/tasks.py†L172-L179"],"notes":""},
    {"id":"A7","title":"Secrets hygiene","status":"missing","severity":"high","evidence":["F:src/integrations/supabase/client.ts†L5-L17"],"notes":"Real Supabase URL and anon key committed in repository."},
    {"id":"B1","title":"Core tables & constraints","status":"pass","severity":"high","evidence":["F:supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql†L4-L118","F:supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql†L28-L118"],"notes":""},
    {"id":"B2","title":"Additive migrations only","status":"pass","severity":"medium","evidence":["F:migrations/0001_add_if_missing.sql†L1-L40","F:migrations/0003_fix_redactions_and_paths.sql†L1-L32"],"notes":""},
    {"id":"B3","title":"Generated Supabase types current","status":"partial","severity":"medium","evidence":["F:migrations/0003_fix_redactions_and_paths.sql†L1-L32","F:src/integrations/supabase/types.ts†L24-L118"],"notes":"Types omit `storage_path` and `redactions.user_id`. Regenerate types to avoid runtime issues."},
    {"id":"C1","title":"ReviewDrawer contract","status":"pass","severity":"medium","evidence":["F:src/components/ReviewDrawer.tsx†L16-L200"],"notes":""},
    {"id":"C2","title":"Upload flow expectations","status":"pass","severity":"high","evidence":["F:src/pages/Upload.tsx†L145-L259"],"notes":""},
    {"id":"C3","title":"Dashboard filters & conflicts","status":"pass","severity":"high","evidence":["F:src/pages/Dashboard.tsx†L30-L211","F:src/lib/conflicts.ts†L8-L26"],"notes":""},
    {"id":"C4","title":"Settings jobs & export link","status":"pass","severity":"medium","evidence":["F:src/pages/Settings.tsx†L24-L204"],"notes":""},
    {"id":"C5","title":"DossierModal schema","status":"pass","severity":"medium","evidence":["F:src/components/DossierModal.tsx†L16-L133"],"notes":""},
    {"id":"C6","title":"Enums and shared utils","status":"pass","severity":"medium","evidence":["F:src/types/jobs.ts†L1-L16","F:src/lib/format.ts†L1-L34","F:src/lib/period.ts†L1-L18","F:src/lib/flags.ts†L1-L8"],"notes":""},
    {"id":"D1","title":"Extract job pipeline","status":"pass","severity":"critical","evidence":["F:apps/worker/tasks.py†L201-L364"],"notes":""},
    {"id":"D2","title":"detect_anomalies job rules","status":"pass","severity":"high","evidence":["F:apps/worker/services/anomalies.py†L1-L65","F:apps/worker/tasks.py†L366-L424"],"notes":""},
    {"id":"D3","title":"dossier job output","status":"pass","severity":"medium","evidence":["F:apps/worker/tasks.py†L426-L441"],"notes":""},
    {"id":"D4","title":"hr_pack job requirements","status":"partial","severity":"medium","evidence":["F:apps/worker/tasks.py†L443-L456","F:apps/worker/services/reports.py†L45-L84"],"notes":"Generated HR pack lacks linked redacted preview described in PRD."},
    {"id":"D5","title":"export_all bundle contents","status":"missing","severity":"high","evidence":["F:apps/worker/services/reports.py†L87-L98"],"notes":"PDFs are written as empty strings; users cannot download source documents."},
    {"id":"D6","title":"delete_all scope","status":"pass","severity":"high","evidence":["F:apps/worker/tasks.py†L484-L492","F:apps/worker/services/cleanup.py†L10-L33"],"notes":""},
    {"id":"D7","title":"Retention cron behaviour","status":"pass","severity":"medium","evidence":["F:apps/worker/services/cleanup.py†L35-L62","F:apps/worker/tasks.py†L495-L500"],"notes":""},
    {"id":"E1","title":"Internal job endpoints secure","status":"missing","severity":"high","evidence":["F:apps/api/main.py†L41-L67","F:docs/SECURITY.md†L5-L11"],"notes":"/internal/jobs/{id} does not require the internal token and leaks job metadata."},
    {"id":"E2","title":"OpenAPI matches FastAPI","status":"pass","severity":"medium","evidence":["F:openapi/api.yaml†L1-L88","F:apps/api/main.py†L18-L125"],"notes":""},
    {"id":"F1","title":"Fixture set completeness","status":"pass","severity":"medium","evidence":["F:scripts/fixtures/README.md†L3-L9"],"notes":""},
    {"id":"F2","title":"Merge & validation unit tests","status":"pass","severity":"medium","evidence":["F:tests/test_merge.py†L8-L75","F:tests/test_validation.py†L18-L75"],"notes":""},
    {"id":"F3","title":"Anomaly rule coverage tests","status":"pass","severity":"medium","evidence":["F:tests/test_anomalies.py†L17-L54"],"notes":""},
    {"id":"F4","title":"E2E pipeline & autoparse gate","status":"pass","severity":"high","evidence":["F:tests/test_e2e.py†L63-L177"],"notes":""},
    {"id":"F5","title":"Snapshot regression tests","status":"pass","severity":"medium","evidence":["F:tests/test_snapshots.py†L1-L43","F:tests/snapshots/baselines.json†L1-L14"],"notes":""},
    {"id":"F6","title":"Autoparse/anomaly reporting","status":"partial","severity":"low","evidence":["F:CODEX_RUNLOG.md†L5-L20"],"notes":"Narrative run log exists but no exported metrics for dashboards."},
    {"id":"G1","title":"Docker compose coverage","status":"pass","severity":"medium","evidence":["F:infra/docker-compose.yml†L1-L26"],"notes":""},
    {"id":"G2","title":"Freshclam automation","status":"pass","severity":"medium","evidence":["F:infra/dockerfiles/worker-entrypoint.sh†L1-L17"],"notes":""},
    {"id":"G3","title":"Runbook completeness","status":"pass","severity":"medium","evidence":["F:docs/RUNBOOKS.md†L3-L53"],"notes":""},
    {"id":"G4","title":"Security documentation","status":"pass","severity":"medium","evidence":["F:docs/SECURITY.md†L3-L23"],"notes":""},
    {"id":"H1","title":"Blocking calls in API paths","status":"pass","severity":"low","evidence":["F:apps/worker/services/storage.py†L31-L55"],"notes":"PDF downloads use short-lived signed URLs; no excessive blocking spotted."},
    {"id":"H2","title":"Celery parallelism transparency","status":"partial","severity":"low","evidence":["F:apps/worker/celery_app.py†L7-L13"],"notes":"Concurrency/queue sizing not documented for operations."},
    {"id":"H3","title":"Spend tracking instrumentation","status":"pass","severity":"medium","evidence":["F:apps/worker/services/llm.py†L72-L103"],"notes":""}
  ],
  "metrics": {
    "autoparse_rate": 0.85,
    "identity_pass_rate": 0.0,
    "fixtures_count": 6
  },
  "gaps": [
    {"id":"G-001","title":"Hard-coded Supabase URL and anon key in frontend","severity":"high","evidence":["F:src/integrations/supabase/client.ts†L5-L17"],"remediation":"Load the publishable key and project URL from environment variables, purge committed secrets, and rotate credentials.","owner":"Frontend Lead"},
    {"id":"G-002","title":"export_all bundle omits PDF content","severity":"high","evidence":["F:apps/worker/services/reports.py†L87-L98"],"remediation":"Fetch each payslip PDF (or generate signed URLs) and include the binary data in the export archive.","owner":"Backend Lead"},
    {"id":"G-003","title":"Internal jobs endpoint lacks authentication","severity":"high","evidence":["F:apps/api/main.py†L58-L67","F:docs/SECURITY.md†L5-L11"],"remediation":"Require `X-Internal-Token` (or equivalent service auth) for GET /internal/jobs/{id}` and update OpenAPI accordingly.","owner":"API Lead"},
    {"id":"G-004","title":"Knowledge base not publicly readable","severity":"medium","evidence":["F:supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql†L137-L156"],"remediation":"Adjust KB policy to allow anonymous read access or revise PRD expectations.","owner":"Platform Engineer"},
    {"id":"G-005","title":"Supabase client types out of sync","severity":"medium","evidence":["F:migrations/0003_fix_redactions_and_paths.sql†L1-L32","F:src/integrations/supabase/types.ts†L24-L118"],"remediation":"Regenerate Supabase TypeScript types after schema changes to reflect new columns and policies.","owner":"Frontend Lead"}
  ]
}
---END audit_report.json---

---BEGIN OPENAPI_REPORT.md---
# OpenAPI vs Implementation

| Path | Method | Spec Reference | Implementation Reference | Notes |
| --- | --- | --- | --- | --- |
| `/healthz` | GET | Spec returns `{ok, redis_url}` with 200/503 responses.

 | FastAPI checks Supabase and Redis before responding with `{ok, redis_url}`.

 | Matches specification. |
| `/internal/jobs/trigger` | POST | Requires `internalToken`, enqueues job, returns Job schema.

 | Implementation enforces `require_internal_token` and inserts the job.

 | Matches specification. |
| `/internal/jobs/{id}` | GET | Spec defines 200/404/403 responses but no security requirement.

 | Implementation only validates the internal token when header is provided; otherwise any caller can read job data.

 | Functional match, but security docs claim internal-only access; consider adding required security to spec and code. |
| `/dossier/preview` | GET | Requires bearer auth, returns DossierResponse.

 | FastAPI depends on `get_current_user` and returns structured dossier data.

 | Matches specification. |

**Mismatch Highlight:** `/internal/jobs/{id}` should explicitly require the internal token to align with security expectations; update both code and OpenAPI security section accordingly.



---END OPENAPI_REPORT.md---

---BEGIN TEST_REPORT.md---
# Test & Fixture Summary

## Fixtures
- `uk_text.pdf`, `uk_scan.pdf`, `ie_text.pdf`, `ie_scan.pdf`, `password.pdf`, `multi_page.pdf` listed for pipeline validation.



## Unit / Integration Coverage
- **Merge & Validation:** Tests ensure native values override LLM payloads, identity rule tolerance (±0.50), period inference, and confidence heuristics.



- **Anomaly Rules:** Synthetic history generation verifies NET_DROP, MISSING_PENSION, TAX_CODE_CHANGE, YTD_REGRESSION, and NEW_DEDUCTION triggers, plus a neutral case.


- **Privacy Guardrails:** LLM requests receive redacted previews with 0–100 highlights, ensuring no raw imagery leaks.


- **Snapshot PDFs:** Dossier and HR pack PDFs are snapshot-tested via image hash/mean comparisons with strict tolerances.



## End-to-End Results
- `tests/test_e2e.py` processes all six fixtures through extract → anomaly → dossier/export/HR pack jobs, asserting an autoparse rate ≥85%, presence of review metadata, anomaly follow-up execution, and artifact uploads.


  - Autoparse coverage: ≥0.85 (per assertion); actual value not persisted outside the test.
  - Downstream jobs: dossier, export_all, and hr_pack produce download URLs (though export PDFs are currently empty — see findings).

## Known Gaps
- Autoparse and identity-rule pass rates are not exported as metrics; only test assertions and run log prose document performance.



- Export bundle content requires remediation before manual verification can pass.

No flaky tests were observed in the reviewed suite.
---END TEST_REPORT.md---

---BEGIN RISK_REGISTER.md---
| ID | Risk | Likelihood | Impact | Mitigation | Evidence |
| --- | --- | --- | --- | --- | --- |
| R1 | Live Supabase anon key committed in frontend could enable abuse if rate limits misconfigured. | Medium | High | Move Supabase URL/key to environment variables, purge history, rotate credentials, and monitor for misuse. | 

 |
| R2 | `export_all` archives omit actual PDF content, breaking data portability commitments. | High | High | Fetch PDFs (or generate signed URLs) when building the ZIP so exports contain the promised documents. | 

 |
| R3 | `/internal/jobs/{id}` accessible without internal token exposes job metadata and meta (e.g., redaction previews). | Medium | High | Enforce internal token on GET, audit existing logs for unauthorized access, and update OpenAPI/security docs. | 


 |
| R4 | Knowledge base RLS restricts anonymous reads, conflicting with PRD and potentially breaking marketing pages. | Medium | Medium | Broaden policy to allow `anon` role or clarify product requirement; monitor for frontend errors. | 

 |
| R5 | Celery concurrency not documented; default worker count may bottleneck processing under load. | Medium | Medium | Document recommended concurrency/queue sizing and add runtime configuration knobs. | 

 |
| R6 | Supabase type definitions lag schema, risking runtime bugs when accessing new columns. | Medium | Medium | Regenerate Supabase TypeScript types after migrations; add CI guard to prevent drift. | 


 |
---END RISK_REGISTER.md---

---BEGIN GO_LIVE_CHECKLIST.md---
- ❌ Supabase secrets loaded via environment (no hard-coded keys).


- ✅ Storage RLS owner-prefix enforced on payslips bucket.


- ✅ Table RLS ensures own-row access for files, payslips, anomalies, jobs, redactions, llm_usage, events.



- ❌ Knowledge base publicly readable per PRD.


- ✅ LLM calls use redacted previews and JSON-schema prompts with temperature 0.



- ✅ Spend cap triggers event logging and native/OCR fallback.



- ✅ ClamAV signatures refreshed on boot and daily via worker entrypoint.


- ✅ Retention cleanup removes aged data and logs events.



- ❌ Internal job inspection endpoint secured with internal token.


- ❌ Export bundle verified to include original PDFs.


- ✅ Autoparse >=85% across fixtures (per tests).


- ⚠️ Identity rule ≥98% post-review – instrumentation missing; rely on additional monitoring before launch.

 
---END GO_LIVE_CHECKLIST.md---

**Summary**
- Confirmed storage and table RLS guardrails alongside redaction-first LLM workflows, satisfying core privacy controls despite the KB select policy being limited to authenticated users.



- Identified high-severity gaps: a live Supabase anon key in the frontend, unauthenticated access to `/internal/jobs/{id}`, and export bundles that omit PDF content, all of which must be remediated before go-live.




- Validated Lovable FE contracts, worker anomaly logic, and extensive pytest coverage (unit, privacy, E2E, snapshot), while noting the need for explicit autoparse/identity metrics reporting.





**Testing**
- ⚠️ Tests not run (read-only audit based on repository inspection and existing test suite).
