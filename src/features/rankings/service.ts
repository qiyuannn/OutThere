import { CATEGORY_GROUPS_BY_MODE, getCategoryKeysForPlace } from '@/features/categories/catalog';
import { inferVibeFromRating, recalibrateTierScores, Vibe } from './comparison';
import { supabase } from '@/lib/supabase';
import type { CandidatePlace, RankedPlace, RankingMode, SaveRatingInput } from './types';
import { hydratePlaceRows } from '@/features/search/service';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

interface PlaceRow {
  google_place_id: string;
  display_name: string;
  formatted_address: string | null;
  primary_type_display_name: string | null;
  photos: Array<{ url?: string; name?: string }> | null;
}

interface RatingRow {
  id: string;
  user_id: string;
  google_place_id: string;
  mode: RankingMode;
  rating: number | string;
  vibe: RankedPlace['vibe'];
  recommend: boolean;
  notes: string | null;
  social_visibility?: 'private' | 'friends';
  rated_at: string;
  places: PlaceRow[] | PlaceRow | null;
}

export async function getUserRankings(
  userId: string,
  mode: RankingMode,
): Promise<RankedPlace[]> {
  const { data, error } = await client()
    .from('user_place_ratings')
    .select('*, places(*)')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('rating', { ascending: false })
    .order('rated_at', { ascending: false });

  if (error) throw error;

  const groups = CATEGORY_GROUPS_BY_MODE[mode];

  const ratingRows = (data ?? []) as RatingRow[];
  const hydrated = await hydratePlaceRows(ratingRows.map(row => (Array.isArray(row.places) ? row.places[0] : row.places) ?? { google_place_id: row.google_place_id, display_name: '' }));
  const byId = new Map(hydrated.map(p => [p.google_place_id, p as PlaceRow]));

  return ratingRows.map((row) => {
    const place = byId.get(row.google_place_id);
    const numRating = typeof row.rating === 'number' ? row.rating : parseFloat(row.rating);

    const primaryType = place?.primary_type_display_name ?? null;
    const catKeys = getCategoryKeysForPlace(mode, primaryType);
    const matchedGroup = groups.find((g) => catKeys.includes(g.key)) ?? null;

    const photoUrl = place?.photos?.find((p) => p.url)?.url ?? null;

    return {
      id: row.id,
      user_id: row.user_id,
      google_place_id: row.google_place_id,
      mode: row.mode,
      rating: Number.isFinite(numRating) ? Math.round(numRating * 10) / 10 : 0.0,
      vibe: row.vibe,
      recommend: row.recommend,
      notes: row.notes,
      social_visibility: row.social_visibility,
      rated_at: row.rated_at,
      display_name: place?.display_name ?? 'Unknown Place',
      formatted_address: place?.formatted_address ?? null,
      primary_type: primaryType,
      category_key: matchedGroup?.key ?? null,
      category_name: matchedGroup?.label ?? primaryType,
      category_icon: matchedGroup?.icon ?? (mode === 'food' ? '🍽️' : '📍'),
      photo_url: photoUrl,
    };
  });
}

