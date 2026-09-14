import { computeIsOpenNow } from '@/lib/opening-hours';
import { supabase } from '@/lib/supabase';
import type { CachedPlace, SavedPlace } from './types';
import { hydratePlaceRows } from '@/features/search/service';

interface SavedPlaceRow {
  google_place_id: string;
  mode: SavedPlace['mode'];
  saved_at: string;
  places: CachedPlace[] | CachedPlace | null;
}

export async function getSavedPlaces(userId: string): Promise<SavedPlace[]> {
  if (!supabase) throw new Error('Connect the app to Supabase to view saved places.');

  const { data, error } = await supabase
    .from('saved_places')
    .select('google_place_id, mode, saved_at, places(*)')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as SavedPlaceRow[];
  const hydrated = await hydratePlaceRows(rows.map(row => (Array.isArray(row.places) ? row.places[0] : row.places) ?? { google_place_id: row.google_place_id, display_name: null }));
  const byId = new Map(hydrated.map(p => [p.google_place_id, p as CachedPlace & { live_open_now?: boolean | null }]));

  return rows.map(({ places, ...savedPlace }) => {
    const details = byId.get(savedPlace.google_place_id);

    return {
      ...savedPlace,
      display_name: details?.display_name ?? null,
      location: details?.formatted_address ?? null,
      category: details?.primary_type_display_name ?? null,
      rating: details?.rating ?? null,
      price_level: details?.price_level ?? null,
      open_now: details && 'live_open_now' in details ? details.live_open_now ?? null : computeIsOpenNow(details?.regular_opening_hours),
      places: details ?? null,
    };
  });
}

export async function removeSavedPlace(userId: string, placeId: string): Promise<void> {
  if (!supabase) throw new Error('Connect the app to Supabase to remove saved places.');

  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('google_place_id', placeId);

  if (error) throw error;
}
