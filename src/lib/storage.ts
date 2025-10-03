import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve a Supabase storage path into a signed URL that can be safely shared with the UI.
 * Falls back to the original path if signing fails so the UI can still render a placeholder link.
 */
export async function resolveStorageUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  try {
    const { data, error } = await supabase.storage.from('payslips').createSignedUrl(path, expiresIn);
    if (error) {
      throw error;
    }
    return data?.signedUrl ?? null;
  } catch (error) {
    console.warn('Failed to sign storage URL', { path, error });
    return path;
  }
}
