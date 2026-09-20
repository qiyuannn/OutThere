// @ts-nocheck -- checked by the Supabase Deno deploy pipeline, not Expo's TypeScript runtime.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createDeleteAccountHandler, DeleteAccountError } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

Deno.serve(createDeleteAccountHandler({
  async authenticate(token) {
    if (!admin) throw new DeleteAccountError('Account deletion is not configured yet.', 503);
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id };
  },
  async profile(userId) {
    const { data, error } = await admin!.from('profiles').select('username, avatar_path').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async removeAvatar(path) {
    const { error } = await admin!.storage.from('avatars').remove([path]);
    if (error) throw error;
  },
  async deleteUser(userId) {
    const { error } = await admin!.auth.admin.deleteUser(userId, false);
    if (error) throw error;
  },
}));
