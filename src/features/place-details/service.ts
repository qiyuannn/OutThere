import { supabase } from '@/lib/supabase';
import { resolveSignedUrls } from '@/lib/storage';
import { computeIsOpenNow } from '@/lib/opening-hours';
import { getLivePlaceDetails } from '@/features/search/service';
import type { RankingMode } from '@/features/rankings/types';
import type { PlaceDetails, PlacePhotoItem } from './types';

export { formatMutualSavesText } from './model';

export type MutualFollowerSavedPlace = {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  savedAt: string;
};

interface DatabasePlaceRow {
  google_place_id: string;
  display_name: string | null;
  primary_type_display_name: string | null;
  formatted_address: string | null;
  latitude: number | null; longitude: number | null;
  rating: number | null; user_rating_count: number | null; price_level: string | null;
  regular_opening_hours: string[] | null;
  google_maps_uri: string | null; website_uri: string | null; phone_number: string | null;
  amenities: Record<string, boolean> | null;
  photos: PlacePhotoItem[] | null;
}

export function mapPlaceRowToDetails(data: DatabasePlaceRow): PlaceDetails {
  const regularHours = Array.isArray(data.regular_opening_hours) ? data.regular_opening_hours : [];
  const rawPhotos = (data.photos ?? []) as PlaceDetails['photos'];
  const primaryPhoto = rawPhotos?.find((p) => p.url);
  const firstAttr = rawPhotos?.[0]?.authorAttributions?.[0];

  return {
    id: data.google_place_id,
    name: data.display_name ?? 'Saved Place',
    category: data.primary_type_display_name,
    address: data.formatted_address,
    latitude: data.latitude,
    longitude: data.longitude,
    rating: data.rating,
    ratingCount: data.user_rating_count,
    priceLevel: data.price_level,
    openNow: computeIsOpenNow(regularHours),
    mapsUrl: data.google_maps_uri,
    websiteUri: data.website_uri,
    phoneNumber: data.phone_number,
    regularOpeningHours: regularHours,
    amenities: data.amenities ?? undefined,
    photos: rawPhotos,
    photoUrl: primaryPhoto?.url ?? null,
    photoAttribution: firstAttr?.displayName
      ? { displayName: firstAttr.displayName, uri: firstAttr.uri ?? null }
      : null,
  };
}

export async function fetchPlaceDetailsById(placeId: string): Promise<PlaceDetails | null> {
  if (!supabase || !placeId) return null;
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('google_place_id', placeId)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.display_name) {
    const fresh = (await getLivePlaceDetails([placeId])).get(placeId);
    return fresh ?? null;
  }
  return mapPlaceRowToDetails(data as unknown as DatabasePlaceRow);
}

export async function resolvePlacePhotos(
  placeId: string,
  photos: PlacePhotoItem[]
): Promise<{ photos: PlacePhotoItem[]; photoUrl?: string | null } | null> {
  if (!supabase || !placeId || !photos.length) return null;
  const { data, error } = await supabase.functions.invoke('place-recommendations', {
    body: { action: 'get-place-photos', placeId, photos },
  });
  if (error || !data) return null;
  return data as { photos: PlacePhotoItem[]; photoUrl?: string | null };
}

export async function isPlaceSavedByUser(userId: string, placeId: string): Promise<boolean> {
  if (!supabase || !userId || !placeId) return false;
  const { data } = await supabase
    .from('saved_places')
    .select('google_place_id')
    .eq('user_id', userId)
    .eq('google_place_id', placeId)
    .maybeSingle();
  return !!data;
}

export async function savePlaceForUser(userId: string, placeId: string, mode: RankingMode): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('saved_places').upsert(
    { user_id: userId, google_place_id: placeId, mode, saved_at: new Date().toISOString() },
    { onConflict: 'user_id,google_place_id' }
  );
  if (error) throw error;
}

export async function unsavePlaceForUser(userId: string, placeId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('google_place_id', placeId);
  if (error) throw error;
}

export async function getMutualFollowersSavedPlace(placeId: string): Promise<MutualFollowerSavedPlace[]> {
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
  const avatarMap = await resolveSignedUrls(rows.map((r) => r.avatar_path), 'avatars');
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    username: r.username,
    avatarUrl: r.avatar_path ? avatarMap[r.avatar_path] ?? null : null,
    savedAt: r.saved_at,
  }));
}
