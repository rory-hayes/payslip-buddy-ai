/**
 * Conflict resolution utilities for duplicate payslips
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Payslip } from '@/types/database';

export async function resolveConflictGroup(
  supabase: SupabaseClient,
  selectedPayslipId: string,
  group: Payslip[],
  onOptimistic?: (id: string) => void
) {
  // Optimistic update
  onOptimistic?.(selectedPayslipId);

  const updates = group.map(p =>
    supabase
      .from('payslips')
      .update({ conflict: p.id === selectedPayslipId ? false : true })
      .eq('id', p.id)
  );
  
  const results = await Promise.all(updates);
  const hasError = results.some(r => (r as any).error);
  return !hasError;
}
