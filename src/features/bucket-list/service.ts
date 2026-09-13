import { supabase } from '@/lib/supabase';
import type { SavedPlace } from './types';

interface PlaceDetails {
  display_name: string | null;
  formatted_address: string | null;
  primary_type_display_name: string | null;
  rating: number | null;
  price_level: string | null;
  open_now: boolean | null;
}

interface SavedPlaceRow {
  google_place_id: string;
  mode: SavedPlace['mode'];
  saved_at: string;
  places: PlaceDetails[] | PlaceDetails | null;
}

export async function getSavedPlaces(userId: string): Promise<SavedPlace[]> {
  if (!supabase) throw new Error('Connect the app to Supabase to view saved places.');

  const { data, error } = await supabase
    .from('saved_places')
    .select(`
      google_place_id,
      mode,
      saved_at,
      places (
        display_name,
        formatted_address,
        primary_type_display_name,
        rating,
        price_level,
        open_now
      )
    `)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as SavedPlaceRow[]).map(({ places, ...savedPlace }) => {
    const details = Array.isArray(places) ? places[0] : places;

    return {
      ...savedPlace,
      display_name: details?.display_name ?? null,
      location: details?.formatted_address ?? null,
      category: details?.primary_type_display_name ?? null,
      rating: details?.rating ?? null,
      price_level: details?.price_level ?? null,
      open_now: details?.open_now ?? null,
    };
  });
}
