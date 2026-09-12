import { supabase } from '@/lib/supabase';
import type { SavedPlace } from './types';

export async function getSavedPlaces(userId: string): Promise<SavedPlace[]> {
  if (!supabase) throw new Error('Connect the app to Supabase to view saved places.');

  const { data, error } = await supabase
    .from('saved_places')
    .select('google_place_id, mode, saved_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SavedPlace[];
}
