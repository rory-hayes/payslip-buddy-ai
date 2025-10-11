// Single source of truth for our function name(s)
export const EDGE_FUNCTIONS = {
  EXTRACT: "hyper-endpoint", // Supabase slug shown in dashboard
} as const;

type InvokeOpts = {
  supabase: any;                 // Supabase client instance
  body?: Record<string, any>;    // JSON body to send
  headers?: Record<string, string>;
};

/**
 * Invoke the extract function with a typed body.
 * Throws on error so callers can handle UI state.
 */
export async function invokeExtract({ supabase, body = {}, headers = {} }: InvokeOpts) {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.EXTRACT, {
    body,
    headers,
  });
  if (error) {
    // Surface more helpful error text to UI and logs
    const msg = error.message || "Edge function invoke failed";
    // Attach the function name so it’s obvious in logs
    throw new Error(`[edge:${EDGE_FUNCTIONS.EXTRACT}] ${msg}`);
  }
  return data;
}
