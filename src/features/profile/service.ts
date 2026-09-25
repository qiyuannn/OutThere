import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { normalizeProfile, type AvatarSelection, type Profile, type ProfileDraft } from './model';
function client() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; }
const fields = 'user_id,username,display_name,bio,avatar_path,onboarding_completed,version,created_at,updated_at';

export type VisitedPlace = { googlePlaceId: string; latitude: number; longitude: number; name: string; rating: number };
export type ProfileVisitSummary = { averageRating: number | null; places: VisitedPlace[]; visitedCount: number };
export type DistributionStatistics = { averageRating: number | null; placesRated: number; weights: Record<string, number> };
type VisitPlaceRow = { display_name: string | null; latitude: number | null; longitude: number | null };
type VisitRow = { google_place_id: string; rating: number | string; places: VisitPlaceRow | VisitPlaceRow[] | null };
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

export async function loadProfileVisitSummary(userId: string): Promise<ProfileVisitSummary> {
  const pageSize = 500;
  const rows: VisitRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client().from('user_place_ratings')
      .select('google_place_id,rating,places(display_name,latitude,longitude)')
      .eq('user_id', userId).order('rated_at', { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as VisitRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  let ratingTotal = 0;
  let ratingCount = 0;
  const places = rows.flatMap((row): VisitedPlace[] => {
    const rating = typeof row.rating === 'number' ? row.rating : Number.parseFloat(row.rating);
    if (Number.isFinite(rating)) { ratingTotal += rating; ratingCount += 1; }
    const place = Array.isArray(row.places) ? row.places[0] : row.places;
    if (!place || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return [];
    return [{ googlePlaceId: row.google_place_id, latitude: place.latitude, longitude: place.longitude,
      name: place.display_name?.trim() || 'Visited place', rating: Number.isFinite(rating) ? rating : 0 }];
  });
  return { averageRating: ratingCount ? ratingTotal / ratingCount : null, places, visitedCount: rows.length };
}
export async function saveProfile(userId: string, current: Profile | null, draft: ProfileDraft, completed: boolean, avatar: AvatarSelection | null): Promise<Profile> {
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
      user_id: userId, onboarding_completed: completed || !!current?.onboarding_completed };
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

export async function loadDistributionStatistics(
  userId: string,
  mode: 'food' | 'activities',
): Promise<DistributionStatistics> {
  const pageSize = 500;
  const ratings: number[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client()
      .from('user_place_ratings')
      .select('rating')
      .eq('user_id', userId)
      .eq('mode', mode)
      .order('rated_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as Array<{ rating: number | string }>;
    for (const row of page) {
      const rating = typeof row.rating === 'number' ? row.rating : Number.parseFloat(row.rating);
      if (Number.isFinite(rating)) ratings.push(rating);
    }
    if (page.length < pageSize) break;
  }
  const weights = await getUserCategoryWeights(userId, mode);
  return {
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    placesRated: ratings.length,
    weights,
  };
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

export type UserFollowRelationship = 'following' | 'requested' | 'none';

export async function getFollowRelationship(targetUserId: string): Promise<UserFollowRelationship> {
  if (!targetUserId) return 'none';
  const { data, error } = await client().rpc('get_follow_relationship', {
    p_target_user_id: targetUserId,
  });
  if (error) return 'none';
  return (data as UserFollowRelationship) ?? 'none';
}

export async function sendFollowRequest(targetUserId: string): Promise<UserFollowRelationship> {
  if (!targetUserId) return 'none';
  const { data, error } = await client().rpc('send_follow_request', {
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
  return (data as UserFollowRelationship) ?? 'requested';
}

export async function cancelFollowRequest(targetUserId: string): Promise<void> {
  if (!targetUserId) return;
  const { error } = await client().rpc('cancel_follow_request', {
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
}

export async function isFollowingUser(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || !followingId || followerId === followingId) return false;
  const { data, error } = await client()
    .from('user_follows')
    .select('created_at')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (!followerId || !followingId || followerId === followingId) return;
  await sendFollowRequest(followingId);
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  if (!followerId || !followingId || followerId === followingId) return;
  const { error } = await client().rpc('unfollow_user', {
    p_target_user_id: followingId,
  });
  if (error) {
    await client()
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
  }
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  try {
    const [followersRes, followingRes] = await Promise.all([
      client()
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId),
      client()
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);
    return {
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
    };
  } catch {
    return { followers: 0, following: 0 };
  }
}
