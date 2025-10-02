# Data Protection Impact Assessment

## Overview
Payslip Companion ingests employee payslips to extract compensation insights. The backend stores source PDFs, parsed structured data, anomaly findings, and generated reports. Processing occurs within EU-friendly Supabase infrastructure plus OpenAI (for redacted vision extraction) and Redis/ClamAV containers managed by the team.

## Data Categories
- **Identifiers**: Supabase user UUIDs, employer names, internal job IDs.
- **Payroll Details**: Gross/net pay, tax, pension, student loan, deductions, year-to-date figures.
- **Documents**: Original PDF payslips, redacted PNG previews, dossier/HR PDF exports.
- **Operational Logs**: Job metadata, events, anomaly descriptions, LLM usage metrics (tokens, cost).

## Processing Activities
1. PDFs uploaded by the authenticated user are scanned for malware and stored under `{user_id}/{file_id}.pdf`.
2. Native parsers extract text; when PDFs are scanned or low fidelity the worker rasterises pages and runs Tesseract OCR locally. OCR output never leaves the worker and feeds the same validation pipeline as native text.
3. Regex-based redaction removes NI/PPS/IBAN/DOB/address values before preview generation. Only redacted images are sent to OpenAI GPT-4o-mini for key-value reinforcement.
4. Parsed values are validated (identity rule, YTD monotonicity, date/tax-code checks) and persisted to `payslips`. Review flags trigger UI workflows.
4. Anomaly detection compares against historical payslips to flag drops, regressions, and code changes. Findings populate the `anomalies` table.
5. Users may request dossiers, HR packs, or exports; generated PDFs/ZIPs are stored back into Supabase Storage with signed URL delivery.
6. Daily retention cleanup removes artifacts older than configured thresholds (30/90 days) and logs deletions in `events`.
7. Delete-all jobs purge user-owned data on request while keeping profile/settings unless `purge_all=true`.

## Lawful Basis & Rights
- **Lawful Basis**: Processing is based on user consent/contract to analyse their payroll documents for budgeting insights.
- **Access & Portability**: Users can export all stored data via the `export_all` job (JSON/CSV + PDFs).
- **Rectification & Erasure**: Users edit/correct payslip fields in the app; `delete_all` removes their records and storage objects.
- **Objection & Restriction**: Users may disable anomaly notifications or redact additional fields; manual review is available for sensitive cases.

## Data Sharing & Sub-processors
- **Supabase**: Authentication, Postgres, and Storage (EU region configured).
- **OpenAI**: Receives redacted PNGs for vision extraction. No raw PII or OCR text is transmitted; spend capped and logged.
- **Redis**: Self-hosted cache/queue within our infrastructure. No persistent storage of PII.
- **ClamAV**: Self-hosted malware scanner.

## Security & Retention Controls
- TLS enforced end-to-end; service role credentials restricted to backend containers.
- Row-Level Security ensures users access only their data. Storage policy enforces owner prefix.
- Retention windows default to 90 days (configurable per user). Export/download artifacts share the same retention policy.
- ClamAV runs in-network with signatures refreshed daily (`freshclam`), and the worker logs the active signature string on first scan.
- Incidents (malware, spend cap) are captured in `events` for audit trails.
