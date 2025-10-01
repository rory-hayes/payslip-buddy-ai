# Data Protection Impact Assessment

## Overview
Payslip Companion processes employee payslips on behalf of end users to extract key financial figures, detect anomalies, and provide aggregated reports.

## Data Flows
1. Users upload PDF payslips to Supabase Storage (`payslips` bucket) via the frontend.
2. The backend worker downloads the PDF using a signed URL and performs malware scanning, redaction, and extraction.
3. Structured results are stored in Supabase tables (`payslips`, `anomalies`, `jobs`, `events`).
4. Optional reports (HR pack, dossier, exports) are generated and stored back in Supabase Storage.

## Personal Data Processed
- Employee identification data embedded in payslips (names, addresses, NI/PRSI numbers).
- Financial data (gross, net, tax, pension, deductions, year-to-date figures).

## Lawful Basis
Processing is based on user consent and necessity for contract performance to provide payslip insights.

## Data Minimisation
- Redaction removes direct identifiers before invoking any third-party LLM.
- Only structured numeric aggregates persist in the database; original PDFs remain in storage under user control.

## Retention
- Default retention of 30 or 90 days configurable per user via `settings.retention_days`.
- Daily retention job purges expired storage objects and database rows.

## Sub-processors
- Supabase (authentication, database, storage).
- OpenAI (vision model for extraction) — only receives redacted imagery.
- Redis (AWS ElastiCache or equivalent) for job queue metadata.

## Security Controls
- Row Level Security across all user-scoped tables.
- Storage bucket prefix policies to isolate user data.
- Malware scanning (ClamAV) before processing.
- Spend cap enforcement for LLM calls to limit exposure.

## Incident Response
- Events table captures job failures and cleanup actions.
- Runbooks outline procedures for outages, spend cap breaches, and retention failures.
- Users can trigger `delete_all` to immediately purge their data.
