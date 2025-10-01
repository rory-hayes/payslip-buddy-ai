# Build Audit — v1 (Post Backend Implementation)

## 1. High-Level Status
| Area | Status | Notes |
| --- | --- | --- |
| Frontend SPA | ✅ | Audit confirmed Lovable SPA aligns with PRD. No frontend changes required. |
| Backend API | ✅ | FastAPI service live with `/healthz`, `/dossier/preview`, and secured internal job controls. |
| Worker Pipeline | ✅ | Celery workers handle extract → anomaly → reporting/export/delete jobs with ClamAV, redaction, LLM fallback, and retention cron. |
| Database & Storage | ✅ | Additive migrations only; storage helpers enforce `{user}/{file}` naming and RLS policies remain intact. |
| Docs & Ops | ✅ | RUNBOOKS, SECURITY, DPIA refreshed; knowledge base seeding expanded. |

## 2. Feature Matrix (Backend)
| Capability | Implemented | Evidence |
| --- | --- | --- |
| PDF intake & antivirus | ✅ | `apps/worker/tasks.py` downloads via signed URL and scans with ClamAV before parsing. |
| Text/vision extraction | ✅ | Native pdfplumber heuristics merged with GPT-4o-mini (redacted imagery only) and spend-cap enforcement. |
| Redaction previews | ✅ | Regex-based redaction, preview PNG stored at `{user}/{file}_redacted.png`, coordinates saved to `redactions`. |
| Identity validation | ✅ | Identity rule enforced with ±0.50 tolerance; failures mark job `needs_review`. |
| Anomaly detection | ✅ | NET_DROP, MISSING_PENSION, TAX_CODE_CHANGE, YTD_REGRESSION, NEW_DEDUCTION implemented with historical context. |
| Reporting | ✅ | Dossier/HR pack PDF generation via WeasyPrint; export bundles zipped with payslips/anomalies/settings. |
| Delete & retention | ✅ | `delete_all` purges DB + storage assets; retention cron removes aged rows/artifacts and emits events. |
| Spend cap controls | ✅ | LLM usage logged with cost tokens, cap triggers fallback and events. |
| API observability | ✅ | `/internal/jobs/{id}` returns job state; `/internal/jobs/trigger` supports ops debugging. |

## 3. Testing Snapshot
- ✅ `pytest` — unit coverage for merge logic and anomaly rules.
- 🔄 E2E fixture tests pending sample PDFs in Supabase Storage; placeholder documented in runbook.

## 4. Outstanding Considerations
- Add OCR fallback (e.g., Tesseract) to improve scanned payslip extraction accuracy.
- Capture golden fixtures for dossier/HR pack snapshot tests.
- Monitor ClamAV signature updates within containerized deployment.
- Expand automated anomaly regression coverage once historical datasets are available.
