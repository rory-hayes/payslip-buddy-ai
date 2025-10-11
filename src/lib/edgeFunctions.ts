import type { SupabaseClient } from '@supabase/supabase-js';

export const EDGE_FUNCTIONS = {
  EXTRACT: 'hyper-endpoint', // Supabase dashboard slug
} as const;

type InvokeOpts = {
  supabase: SupabaseClient;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

/** Invoke the extract function with error surfacing. */
export async function invokeExtract({ supabase, body = {}, headers = {} }: InvokeOpts) {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.EXTRACT, {
    body,
    headers,
  });
  if (error) {
    const msg = error.message || 'Edge function invoke failed';
    throw new Error(`[edge:${EDGE_FUNCTIONS.EXTRACT}] ${msg}`);
  }
  return data;
}
