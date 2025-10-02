# Test Report — Payslip Companion

- ✅ `npm run ci:verify` — Audit status guard and Supabase secret scan both pass with no findings.【af07c5†L1-L17】【f62abe†L1-L1】
- ✅ `pytest` — 16 tests covering anomalies, E2E pipeline, privacy, validation, and snapshot suites all passed.【fd2ef3†L1-L13】
  - Export E2E assertion verifies `payslips.csv`, `files.csv`, `anomalies.csv`, `settings.csv`, and every `pdfs/<file_id>.pdf` entry within the ZIP.【F:tests/test_e2e.py†L167-L175】
  - Post-run metrics captured `autoparse_rate=1.0` and `identity_pass_rate=1.0`, meeting go-live gates.【F:tests/test_e2e.py†L195-L207】【F:reports/pipeline_metrics.json†L1-L7】
  - HR pack snapshot updated to include the embedded redacted preview block.【F:tests/test_snapshots.py†L48-L60】【F:tests/snapshots/baselines.json†L1-L16】

All go-live quality gates (autoparse ≥ 0.85, identity ≥ 0.98, export completeness, and secured internal endpoint) remain green.