export async function saveUserPlaceRating(
  userId: string,
  input: SaveRatingInput,
): Promise<void> {
  const roundedRating = Math.max(0.0, Math.min(10.0, Math.round(input.rating * 10) / 10));

  // 1. Upsert the new place rating
  const { error } = await client()
    .from('user_place_ratings')
    .upsert(
      {
        user_id: userId,
        google_place_id: input.google_place_id,
        mode: input.mode,
        rating: roundedRating,
        vibe: input.vibe,
        recommend: input.recommend,
        notes: input.notes?.trim() || null,
        ...(input.social_visibility ? { social_visibility: input.social_visibility } : {}),
        rated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,google_place_id' },
    );

  if (error) throw error;

  // 2. Batch-update dynamically recalibrated places if provided
  if (input.recalibratedPlaces && input.recalibratedPlaces.length > 0) {
    const updates = input.recalibratedPlaces.map((p) => ({
      user_id: userId,
      google_place_id: p.google_place_id,
      mode: input.mode,
      rating: Math.max(0.0, Math.min(10.0, Math.round(p.rating * 10) / 10)),
      vibe: p.vibe,
      updated_at: new Date().toISOString(),
    }));

    const { error: recalibError } = await client()
      .from('user_place_ratings')
      .upsert(updates, { onConflict: 'user_id,google_place_id' });

    if (recalibError) {
      console.error('Failed to batch-update recalibrated ratings:', recalibError);
      throw recalibError;
    }
  }

  // 3. Sync category weights derived from user ratings
  await syncCategoryWeightsFromRatings(userId, input.mode);
}

export async function deleteUserPlaceRating(
  userId: string,
  placeId: string,
  mode: RankingMode,
): Promise<void> {
  const { error } = await client()
    .from('user_place_ratings')
    .delete()
    .eq('user_id', userId)
    .eq('google_place_id', placeId);

  if (error) throw error;

  // Recalibrate remaining places after deletion to relieve compression
  try {
    const { data: remaining } = await client()
      .from('user_place_ratings')
      .select('google_place_id, rating, vibe')
      .eq('user_id', userId)
      .eq('mode', mode)
      .order('rating', { ascending: false });

    if (remaining && remaining.length > 0) {
      const tierGroups: Record<Vibe, Array<{ google_place_id: string; rating: number; vibe: Vibe }>> = {
        loved: [],
        liked: [],
        fine: [],
        disliked: [],
      };

      for (const row of remaining) {
        const numRating = typeof row.rating === 'number' ? row.rating : parseFloat(row.rating);
        const v: Vibe = row.vibe ?? inferVibeFromRating(numRating);
        tierGroups[v].push({
          google_place_id: row.google_place_id,
          rating: numRating,
          vibe: v,
        });
      }

      const updates: Array<{ user_id: string; google_place_id: string; mode: RankingMode; rating: number; vibe: Vibe; updated_at: string }> = [];
      const allVibes: Vibe[] = ['loved', 'liked', 'fine', 'disliked'];

      for (const v of allVibes) {
        const group = tierGroups[v];
        if (group.length === 0) continue;
        const newTierScores = recalibrateTierScores(group.length, v);
        for (let i = 0; i < group.length; i++) {
          if (Math.abs(group[i].rating - newTierScores[i]) >= 0.05) {
            updates.push({
              user_id: userId,
              google_place_id: group[i].google_place_id,
              mode,
              rating: newTierScores[i],
              vibe: v,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      if (updates.length > 0) {
        await client()
          .from('user_place_ratings')
          .upsert(updates, { onConflict: 'user_id,google_place_id' });
      }
    }
  } catch {
    // Non-critical if post-delete recalibration fails; deletion still succeeded
  }

  await syncCategoryWeightsFromRatings(userId, mode);
}

export async function getUserRatingForPlace(
  userId: string,
  placeId: string,
): Promise<{ rating: number; vibe: RankedPlace['vibe'] } | null> {
  const { data, error } = await client()
    .from('user_place_ratings')
    .select('rating, vibe')
    .eq('user_id', userId)
    .eq('google_place_id', placeId)
    .maybeSingle();

  if (error || !data) return null;
  const num = typeof data.rating === 'number' ? data.rating : parseFloat(data.rating);
  return {
    rating: Number.isFinite(num) ? Math.round(num * 10) / 10 : 0.0,
    vibe: data.vibe,
  };
}

export async function getUserRatingsMap(
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await client()
    .from('user_place_ratings')
    .select('google_place_id, rating')
    .eq('user_id', userId);

  if (error || !data) return {};
  const map: Record<string, number> = {};
  for (const row of data as Array<{ google_place_id: string; rating: number | string }>) {
    const num = typeof row.rating === 'number' ? row.rating : parseFloat(row.rating);
    if (Number.isFinite(num)) {
      map[row.google_place_id] = Math.round(num * 10) / 10;
    }
  }
  return map;
}

export async function syncCategoryWeightsFromRatings(
  userId: string,
  mode: RankingMode,
): Promise<void> {
  const { data: ratingsData, error: ratingsError } = await client()
    .from('user_place_ratings')
    .select('google_place_id, rating, places(google_place_id, display_name, primary_type_display_name)')
    .eq('user_id', userId)
    .eq('mode', mode);

  if (ratingsError) throw ratingsError;

  const ratingPlaces = await hydratePlaceRows((ratingsData ?? []).map(row => (Array.isArray(row.places) ? row.places[0] : row.places) ?? { google_place_id: row.google_place_id, display_name: null }));
  const ratingPlacesById = new Map(ratingPlaces.map(p => [p.google_place_id, p]));

  const groups = CATEGORY_GROUPS_BY_MODE[mode];
  const table = mode === 'food' ? 'user_food_category_weights' : 'user_activity_category_weights';

  // Map category_key -> list of ratings
  const categoryRatings = new Map<string, number[]>();
  for (const group of groups) {
    categoryRatings.set(group.key, []);
  }

  for (const row of ratingsData ?? []) {
    const val = typeof row.rating === 'number' ? row.rating : parseFloat(row.rating);
    if (!Number.isFinite(val)) continue;

    const place = ratingPlacesById.get(row.google_place_id);
    const primaryType = (place as { primary_type_display_name?: string } | null)?.primary_type_display_name ?? null;
    const catKeys = getCategoryKeysForPlace(mode, primaryType);

    for (const k of catKeys) {
      if (categoryRatings.has(k)) {
        categoryRatings.get(k)!.push(val);
      }
    }
  }

  // Update or delete rows for each category group
  for (const group of groups) {
    const scores = categoryRatings.get(group.key) ?? [];
    if (scores.length > 0) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      // Normalize 0.0 - 10.0 to 0.00 - 1.00 weight
      const normalizedWeight = Math.max(0.0, Math.min(1.0, Math.round((avg / 10.0) * 100) / 100));

      await client()
        .from(table)
        .upsert(
          {
            user_id: userId,
            category_key: group.key,
            weight: normalizedWeight,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,category_key' },
        );
    } else {
      // Category is unrated! Remove explicit weight row so it is marked unrated
      await client()
        .from(table)
        .delete()
        .eq('user_id', userId)
        .eq('category_key', group.key);
    }
  }
}

export async function getCandidatePlaces(
  userId: string,
  mode: RankingMode,
): Promise<CandidatePlace[]> {
  // Fetch existing rated IDs to exclude them from unrated candidate list
  const { data: ratedRows } = await client()
    .from('user_place_ratings')
    .select('google_place_id')
    .eq('user_id', userId);

  const ratedIds = new Set((ratedRows ?? []).map((r) => r.google_place_id));

  // 1. Fetch saved places in bucket list for this mode
  const { data: savedData } = await client()
    .from('saved_places')
    .select('google_place_id, mode, places(*)')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('saved_at', { ascending: false });

  const candidates: CandidatePlace[] = [];
  const seenIds = new Set<string>();

  const savedPlaces = await hydratePlaceRows((savedData ?? []).map(row => ((Array.isArray(row.places) ? row.places[0] : row.places) as PlaceRow | null) ?? { google_place_id: row.google_place_id, display_name: '' }));
  const savedById = new Map(savedPlaces.map(p => [p.google_place_id, p as PlaceRow]));

  for (const row of savedData ?? []) {
    if (ratedIds.has(row.google_place_id) || seenIds.has(row.google_place_id)) continue;
    seenIds.add(row.google_place_id);

    const place = savedById.get(row.google_place_id);
    if (!place) continue;

    candidates.push({
      google_place_id: place.google_place_id,
      display_name: place.display_name,
      formatted_address: place.formatted_address,
      primary_type: place.primary_type_display_name,
      primary_type_display_name: place.primary_type_display_name,
      photo_url: place.photos?.find((p) => p.url)?.url ?? null,
      mode,
    });
  }

  // 2. Fetch other cached places in database (up to 30)
  const { data: otherPlaces } = await client()
    .from('places')
    .select('*')
    .limit(40);

  for (const place of (otherPlaces ?? []) as PlaceRow[]) {
    if (!place.display_name) continue;
    if (ratedIds.has(place.google_place_id) || seenIds.has(place.google_place_id)) continue;
    seenIds.add(place.google_place_id);

    candidates.push({
      google_place_id: place.google_place_id,
      display_name: place.display_name,
      formatted_address: place.formatted_address,
      primary_type: place.primary_type_display_name,
      primary_type_display_name: place.primary_type_display_name,
      photo_url: place.photos?.find((p) => p.url)?.url ?? null,
      mode,
    });
  }

  return candidates;
}
