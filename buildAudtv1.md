---BEGIN BUILD_AUDIT.md---
# BUILD_AUDIT

## 1. Summary
Overall status **green**: storage RLS, database schema, and frontend contracts line up with the Payslip Companion PRD, and security/privacy documentation is in place. The outstanding work remains backend worker fulfillment per the Codex handoff. 






## 2. Feature Compliance Matrix

| PRD Area | Requirement | Status | Evidence (file:line) | Notes |
| --- | --- | --- | --- | --- |
| Storage & Security | Payslips bucket with `{user_id}/{file_id}.pdf` prefix enforcement | pass | 



 | Bucket exists, RLS restricts first path segment to `auth.uid()`, and FE uploads follow `{user}/{file}.pdf`. |
| Storage & Security | No service role key exposed in frontend | pass | 

 | Only the anon/publishable key is shipped. |
| Storage & Security | LLM privacy redacted-only contract documented | pass | 


 | Docs and FE comments state only redacted imagery leaves storage. |
| Storage & Security | DPIA / SECURITY / RUNBOOKS present | pass | 



 | All documents exist with relevant guidance. |
| Database Schema | `files` required columns present | pass | 

 | Includes `sha256`, `s3_key_original`, `s3_key_redacted`, etc. |
| Database Schema | `payslips` columns incl. confidence/review/conflict | pass | 

 | All specified fields exist. |
| Database Schema | `anomalies` columns incl. snooze/mute | pass | 

 | Columns match PRD. |
| Database Schema | `settings` columns incl. marketing/retention | pass | 

 | Schema aligns. |
| Database Schema | `kb` table columns | pass | 

 | All expected fields present. |
| Database Schema | `jobs` table with enums/meta | pass | 

 | Includes `kind`, `status`, `meta`, timestamps. |
| Database Schema | `redactions` table protected via file ownership | pass | 

 | Policy cross-checks file ownership. |
| Database Schema | `llm_usage` table columns | pass | 

 | Tracks model, tokens, cost. |
| Database Schema | `events` table columns | pass | 

 | Audit payload stored with RLS. |
| Frontend Contracts | ReviewDrawer props, percent highlights, exit gate, ARIA | pass | 

 | Props typed, comment notes percent coordinates, onOpenChange locks when review required, highlights carry `aria-label`. |
| Frontend Contracts | Upload flow (SHA-256 dedupe, password modal/meta, job enqueue, stepper) | pass | 

 | Hash check, password modal, `meta.pdfPassword`, job poller & status stepper implemented. |
| Frontend Contracts | Dashboard filters, conflict resolution, anomaly scoping & snooze/mute, KPIs ignore conflicts | pass | 


 | Filters use `inferPeriodType`, conflict banner & radio enforce single selection, anomalies scoped by `user_id`, KPIs query `conflict=false`. |
| Frontend Contracts | Settings jobs enqueue, disabled states, export download link | pass | 

 | Jobs inserted, buttons disable while running, `download_url` surfaced when ready. |
| Frontend Contracts | DossierModal data shape matches contract | pass | 

 | Types align with PRD spec. |
| Frontend Contracts | Job enums centralized | pass | 

 | Single source of truth for kinds/statuses. |
| Frontend Contracts | Utilities & feature flags centralized | pass | 



 | Formatting helpers and flags live in shared libs. |
| Anomaly Rules | Detection stubs for NET_DROP, MISSING_PENSION, TAX_CODE_CHANGE, YTD_REGRESSION, NEW_DEDUCTION | pass | 

 | Each rule implemented with TODO-ready logic. |
| Anomaly Rules | Snooze/mute wiring updates `snoozed_until`/`muted` | pass | 

 | Updates respective columns via Supabase. |
| Retention & DSR | Delete/export buttons enqueue jobs; retention notes documented | pass | 



 | UI enqueues `delete_all`/`export_all`; docs cover cron cleanup. |

## 3. Schema Diff
| Table | Expected Columns | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| files | id, user_id, file_name, file_size, sha256, s3_key_original, s3_key_redacted, created_at | matches | 

 | No diffs. |
