/**
 * Centralized job type definitions to prevent string drift across the codebase
 */

export type JobKind =
  | 'extract'
  | 'detect_anomalies'
  | 'hr_pack'
  | 'dossier'
  | 'delete_all'
  | 'export_all';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'done'
  | 'failed';
