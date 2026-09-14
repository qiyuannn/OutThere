import { supabase } from '@/lib/supabase';
import type { SearchArea, SearchPlace, SearchRequest, SearchResponse } from './model';
import type { PlaceSuggestion } from './suggestions-controller';

export async function suggestPlaces(query: string, center?: { latitude: number; longitude: number }): Promise<PlaceSuggestion[]> {
  const data = await invokePlaceSearch<{ suggestions: PlaceSuggestion[] }>({ action: 'suggest', query, ...(center ? { center } : {}) });
  if (!Array.isArray(data.suggestions)) throw new Error('Suggestions are unavailable. You can still search below.');
  return data.suggestions;
}

export async function invokePlaceSearch<T>(body: unknown): Promise<T> {
  if (!supabase) throw new Error('Connect to Supabase to search for places.');
  const { data, error } = await supabase.functions.invoke('place-search', { body: body as Record<string, unknown>, timeout: 45000 });
  if (error) {
    let message = 'Could not connect to place search. Check your connection and try again.';
    if ('context' in error && error.context instanceof Response) {
      try { const response = await error.context.json(); if (typeof response.error === 'string') message = response.error; } catch { /* Network/gateway response. */ }
    }
    throw new Error(message);
  }
  if (!data || data.error) throw new Error(data?.error ?? 'Place search returned an invalid response.');
  return data as T;
}

// Short-lived display state only; never write Google content or photo URLs to disk.
const livePlaces = new Map<string, { place: SearchPlace; expires: number }>();
export function rememberLivePlaces(places: SearchPlace[]) {
  for (const place of places) livePlaces.set(place.id, { place, expires: Date.now() + 2 * 60000 });
  while (livePlaces.size > 120) livePlaces.delete(livePlaces.keys().next().value!);
}
export async function searchPlaces(request: SearchRequest): Promise<SearchResponse> {
  const response = await invokePlaceSearch<SearchResponse>({ action: 'search', ...request });
  if (!Array.isArray(response.places) || !(response.cursor === null || typeof response.cursor === 'string')) throw new Error('Place search returned an invalid response.');
  rememberLivePlaces(response.places);
  return response;
}
export async function searchAreas(query: string): Promise<SearchArea[]> {
  const response = await invokePlaceSearch<{ areas: SearchArea[] }>({ action: 'areas', query });
  if (!Array.isArray(response.areas)) throw new Error('Could not find that area. Try a city or neighbourhood.');
  return response.areas;
}
export async function getLivePlaceDetails(ids: string[]): Promise<Map<string, SearchPlace>> {
  const result = new Map<string, SearchPlace>();
  const missing = [...new Set(ids)].filter(id => {
    const entry = livePlaces.get(id);
    if (entry && entry.expires > Date.now() && entry.place.detailsComplete) { result.set(id, entry.place); return false; }
    return true;
  });
  for (let i = 0; i < missing.length; i += 10) {
    const { places } = await invokePlaceSearch<{ places: SearchPlace[] }>({ action: 'details', ids: missing.slice(i, i + 10) });
    if (!Array.isArray(places)) throw new Error('Could not load place details.');
    rememberLivePlaces(places); places.forEach(p => result.set(p.id, p));
  }
  return result;
}

/** Hydrate ID-only rows introduced by search without adding more persistent Google content. */
export async function hydratePlaceRows<T extends { google_place_id: string; display_name?: string | null }>(rows: T[]): Promise<T[]> {
  const missing = rows.filter(p => !p.display_name).map(p => p.google_place_id);
  if (!missing.length) return rows;
  const places = await getLivePlaceDetails(missing);
  return rows.map(row => {
    const p = places.get(row.google_place_id);
    return !p ? row : { ...row, display_name: p.name, formatted_address: p.address,
      primary_type_display_name: p.category, primary_type: p.primaryType, latitude: p.latitude, longitude: p.longitude,
      rating: p.rating, user_rating_count: p.ratingCount, price_level: p.priceLevel, google_maps_uri: p.mapsUrl,
      website_uri: p.websiteUri, phone_number: p.phoneNumber, regular_opening_hours: p.regularOpeningHours,
      amenities: p.amenities, photos: p.photos, live_open_now: p.openNow };
  });
}
