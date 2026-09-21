// @ts-nocheck -- checked by the Supabase Deno deploy pipeline, not Expo TypeScript.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

const copy: Record<string, (name: string) => string> = {
  request: name => `${name} sent you a friend request.`,
  accepted: name => `${name} accepted your friend request.`,
  like: name => `${name} liked your rating.`,
  comment: name => `${name} commented on your rating.`,
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  try {
    if (!admin) return reply({ error: 'Push notifications are not configured.' }, 503);
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: true };
    if (authError || !auth.user) return reply({ error: 'Sign in again to continue.' }, 401);
    const { data: rows, error: claimError } = await admin.rpc('claim_social_push', { p_actor: auth.user.id });
    if (claimError) throw claimError;
    if (!rows?.length) return reply({ sent: 0 });
    const messages = rows.slice(0, 100).map((row: { id: string; token: string; kind: string; post_id: string | null; actor_name: string }) => ({
      to: row.token, sound: 'default', title: 'OutThere', body: copy[row.kind]?.(row.actor_name) ?? 'You have a new notification.',
      data: { notificationId: row.id, path: row.post_id ? `/feed/post/${row.post_id}` : '/feed/notifications' },
      channelId: 'social',
    }));
    if (!messages.length) return reply({ sent: 0 });
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Expo push service rejected the request.');
    const tickets = (await response.json()).data ?? [];
    const delivered = [...new Set(tickets.flatMap((ticket: { status?: string }, index: number) =>
      ticket.status === 'ok' ? [rows[index].id] : []))];
    const invalidTokens = tickets.flatMap((ticket: { details?: { error?: string } }, index: number) =>
      ticket.details?.error === 'DeviceNotRegistered' ? [rows[index].token] : []);
    if (delivered.length) await admin.rpc('complete_social_push', { p_notification_ids: delivered });
    if (invalidTokens.length) await admin.rpc('remove_social_push_tokens', { p_tokens: invalidTokens });
    return reply({ sent: delivered.length });
  } catch {
    return reply({ error: 'Push delivery could not be completed.' }, 502);
  }
});
