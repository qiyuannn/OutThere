import { supabase } from '@/lib/supabase';

export { formatMutualSavesText } from './model';

export type MutualFollowerSavedPlace = {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  savedAt: string;
};

export async function getMutualFollowersSavedPlace(
  placeId: string
): Promise<MutualFollowerSavedPlace[]> {
  if (!supabase || !placeId) return [];

  const { data, error } = await supabase.rpc('get_mutual_followers_saved_place', {
    p_google_place_id: placeId,
  });

  if (error || !data) return [];
  const rows = data as {
    user_id: string;
    display_name: string;
    username: string | null;
    avatar_path: string | null;
    saved_at: string;
  }[];

  if (rows.length === 0) return [];

  const avatarPaths = [...new Set(rows.map((r) => r.avatar_path).filter(Boolean))] as string[];
  const avatarMap = new Map<string, string>();
  if (avatarPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from('avatars')
      .createSignedUrls(avatarPaths, 3600);
    if (signedUrls) {
      for (const item of signedUrls) {
        if (item.path && item.signedUrl) {
          avatarMap.set(item.path, item.signedUrl);
        }
      }
    }
  }

  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    username: r.username,
    avatarUrl: r.avatar_path ? avatarMap.get(r.avatar_path) ?? null : null,
    savedAt: r.saved_at,
  }));
}
