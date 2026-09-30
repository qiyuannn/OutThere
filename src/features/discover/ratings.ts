import { supabase } from '@/lib/supabase';

/** Average the OutThere ratings visible under the current user's privacy permissions. */
export async function fetchOutThereRating(placeId: string): Promise<{ average: number | null; count: number }> {
  if (!supabase) throw new Error('Ratings are unavailable.');
  const pageSize = 500;
  let total = 0;
  let count = 0;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('user_place_ratings')
      .select('rating')
      .eq('google_place_id', placeId)
      .order('user_id')
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      const rating = Number(row.rating);
      if (row.rating !== null && Number.isFinite(rating)) {
        total += rating;
        count += 1;
      }
    }
    if (!data || data.length < pageSize) break;
  }
  return { average: count ? total / count : null, count };
}
