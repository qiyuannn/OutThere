import { supabase } from '@/lib/supabase';
import { normalizeSocialSummary } from './model';
import type { ReportReason, ReportTarget, SocialMutation, SocialReadAction, SocialSummary } from './types';

const listeners = new Set<() => void>();

function client() {
  if (!supabase) throw new Error('Social features are unavailable until Supabase is configured.');
  return supabase;
}

export function subscribeSocial(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function invalidateSocial() {
  listeners.forEach((listener) => listener());
}

export async function readSocial<T>(action: SocialReadAction, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client().rpc('social_api', { action, payload });
  if (error) throw error;
  return data as T;
}

export async function mutateSocial(action: SocialMutation, payload: Record<string, unknown> = {}): Promise<void> {
  const { error } = await client().rpc('social_api', { action, payload });
  if (error) throw error;
  invalidateSocial();
  if (['request', 'accept', 'like', 'comment'].includes(action)) {
    // The social write has already succeeded. Push is best-effort and must not
    // make an interaction appear to fail or cause the client to retry it.
    void client().functions.invoke('social-push', { body: {} });
  }
}

export async function readSocialSummary(): Promise<SocialSummary> {
  const { data, error } = await client().rpc('social_summary');
  if (error) throw error;
  return normalizeSocialSummary(data as Partial<SocialSummary> | null);
}

export async function submitSocialReport(target: ReportTarget, id: string, reason: ReportReason, details: string): Promise<void> {
  const { error } = await client().rpc('social_report', {
    p_target_type: target,
    p_target_id: id,
    p_reason: reason,
    p_details: details,
  });
  if (error) throw error;
}
