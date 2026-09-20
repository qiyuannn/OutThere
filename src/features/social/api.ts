import { supabase } from '@/lib/supabase';
import { normalizeSocialSummary } from './model';
import type { SocialMutation, SocialReadAction, SocialSummary } from './types';

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
}

export async function readSocialSummary(): Promise<SocialSummary> {
  const { data, error } = await client().rpc('social_summary');
  if (error) throw error;
  return normalizeSocialSummary(data as Partial<SocialSummary> | null);
}
