// @ts-nocheck -- checked by the Supabase Deno deploy pipeline, not Expo TypeScript.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createModerationHandler, ModerationError } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

Deno.serve(createModerationHandler({
  async authenticate(token) {
    if (!admin) throw new ModerationError(503, 'Moderation is not configured yet.');
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  async list(status, offset) {
    const { data, error } = await admin!.rpc('moderation_queue', { p_status: status, p_offset: offset });
    if (error) throw error;
    return data ?? [];
  },
  async moderate(reportId, resolution, notes, moderatorId) {
    const { error } = await admin!.rpc('moderate_social_report', {
      p_report_id: reportId, p_resolution: resolution, p_notes: notes, p_moderator: moderatorId,
    });
    if (error) throw error;
  },
}));
