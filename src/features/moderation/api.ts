import { supabase } from '@/lib/supabase';
import type { ModerationReport, ModerationResolution, ModerationStatus } from './types';

function client() {
  if (!supabase) throw new Error('Moderation is unavailable until Supabase is configured.');
  return supabase;
}
export async function listReports(status: ModerationStatus, offset = 0) {
  const { data, error } = await client().functions.invoke<{ reports?: ModerationReport[]; error?: string }>('moderate-social', {
    body: { action: 'list', status, offset },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.reports ?? [];
}
export async function resolveReport(reportId: string, resolution: ModerationResolution, notes: string) {
  const { data, error } = await client().functions.invoke<{ resolved?: boolean; error?: string }>('moderate-social', {
    body: { action: 'resolve', report_id: reportId, resolution, notes },
  });
  if (error) throw error;
  if (data?.error || !data?.resolved) throw new Error(data?.error ?? 'The report could not be resolved.');
}