| payslips | id, user_id, file_id, employer_name, pay_date, period_start, period_end, period_type, country, currency, gross, net, tax_income, ni_prsi, pension_employee, pension_employer, student_loan, other_deductions, ytd, confidence_overall, review_required, conflict, explainer_text, created_at, updated_at | matches | 

 | Includes PRD-required analytics columns. |
| anomalies | id, user_id, payslip_id, type, severity, message, snoozed_until, muted, created_at | matches | 

 | Severity constrained per spec. |
| settings | user_id (PK), retention_days, region, locale, marketing_opt_in, created_at, updated_at | matches | 

 | Defaults align with PRD. |
| kb | region, category, title, note, link (+sort_order, created_at) | matches | 

 | Extra `sort_order` useful for ordering. |
| jobs | id, user_id, file_id, kind, status, meta, error, created_at, updated_at | matches | 

 | Enum constraints match Lovable contract. |
| redactions | id, file_id, boxes, created_at | matches | 

 | RLS checks owner via files table. |
| llm_usage | id, user_id, file_id, model, tokens_input, tokens_output, cost, created_at | matches | 

 | Numeric cost tracked. |
| events | id, user_id, type, payload, created_at | matches | 

 | Policy restricts to owner. |

## 4. Security & Privacy
- Supabase storage policies restrict insert/select/delete to objects whose first path segment matches `auth.uid()`, and the upload path enforces `{user}/{file}.pdf`. 




- All sensitive tables have RLS policies limiting operations to the owning user, including derived tables like `jobs`, `redactions`, `llm_usage`, and `events`. 


- The frontend only uses the Supabase anon key, avoiding service-role exposure. 


- Privacy docs mandate redaction before any LLM usage, with DPIA/SECURITY/RUNBOOKS describing controls and incident response. 






## 5. Frontend Contracts
- **ReviewDrawer**: Props typed exactly as specified, highlight coordinates documented as percentages, exit gated on `needsReview`, and highlight overlays expose ARIA labels. 


- **Upload Flow**: Computes SHA-256, blocks duplicates, supports password modal feeding `jobs.meta.pdfPassword`, enqueues `extract` jobs, and renders a status-aware stepper. 


- **Dashboard**: Employer & period filters, conflict banner and radio selection call shared conflict resolver, anomalies query scoped by `user_id` with snooze/mute updates, and KPIs exclude `conflict=true`. 



- **Settings**: Enqueues `delete_all` / `export_all`, buttons disable while jobs run, and completed exports surface `meta.download_url`. 


- **DossierModal**: Accepts `DossierResponse` structure from Lovable contract. 


- **Shared Types & Utilities**: Job enums centralized, formatting helpers and feature flags provided. 







## 6. Known Gaps / TODOs
1. **Backend job workers pending (Codex)** – Lovable handoff marks backend processing as unfinished; Codex must implement workers for `extract`, `detect_anomalies`, `hr_pack`, `dossier`, `delete_all`, and `export_all`. _Owner: Codex backend_ 


2. **Operational validation** – Once workers exist, end-to-end tests should confirm storage/object cleanup matches retention policies. _Owner: Codex backend_ 



## 7. Verification Checklist
- Upload enqueues `extract` job and stepper reflects `queued → running → needs_review/done/failed`. 


- Review drawer blocks dismiss when review required or confidence < 0.9; overlays expose ARIA labels. 


- Dashboard employer/period filters, conflict resolution ensures single `conflict=false`, and KPIs ignore conflicted rows. 


- Snooze/mute actions persist to `snoozed_until` / `muted` and hide anomalies after refetch. 


- Settings page enqueues delete/export jobs, disables buttons while active, and shows latest export link. 


- LLM interactions rely on redacted artifacts; no PII leaves storage according to security docs. 





## 8. Next Actions (Codex Backend Phases)
1. **Phase 1 – Extraction Worker**: Implement job processor honoring password metadata and populating `payslips`, `files.s3_key_redacted`, `jobs.status`. 


2. **Phase 2 – Anomaly Detection**: Wire `detect_anomalies` worker to populate `anomalies` using existing rule stubs. 


