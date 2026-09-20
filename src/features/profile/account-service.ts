import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export async function deleteCurrentAccount(confirmation: string): Promise<void> {
  if (!supabase) throw new Error('Account deletion is unavailable until Supabase is configured.');
  const { data, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>('delete-account', {
    body: { confirmation },
  });
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.clone().json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : 'Your account could not be deleted. Try again.');
  }
  if (error instanceof FunctionsFetchError) throw new Error('Network request failed.');
  if (error || !data?.deleted) throw new Error(data?.error || 'Your account could not be deleted. Try again.');
  // The server has removed the auth identity. Clear the cached mobile session so
  // protected routes immediately return to authentication.
  await supabase.auth.signOut({ scope: 'local' });
}
