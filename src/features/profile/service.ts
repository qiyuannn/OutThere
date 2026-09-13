import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { normalizeProfile, type AvatarSelection, type Profile, type ProfileDraft } from './model';
function client() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; }
const fields = 'user_id,username,display_name,bio,city,interests,budget,travel_radius_meters,exploration_style,avatar_path,onboarding_step,onboarding_completed,version,created_at,updated_at';
export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select(fields).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
export async function avatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await client().storage.from('avatars').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
export async function saveProfile(userId: string, current: Profile | null, draft: ProfileDraft, step: number, completed: boolean, avatar: AvatarSelection | null): Promise<Profile> {
  const db = client();
  let uploaded: string | null = null;
  let committed = false;
  try {
    if (avatar) {
      const bytes = decode(avatar.base64);
      if (!bytes.byteLength || bytes.byteLength > 2097152) throw new Error('Avatar must be under 2 MB.');
      uploaded = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await db.storage.from('avatars').upload(uploaded, bytes, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
    }
    const normalized = normalizeProfile(draft);
    const row = { ...normalized, username: normalized.username || null, avatar_path: uploaded ?? normalized.avatar_path,
      user_id: userId, onboarding_step: step, onboarding_completed: completed || !!current?.onboarding_completed };
    const query = current
      ? db.from('profiles').update(row).eq('user_id', userId).eq('version', current.version)
      : db.from('profiles').insert(row);
    const { data, error } = await query.select(fields).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Your profile changed on another device. Reload it before saving again.');
    committed = true;
    if (current?.avatar_path && current.avatar_path !== data.avatar_path) {
      // A cleanup failure must not turn a successful profile save into an error.
      void db.storage.from('avatars').remove([current.avatar_path]).catch(() => {});
    }
    return data as Profile;
  } finally {
    if (uploaded && !committed) await db.storage.from('avatars').remove([uploaded]).catch(() => {});
  }
}


export async function getUserCategoryWeights(
  userId: string,
  mode: 'food' | 'activities',
): Promise<Record<string, number>> {
  const table = mode === 'food' ? 'user_food_category_weights' : 'user_activity_category_weights';
  const { data, error } = await client()
    .from(table)
    .select('category_key, weight')
    .eq('user_id', userId);
  if (error) throw error;

  const weights: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ category_key: string; weight: number | string }>) {
    const val = typeof row.weight === 'number' ? row.weight : parseFloat(row.weight);
    weights[row.category_key] = Number.isFinite(val) ? Math.max(0, Math.min(1, Math.round(val * 100) / 100)) : 0;
  }
  return weights;
}

export async function updateCategoryWeight(
  userId: string,
  mode: 'food' | 'activities',
  categoryKey: string,
  weight: number,
): Promise<void> {
  const table = mode === 'food' ? 'user_food_category_weights' : 'user_activity_category_weights';
  const clamped = Math.max(0.00, Math.min(1.00, Math.round(weight * 100) / 100));
  const { error } = await client()
    .from(table)
    .upsert({
      user_id: userId,
      category_key: categoryKey,
      weight: clamped,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,category_key' });
  if (error) throw error;
}

export async function resetCategoryWeight(
  userId: string,
  mode: 'food' | 'activities',
  categoryKey: string,
): Promise<void> {
  return updateCategoryWeight(userId, mode, categoryKey, 0.00);
}

export async function getUserProfileStats(
  userId: string,
  mode: 'food' | 'activities',
): Promise<{ savedCount: number; passedCount: number }> {
  try {
    const [savedRes, passedRes] = await Promise.all([
      client()
        .from('saved_places')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('mode', mode),
      client()
        .from('passed_places')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('mode', mode),
    ]);
    return {
      savedCount: savedRes.count ?? 0,
      passedCount: passedRes.count ?? 0,
    };
  } catch {
    return { savedCount: 0, passedCount: 0 };
  }
}