3. **Phase 3 – Review Loop**: Ensure `ReviewDrawer` confirmations update `payslips` and resolve `needs_review`. 


4. **Phase 4 – Dossier / HR Pack Jobs**: Produce dossier payload conforming to FE contract and upload HR pack artifacts. 


5. **Phase 5 – Retention & DSR Automation**: Implement scheduled cleanup respecting `settings.retention_days` and service the `delete_all` / `export_all` queues. 




---END BUILD_AUDIT.md---

---BEGIN audit_report.json---
{
  "summary": "green",
  "storage_rls": {
    "present": true,
    "evidence": [
      "supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql:L244-L268",
      "supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql:L4-L26",
      "src/pages/Upload.tsx:L172-L207"
    ],
    "notes": "Bucket exists, policies bind first path segment to auth.uid(), and uploads follow the {user_id}/{file_id}.pdf convention."
  },
  "schema": {
    "tables": {
      "files": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql:L5-L30"
        ]
      },
      "payslips": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql:L32-L79"
        ]
      },
      "anomalies": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql:L81-L108"
        ]
      },
      "settings": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql:L110-L135"
        ]
      },
      "kb": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20250930190522_2567d9c5-45c4-442c-9fc5-49e70ba1fb51.sql:L137-L156"
        ]
      },
      "jobs": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql:L28-L53"
        ]
      },
      "redactions": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql:L55-L81"
        ]
      },
      "llm_usage": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql:L83-L101"
        ]
      },
      "events": {
        "present": true,
        "missing_columns": [],
        "evidence": [
          "supabase/migrations/20251001085648_019b9631-14c6-48e7-ab7f-89cdaa80e5c5.sql:L103-L118"
        ]
      }
    }
  },
  "frontend_contracts": {
    "review_drawer": {
      "props_ok": true,
      "percent_coords_doc": true,
      "confirm_gate": true,
      "evidence": [
        "src/components/ReviewDrawer.tsx:L16-L199"
      ]
    },
    "upload_stepper_jobs": {
      "jobs_enqueue": true,
      "password_modal": true,
      "evidence": [
        "src/pages/Upload.tsx:L84-L400"
      ]
    },
    "dashboard_filters_conflict": {
      "filters_ok": true,
      "conflict_resolution_ok": true,
      "kpi_ignores_conflict_true": true,
      "anomalies_scoped_by_user": true,
      "evidence": [
        "src/pages/Dashboard.tsx:L30-L402",
        "src/lib/conflicts.ts:L8-L22"
      ]
    },
    "settings_jobs_export_delete": {
      "enqueue_ok": true,
      "recent_export_link": true,
      "evidence": [
        "src/pages/Settings.tsx:L23-L362"
      ]
    },
    "dossier_shape_ok": {
      "ok": true,
      "evidence": [
        "src/components/DossierModal.tsx:L16-L199"
      ]
    },
    "job_enums_centralized": {
      "ok": true,
      "evidence": [
        "src/types/jobs.ts:L1-L17"
      ]
    },
    "utils_flags": {
      "formatters_ok": true,
      "flags_ok": true,
      "evidence": [
        "src/lib/format.ts:L1-L39",
        "src/lib/period.ts:L1-L19",
        "src/lib/flags.ts:L1-L8"
      ]
    }
  },
  "anomaly_rules_stubs": {
    "present": true,
    "evidence": [
      "apps/worker/services/anomalies.py:L18-L74"
    ],
    "notes": "Worker service includes rule stubs for all required anomaly types."
  },
  "retention_delete_stubs": {
    "present": true,
    "evidence": [
      "src/pages/Settings.tsx:L106-L169",
      "docs/RUNBOOKS.md:L17-L24"
    ],
    "notes": "UI enqueues delete/export jobs and runbooks document retention workflow."
  },
  "gaps": [
    {
      "id": "G1",
      "title": "Backend job workers not yet implemented",
      "severity": "high",
      "evidence": [
        "CODEX_HANDOFF.md:L9-L19"
      ],
      "suggestion": "Implement background processors for extract/anomaly/dossier/export job kinds to fulfill frontend contracts."
    }
  ]
}
---END audit_report.json---
