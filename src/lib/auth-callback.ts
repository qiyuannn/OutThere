import { supabase } from './supabase';

// Strict Mode may mount the callback twice. Exchange a one-use code only once.
let lastCode: string | undefined;
let pendingExchange: ReturnType<NonNullable<typeof supabase>['auth']['exchangeCodeForSession']> | undefined;
export function exchangeAuthCode(code: string) {
  if (!supabase) throw new Error('Authentication is not configured.');
  if (code !== lastCode || !pendingExchange) {
    lastCode = code;
    pendingExchange = supabase.auth.exchangeCodeForSession(code).finally(() => {
      if (lastCode === code) { lastCode = undefined; pendingExchange = undefined; }
    });
  }
  return pendingExchange;
}
