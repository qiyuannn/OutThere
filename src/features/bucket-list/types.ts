export interface SavedPlace {
  google_place_id: string;
  mode: 'activities' | 'food';
  saved_at: string;
  display_name: string | null;
  location: string | null;
  category: string | null;
  rating: number | null;
  price_level: string | null;
  open_now: boolean | null;
}
