/**
 * Period type inference utilities
 * Used when period_type is missing from payslip records
 */

export type PeriodType = 'monthly' | 'weekly' | 'fortnightly' | 'other';

export function inferPeriodType(start?: string | null, end?: string | null): PeriodType {
  if (!start || !end) return 'other';
  
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (days >= 27 && days <= 32) return 'monthly';
  if (days >= 13 && days <= 16) return 'fortnightly';
  if (days >= 6 && days <= 8) return 'weekly';
  return 'other';
}
