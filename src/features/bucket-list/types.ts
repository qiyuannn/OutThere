export interface PlacePhoto {
  name: string | null;
  widthPx: number | null;
  heightPx: number | null;
  authorAttributions: Array<{ displayName: string | null; uri: string | null; photoUri?: string | null }>;
}

export interface CachedPlace {
  google_place_id: string;
  display_name: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_type_display_name: string | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: string | null;
  google_maps_uri: string | null;
  website_uri: string | null;
  phone_number: string | null;
  regular_opening_hours: string[];
  amenities: Record<string, boolean>;
  photos: PlacePhoto[];
}

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
  places?: CachedPlace | null;
}
